// app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { trackJournalists } from "@/lib/journalist-tracker";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const PITCH_SYSTEM = `You are an expert EU affairs media relations strategist based in Brussels. Your job is to identify concrete, actionable ways for an organisation to insert itself into active media stories.

TODAY'S DATE: ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}

CRITICAL: Only reference upcoming events that are genuinely in the future relative to today's date. Do NOT reference events that have already happened.

For each article, provide:
1. **The angle**: How can this org credibly connect to this story?
2. **The action**: Exactly what to do (quote offer, briefing, op-ed pitch, data release, etc.)
3. **Who to contact**: The journalist and why they'd be receptive
4. **Credibility rating: HIGH/MEDIUM/LOW** — be honest. If the org has no distinctive claim, say LOW.
5. **Why you?**: What unique value does this org bring? Data, expertise, stakeholder access, geographic angle?
6. **Suggested hook / subject line**: A one-liner pitch

Be direct, strategic, specific. No vague suggestions. British English.`;

const ANALYSIS_SYSTEM = `You are an expert EU affairs media analyst and strategic communications advisor based in Brussels.

TODAY'S DATE: ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}

CRITICAL: Only reference upcoming events that are genuinely in the future relative to today's date. Do NOT reference events that have already happened. If you are unsure whether an event is upcoming or past, do not include it.

MEDIA RELATIONS FRAMEWORK:
1. Newsjacking / Quick-reaction quotes
2. Upcoming news hooks (votes, presidencies, consultations, Council meetings)
3. Expert advisory / Journalist briefings
4. Long-form / Feature pitches
5. Op-eds (earned + paid)

CRITICAL — "WHY YOU?" FILTER:
Rate every opportunity HIGH/MEDIUM/LOW. If the org has no distinctive claim, say so. Honest > encouraging.

British English. Direct and strategic.`;

function formatArticles(articles: any[]): string {
  return articles.map((a: any, i: number) =>
    `${i + 1}. "${a.headline}" — ${a.source}${a.journalist && a.journalist !== "Unknown" ? ` (${a.journalist})` : ""} ${a.date ? `[${a.date}]` : ""}${a.url ? `\n   URL: ${a.url}` : ""}${a.snippet ? `\n   ${a.snippet}` : ""}`
  ).join("\n\n");
}

/**
 * Extract journalist names from the analysis text using a lightweight Claude call.
 * Returns structured journalist data.
 */
async function extractJournalists(
  analysisText: string,
  articles: any[],
  topic: string
): Promise<any[]> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: `You extract journalist names and their outlets from media analysis text and article data. Return ONLY valid JSON, no markdown, no backticks, no preamble. If you cannot identify any journalists, return {"journalists":[]}.`,
      messages: [{
        role: "user",
        content: `From this analysis and article list, extract every journalist name mentioned or identifiable from bylines, snippets, or the analysis text.

## Analysis
${analysisText}

## Articles
${articles.map(a => `- "${a.headline}" — ${a.source} ${a.snippet || ""}`).join("\n")}

Return JSON in this exact format:
{"journalists":[{"name":"Full Name","outlet":"Outlet Name","headline":"Article they wrote","url":"article url if known","date":"date if known"}]}

Rules:
- Only include real journalist names, not organisation names or spokespersons
- Match each journalist to their outlet
- Include the headline of the article they wrote if identifiable
- If a journalist appears in the analysis "Key Journalists" section, include them even if you're not sure of the exact article
- Do NOT include names like "Unknown", "Staff", "Editorial", "Press Office", "Byline not visible"
- Do NOT include generic team names like "POLITICO EU Industry team"
- Return ONLY the JSON object, nothing else`
      }],
    });

    const responseText = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const cleaned = responseText.replace(/```json\s*|```\s*/g, "").trim();
    const data = JSON.parse(cleaned);

    if (data.journalists && Array.isArray(data.journalists)) {
      const valid = data.journalists.filter((j: any) => j.name && j.outlet);
      console.log(`[Journalists] Extracted ${valid.length} journalists from analysis`);
      return valid;
    }
    return [];
  } catch (err: any) {
    console.error("[Journalists] Extraction failed:", err.message);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { organisation, articles, mode, pastedContent, topic } = await request.json();

    if (!organisation || !articles?.length) {
      return NextResponse.json({ error: "Organisation and articles required" }, { status: 400 });
    }

    const artText = formatArticles(articles);
    let system: string;
    let prompt: string;

    if (mode === "pitch") {
      system = PITCH_SYSTEM;
      prompt = `## Organisation: ${organisation}

## Selected Articles
${artText}
${pastedContent ? `\n## Paywalled Content (pasted by user)\n${pastedContent}\n` : ""}
---

For EACH article above, provide a detailed pitch strategy for **${organisation}**:

### Article 1: [headline]
- **The angle**: ...
- **The action**: ...
- **Who to contact**: ...
- **Credibility rating: HIGH/MEDIUM/LOW**
- **Why you?**: ...
- **Suggested hook**: ...

Continue for each article. Be specific and honest.`;

    } else {
      system = ANALYSIS_SYSTEM;
      prompt = `## Organisation: ${organisation}

## Recent Coverage
${artText}
${pastedContent ? `\n## Paywalled Content\n${pastedContent}\n` : ""}
---

### Coverage Snapshot
Narratives, outlets, tone. Reference specific articles.

### Key Journalists
Who is covering this? Name the individual journalists, their outlet, and their angle. Use your knowledge of the Brussels press corps and EU affairs journalists.

### Gaps in Coverage

---

### Opportunities for ${organisation.toUpperCase()}
For EACH: recommendation + **Credibility rating: HIGH/MEDIUM/LOW** + **Why you?**

#### Newsjacking
#### Upcoming News Hooks (4-8 weeks)
#### Journalist Briefings
#### Feature Pitches
#### Op-Eds

---

### Risks & Watch-Outs`;
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 5000,
      system,
      messages: [{ role: "user", content: prompt }],
    });

    const analysis = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    // Extract journalists from the analysis
    const searchTopic = topic || articles[0]?.headline?.split(/[:\-–—]/)[0]?.trim() || "EU policy";
    const extractedJournalists = await extractJournalists(analysis, articles, searchTopic);

    return NextResponse.json({ analysis, mode, journalists: extractedJournalists });

  } catch (error: any) {
    console.error("[Analyze] Error:", error);
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 }
    );
  }
}
