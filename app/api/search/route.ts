// app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveOutlet } from "@/lib/outlets";
import { trackJournalists } from "@/lib/journalist-tracker";
import { checkRateLimit } from "@/lib/rate-limit";

interface Article {
  headline: string;
  source: string;
  journalist: string;
  date: string;
  url: string;
  snippet: string;
}

function getClientIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || "127.0.0.1";
}

/**
 * Run a SerpAPI Google search with given query.
 */
async function serpSearch(query: string, num: number = 10): Promise<any> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY not configured");

  const params = new URLSearchParams({
    api_key: apiKey,
    engine: "google",
    q: query,
    num: num.toString(),
    tbs: "qdr:m",  // Last month
    gl: "be",
    hl: "en",
  });

  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) {
    const err = await res.text();
    console.error("[SerpAPI] Error:", res.status, err);
    throw new Error(`SerpAPI error: ${res.status}`);
  }
  return res.json();
}

/**
 * Extract articles from SerpAPI results, filtering to approved outlets only.
 * Attempts to find journalist names from various SerpAPI fields.
 */
function extractArticles(data: any): Article[] {
  const results = data.organic_results || [];
  const articles: Article[] = [];

  for (const r of results) {
    if (!r.title || !r.link) continue;
    const outletName = resolveOutlet(r.link);
    if (!outletName) continue;

    // Try to extract journalist name from various SerpAPI fields
    let journalist = "Unknown";

    // 1. Check rich_snippet for author
    if (r.rich_snippet?.top?.detected_extensions?.author) {
      journalist = r.rich_snippet.top.detected_extensions.author;
    }
    // 2. Check rich_snippet bottom
    if (journalist === "Unknown" && r.rich_snippet?.bottom?.detected_extensions?.author) {
      journalist = r.rich_snippet.bottom.detected_extensions.author;
    }
    // 3. Check source info (sometimes has author)
    if (journalist === "Unknown" && r.source?.author) {
      journalist = r.source.author;
    }
    // 4. Check about_this_result or other metadata
    if (journalist === "Unknown" && r.about_this_result?.source?.author) {
      journalist = r.about_this_result.source.author;
    }
    // 5. Try to extract "By Name" pattern from snippet
    if (journalist === "Unknown" && r.snippet) {
      const bylineMatch = r.snippet.match(/^(?:By|by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})(?:\s*[,·|—\-]|\s+\d)/);
      if (bylineMatch) {
        journalist = bylineMatch[1].trim();
      }
    }
    // 6. Check title for "| Author Name" or "- Author Name" at end
    if (journalist === "Unknown" && r.title) {
      const titleAuthor = r.title.match(/(?:\|\s*|-\s*)(?:By\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*$/);
      if (titleAuthor) {
        // Make sure it's not the outlet name
        const candidate = titleAuthor[1].trim();
        if (candidate.toLowerCase() !== outletName.toLowerCase() && !candidate.match(/^(POLITICO|Reuters|Bloomberg|Guardian|BBC|Euractiv|Euronews)$/i)) {
          journalist = candidate;
        }
      }
    }

    articles.push({
      headline: r.title,
      source: outletName,
      url: r.link,
      date: r.date || "",
      journalist,
      snippet: r.snippet || "",
    });
  }
  return articles;
}

/**
 * Build search queries that preserve the user's original intent.
 * If the user wraps something in quotes, keep those quotes.
 * Always pass the original topic intact to SerpAPI — don't split or restructure.
 */
function buildSearchQueries(topic: string): string[] {
  // The key insight: pass the user's topic exactly as-is into each site-scoped search.
  // SerpAPI/Google handles quotes, AND, OR natively.
  const t = topic;

  return [
    // EU core outlets
    `${t} site:politico.eu OR site:euractiv.com OR site:euobserver.com OR site:euronews.com`,
    // International wires + broadsheets
    `${t} site:ft.com OR site:reuters.com OR site:bloomberg.com OR site:theguardian.com OR site:bbc.com`,
    // More international + German
    `${t} site:nytimes.com OR site:economist.com OR site:spiegel.de OR site:faz.net OR site:zeit.de`,
    // French + Southern Europe + Belgian
    `${t} site:lemonde.fr OR site:elpais.com OR site:repubblica.it OR site:standaard.be OR site:lesoir.be`,
    // Broad catch-all — this is the one most likely to find results when specific site searches miss
    `${t} EU Europe policy`,
    // Wire services
    `${t} site:efe.com OR site:ansa.it OR site:dpa.com OR site:belga.be OR site:lusa.pt`,
    // Google News style
    `${t} EU`,
  ];
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Daily limit reached", remaining: 0, limit: rl.limit },
        { status: 429 }
      );
    }

    const { topic } = await request.json();
    if (!topic?.trim()) {
      return NextResponse.json({ error: "Topic required" }, { status: 400 });
    }

    const startTime = Date.now();
    const t = topic.trim();
    console.log(`[Search] "${t}"`);

    const queries = buildSearchQueries(t);
    const searches = queries.map(q => serpSearch(q, 10));

    const results = await Promise.all(
      searches.map(p => p.catch(e => {
        console.error("[Search] Query failed:", e.message);
        return { organic_results: [] };
      }))
    );

    // Flatten, filter to approved outlets, deduplicate
    const seen = new Set<string>();
    const articles: Article[] = [];

    for (const data of results) {
      for (const a of extractArticles(data)) {
        const urlKey = a.url.toLowerCase().replace(/\/$/, "").replace(/^https?:\/\/(www\.)?/, "");
        if (seen.has(urlKey)) continue;
        seen.add(urlKey);

        const titleKey = a.headline.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50);
        if (seen.has(titleKey)) continue;
        seen.add(titleKey);

        articles.push(a);
      }
    }

    // Sort by date (newest first). Fall back to EU-focused outlets first for undated articles.
    const euDomains = new Set(["POLITICO Europe", "Euractiv", "EUobserver", "Euronews", "The Parliament Magazine", "New Europe", "Borderlex", "MLex", "Agence Europe"]);

    articles.sort((a, b) => {
      const aDate = parseDate(a.date);
      const bDate = parseDate(b.date);
      // Both have dates — sort newest first
      if (aDate && bDate) return bDate - aDate;
      // Only one has a date — dated article comes first
      if (aDate && !bDate) return -1;
      if (!aDate && bDate) return 1;
      // Neither has a date — EU outlets first
      const aEU = euDomains.has(a.source) ? 0 : 1;
      const bEU = euDomains.has(b.source) ? 0 : 1;
      return aEU - bEU;
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const outlets = [...new Set(articles.map(a => a.source))];

    console.log(`[Search] Done in ${elapsed}s: ${articles.length} articles from ${outlets.length} outlets`);
    console.log(`[Search] Outlets: ${outlets.join(", ")}`);

    trackJournalists(articles.map(a => ({ ...a, topic: t })));

    return NextResponse.json({
      articles,
      outletCount: outlets.length,
      outletsWithResults: outlets,
      searchCredits: queries.length,
      elapsed: parseFloat(elapsed),
      remaining: rl.remaining,
      limit: rl.limit,
    });

  } catch (error: any) {
    console.error("[Search] Error:", error);
    return NextResponse.json(
      { error: error.message || "Something went wrong." },
      { status: 500 }
    );
  }
}

/** Parse various date strings into timestamps */
function parseDate(dateStr: string): number | null {
  if (!dateStr) return null;
  const clean = dateStr.replace(/^[\s·—\-]+/, "").trim();
  // "X hours ago", "X days ago"
  const agoMatch = clean.match(/(\d+)\s+(minute|hour|day|week|month)s?\s+ago/i);
  if (agoMatch) {
    const n = parseInt(agoMatch[1]);
    const unit = agoMatch[2].toLowerCase();
    const now = Date.now();
    const ms: Record<string, number> = { minute: 60000, hour: 3600000, day: 86400000, week: 604800000, month: 2592000000 };
    return now - n * (ms[unit] || 86400000);
  }
  const ts = Date.parse(clean);
  if (!isNaN(ts)) return ts;
  return null;
}
