// app/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";

interface Article {
  headline: string;
  source: string;
  journalist: string;
  date: string;
  url: string;
  snippet: string;
  parsedDate?: number;
}

interface JournalistRecord {
  name: string;
  outlet: string;
  email?: string;
  topics: string[];
  articleCount: number;
  articles: { headline: string; date: string; url: string }[];
}

function LoadingDots() {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "12px 0" }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: "var(--black)", animation: "pulse-dot 1.4s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function SearchTips({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div style={{ animation: "fade-up 0.3s", marginTop: 12, padding: "16px 20px", background: "var(--grey-bg)", border: "1px solid var(--grey-rule)", fontSize: 13, color: "var(--black-light)", lineHeight: 1.8 }}>
      <p style={{ fontWeight: 600, marginBottom: 6, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--grey-dark)" }}>Search tips</p>
      <p><strong>Exact phrase</strong> — Use quotes: <code style={{ background: "var(--white)", padding: "1px 6px", border: "1px solid var(--grey-rule)", fontSize: 12 }}>"EU Industrial Accelerator"</code></p>
      <p><strong>Combine terms</strong> — Use AND: <code style={{ background: "var(--white)", padding: "1px 6px", border: "1px solid var(--grey-rule)", fontSize: 12 }}>"PPWR" AND "packaging"</code></p>
      <p><strong>Alternatives</strong> — Use OR: <code style={{ background: "var(--white)", padding: "1px 6px", border: "1px solid var(--grey-rule)", fontSize: 12 }}>"CBAM" OR "carbon border"</code></p>
      <p><strong>Acronyms</strong> — Wrap in quotes for best results: <code style={{ background: "var(--white)", padding: "1px 6px", border: "1px solid var(--grey-rule)", fontSize: 12 }}>"PPWR"</code></p>
      <p style={{ marginTop: 4, fontSize: 12, color: "var(--grey-mid)" }}>Searches cover 50+ approved EU and international outlets. Results from the last 30 days.</p>
    </div>
  );
}

function formatAnalysis(text: string): string {
  // Pre-process: wrap consecutive list items in <ul> tags
  let processed = text
    // Headers — must be processed largest first to avoid conflicts
    .replace(/^####\s+(.+)$/gm, "%%H4%%$1%%/H4%%")
    .replace(/^###\s+(.+)$/gm, "%%H3%%$1%%/H3%%")
    .replace(/^##\s+(.+)$/gm, "%%H2%%$1%%/H2%%")
    .replace(/^---$/gm, "%%HR%%")
    // Credibility badges
    .replace(
      /\*\*Credibility rating:\s*(HIGH|MEDIUM|LOW)\*\*/gi,
      (_, r) => `%%BADGE-${r.toUpperCase()}%%`
    )
    // Why you highlight
    .replace(/\*\*Why you\?\*\*/gi, "%%WHYYOU%%")
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, "%%B%%$1%%/B%%")
    .replace(/\*(.+?)\*/g, "%%I%%$1%%/I%%")
    // List items
    .replace(/^- (.+)$/gm, "%%LI%%$1%%/LI%%");

  // Now convert to HTML
  processed = processed
    .replace(/%%H2%%(.+?)%%\/H2%%/g, '<h2 class="analysis-h2">$1</h2>')
    .replace(/%%H3%%(.+?)%%\/H3%%/g, "<h3>$1</h3>")
    .replace(/%%H4%%(.+?)%%\/H4%%/g, "<h4>$1</h4>")
    .replace(/%%HR%%/g, "<hr />")
    .replace(/%%BADGE-(HIGH|MEDIUM|LOW)%%/g, (_, r) => `<span class="badge-${r.toLowerCase()}">${r}</span>`)
    .replace(/%%WHYYOU%%/g, '<strong style="color:var(--accent)">Why you?</strong>')
    .replace(/%%B%%(.+?)%%\/B%%/g, "<strong>$1</strong>")
    .replace(/%%I%%(.+?)%%\/I%%/g, "<em>$1</em>")
    // Wrap consecutive LI items in ul tags
    .replace(/(%%LI%%.+?%%\/LI%%(\n|$))+/g, (match) => {
      const items = match.replace(/%%LI%%(.+?)%%\/LI%%/g, "<li>$1</li>");
      return `<ul>${items}</ul>`;
    })
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br />")
    .replace(/^/, "<p>") + "</p>";

  // Clean up empty paragraphs
  processed = processed
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/<p>\s*<(h[234]|hr|ul)/g, "<$1")
    .replace(/<\/(h[234]|hr|ul)>\s*<\/p>/g, "</$1>")
    .replace(/<p><br \/>/g, "<p>")
    .replace(/<br \/><\/p>/g, "</p>");

  return processed;
}

/** Parse various date formats into a timestamp for sorting */
function parseArticleDate(dateStr: string): number {
  if (!dateStr) return 0;
  const clean = dateStr.replace(/^[\s·—\-]+/, "").trim();
  // "X hours ago", "X days ago" etc
  const agoMatch = clean.match(/(\d+)\s+(minute|hour|day|week|month)s?\s+ago/i);
  if (agoMatch) {
    const n = parseInt(agoMatch[1]);
    const unit = agoMatch[2].toLowerCase();
    const now = Date.now();
    const ms: Record<string, number> = { minute: 60000, hour: 3600000, day: 86400000, week: 604800000, month: 2592000000 };
    return now - n * (ms[unit] || 86400000);
  }
  // Try standard date parse
  const ts = Date.parse(clean);
  if (!isNaN(ts)) return ts;
  // "Feb 14, 2025" / "14 Feb 2025" etc
  const d = new Date(clean);
  if (!isNaN(d.getTime())) return d.getTime();
  return 0;
}

function formatRelativeDate(dateStr: string): string {
  if (!dateStr) return "";
  const ts = parseArticleDate(dateStr);
  if (!ts) return dateStr;
  const now = Date.now();
  const diff = now - ts;
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type TimeFilter = "24h" | "7d" | "30d";

export default function Home() {
  const [tab, setTab] = useState<"monitor" | "journalists">("monitor");
  const [topic, setTopic] = useState("");
  const [org, setOrg] = useState("");
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("30d");

  const [searchPhase, setSearchPhase] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [actionPhase, setActionPhase] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [actionType, setActionType] = useState<"pitch" | "analysis" | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchMeta, setSearchMeta] = useState<any>(null);

  const [journalists, setJournalists] = useState<JournalistRecord[]>([]);
  const [journalistsLoading, setJournalistsLoading] = useState(false);
  const [expJ, setExpJ] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const [secs, setSecs] = useState(0);
  const timer = useRef<NodeJS.Timeout | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchPhase === "loading" || actionPhase === "loading") {
      setSecs(0);
      timer.current = setInterval(() => setSecs((s) => s + 1), 1000);
    } else if (timer.current) clearInterval(timer.current);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [searchPhase, actionPhase]);

  const loadJournalists = async () => {
    // Journalists are now stored client-side, no server fetch needed
    setJournalistsLoading(false);
  };

  /** Merge newly extracted journalists into the client-side list */
  const mergeJournalists = (newJournalists: any[]) => {
    if (!newJournalists || newJournalists.length === 0) return;
    setJournalists(prev => {
      const merged = [...prev];
      for (const nj of newJournalists) {
        if (!nj.name || !nj.outlet) continue;
        const idx = merged.findIndex(
          j => j.name.toLowerCase() === nj.name.toLowerCase() && j.outlet.toLowerCase() === nj.outlet.toLowerCase()
        );
        if (idx >= 0) {
          // Update existing
          const existing = merged[idx];
          if (nj.headline && !existing.articles.some(a => a.headline === nj.headline)) {
            existing.articles.push({ headline: nj.headline, date: nj.date || "", url: nj.url || "" });
            existing.articleCount = existing.articles.length;
          }
          if (topic.trim() && !existing.topics.includes(topic.trim())) {
            existing.topics.push(topic.trim());
          }
        } else {
          // Add new
          merged.push({
            name: nj.name,
            outlet: nj.outlet,
            topics: topic.trim() ? [topic.trim()] : [],
            articleCount: 1,
            articles: nj.headline ? [{ headline: nj.headline, date: nj.date || "", url: nj.url || "" }] : [],
          });
        }
      }
      merged.sort((a, b) => b.articleCount - a.articleCount);
      return merged;
    });
  };

  // Filter articles by time
  const getFilteredArticles = () => {
    const now = Date.now();
    const cutoffs: Record<TimeFilter, number> = {
      "24h": now - 86400000,
      "7d": now - 604800000,
      "30d": now - 2592000000,
    };
    const cutoff = cutoffs[timeFilter];
    return articles
      .map(a => ({ ...a, parsedDate: parseArticleDate(a.date) }))
      .filter(a => !a.parsedDate || a.parsedDate >= cutoff)
      .sort((a, b) => (b.parsedDate || 0) - (a.parsedDate || 0));
  };

  const filteredArticles = searchPhase === "done" ? getFilteredArticles() : [];

  // ── Search ──
  const handleSearch = async () => {
    if (!topic.trim()) return;
    setSearchPhase("loading"); setError(null); setResult(null); setActionPhase("idle"); setArticles([]); setSelected(new Set());
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setSearchPhase("error"); setError(data.error); return; }
      setArticles(data.articles || []);
      setSearchMeta(data);
      setSearchPhase("done");
    } catch { setSearchPhase("error"); setError("Failed to connect."); }
  };

  const toggleSelect = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };
  const selectAll = () => {
    if (selected.size === filteredArticles.length) setSelected(new Set());
    else setSelected(new Set(filteredArticles.map((_, i) => i)));
  };

  // ── Pitch Angles ──
  const handlePitch = async () => {
    if (!org.trim() || selected.size === 0) return;
    setActionPhase("loading"); setActionType("pitch"); setError(null); setResult(null);
    try {
      const selectedArticles = [...selected].map(i => filteredArticles[i]);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organisation: org.trim(), articles: selectedArticles, mode: "pitch", pastedContent: pasted.trim() || undefined, topic: topic.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setActionPhase("error"); setError(data.error); return; }
      setResult(data.analysis); setActionPhase("done");
      if (data.journalists) mergeJournalists(data.journalists);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch { setActionPhase("error"); setError("Analysis failed."); }
  };

  // ── Full Analysis ──
  const handleFullAnalysis = async () => {
    if (!org.trim() || filteredArticles.length === 0) return;
    setActionPhase("loading"); setActionType("analysis"); setError(null); setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organisation: org.trim(), articles: filteredArticles, mode: "analysis", pastedContent: pasted.trim() || undefined, topic: topic.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setActionPhase("error"); setError(data.error); return; }
      setResult(data.analysis); setActionPhase("done");
      if (data.journalists) mergeJournalists(data.journalists);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch { setActionPhase("error"); setError("Analysis failed."); }
  };

  const busy = actionPhase === "loading";

  return (
    <div style={{ minHeight: "100vh", background: "var(--white)" }}>
      {/* ══ HEADER ══ */}
      <header style={{ borderBottom: "2px solid var(--black)" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto", padding: "20px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
            <h1 className="font-display" style={{ fontSize: 36, letterSpacing: "-0.01em", lineHeight: 1 }}>
              The Wire
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {searchMeta && (
                <span style={{ fontSize: 11, color: "var(--grey-mid)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {searchMeta.remaining}/{searchMeta.limit} searches today
                </span>
              )}
              <span style={{ fontSize: 11, color: "var(--grey-light)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                EU Media Intelligence
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 0, borderTop: "1px solid var(--grey-rule)" }}>
            {([["monitor", "Monitor"], ["journalists", "Journalists"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                padding: "10px 20px 12px", fontSize: 12, fontWeight: 500, background: "none", border: "none",
                cursor: "pointer", color: tab === id ? "var(--black)" : "var(--grey-mid)",
                borderBottom: tab === id ? "2px solid var(--black)" : "2px solid transparent",
                marginBottom: -2, letterSpacing: "0.06em", textTransform: "uppercase",
                fontFamily: "'Inter', system-ui, sans-serif",
              }}>
                {label}
                {id === "journalists" && journalists.length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 10, padding: "1px 6px", background: "var(--grey-bg)", color: "var(--grey-dark)", border: "1px solid var(--grey-rule)" }}>{journalists.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1060, margin: "0 auto", padding: "40px 24px" }}>
        {/* ═══ MONITOR ═══ */}
        {tab === "monitor" && (
          <>
            <div style={{ marginBottom: 36 }}>
              <h2 className="font-display" style={{ fontSize: 32, marginBottom: 8 }}>Monitor</h2>
              <p style={{ color: "var(--grey-dark)", lineHeight: 1.65, maxWidth: 600, fontSize: 14 }}>
                Search recent coverage across 50+ approved EU and international outlets.
                Select articles for pitch angles, or run a full coverage analysis.
              </p>
            </div>

            {/* Search */}
            <div style={{ marginBottom: 8 }}>
              <label className="input-label">Policy topic</label>
              <div style={{ display: "flex", gap: 0 }}>
                <input
                  className="input-field"
                  style={{ flex: 1, borderRight: "none" }}
                  placeholder="e.g. EU AI Act, Green Deal, PPWR..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <button className="btn-primary" onClick={handleSearch} disabled={!topic.trim() || searchPhase === "loading"}>
                  {searchPhase === "loading" && <Spinner />}
                  {searchPhase === "loading" ? "Searching..." : "Search"}
                </button>
              </div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 16 }}>
                <button
                  onClick={() => setShowTips(!showTips)}
                  style={{ background: "none", border: "none", color: "var(--grey-mid)", cursor: "pointer", fontSize: 12, padding: 0, textDecoration: "underline", textUnderlineOffset: 3 }}
                >
                  {showTips ? "Hide search tips" : "Search tips"}
                </button>
              </div>
              <SearchTips visible={showTips} />
            </div>

            {searchPhase === "loading" && (
              <div style={{ padding: "48px 0", textAlign: "center", borderTop: "1px solid var(--grey-rule)", marginTop: 24 }}>
                <LoadingDots />
                <p style={{ color: "var(--grey-dark)", fontSize: 14, marginTop: 8 }}>Searching &quot;{topic}&quot; across approved outlets&hellip;</p>
                <p style={{ color: "var(--grey-light)", fontSize: 12, marginTop: 4 }}>{secs}s</p>
              </div>
            )}

            {error && (
              <div style={{ background: "var(--accent-light)", border: "1px solid rgba(200,16,46,0.2)", padding: "14px 18px", marginTop: 24 }}>
                <p style={{ color: "var(--accent)", fontSize: 14 }}>{error}</p>
              </div>
            )}

            {/* Results */}
            {searchPhase === "done" && articles.length > 0 && (
              <div style={{ animation: "fade-up 0.4s", marginTop: 32 }}>
                {/* Header bar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid var(--black)", paddingBottom: 12, marginBottom: 0 }}>
                  <div>
                    <h3 className="font-display" style={{ fontSize: 22 }}>Coverage</h3>
                    <p style={{ fontSize: 11, color: "var(--grey-mid)", marginTop: 2, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                      {filteredArticles.length} articles · {searchMeta?.outletCount} outlets · {searchMeta?.elapsed}s
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Time filter */}
                    <div style={{ display: "flex", gap: 0, border: "1px solid var(--grey-rule)" }}>
                      {(["24h", "7d", "30d"] as TimeFilter[]).map(f => (
                        <button key={f} onClick={() => { setTimeFilter(f); setSelected(new Set()); }} style={{
                          padding: "5px 12px", fontSize: 11, fontWeight: 500, border: "none",
                          background: timeFilter === f ? "var(--black)" : "var(--white)",
                          color: timeFilter === f ? "var(--white)" : "var(--grey-dark)",
                          cursor: "pointer", fontFamily: "'Inter', system-ui", letterSpacing: "0.04em",
                          borderRight: f !== "30d" ? "1px solid var(--grey-rule)" : "none",
                        }}>
                          {f}
                        </button>
                      ))}
                    </div>
                    <button onClick={selectAll} style={{
                      background: "none", border: "1px solid var(--grey-rule)",
                      color: "var(--grey-dark)", fontSize: 11, padding: "5px 12px", cursor: "pointer",
                      fontFamily: "'Inter', system-ui", letterSpacing: "0.04em", textTransform: "uppercase",
                    }}>
                      {selected.size === filteredArticles.length ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                </div>

                {/* Article list */}
                <div>
                  {filteredArticles.map((a, i) => (
                    <div key={i} onClick={() => toggleSelect(i)} style={{
                      display: "flex", gap: 14, alignItems: "flex-start",
                      padding: "16px 0",
                      borderBottom: "1px solid var(--grey-rule)",
                      cursor: "pointer",
                      background: selected.has(i) ? "var(--grey-bg)" : "transparent",
                      marginLeft: selected.has(i) ? -12 : 0,
                      marginRight: selected.has(i) ? -12 : 0,
                      paddingLeft: selected.has(i) ? 12 : 0,
                      paddingRight: selected.has(i) ? 12 : 0,
                      transition: "all 0.1s",
                    }}>
                      {/* Checkbox */}
                      <div style={{
                        width: 16, height: 16, flexShrink: 0, marginTop: 2,
                        border: selected.has(i) ? "none" : "1.5px solid var(--grey-light)",
                        background: selected.has(i) ? "var(--black)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {selected.has(i) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                          <div style={{ flex: 1 }}>
                            {a.url ? (
                              <a href={a.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: 14, fontWeight: 500, color: "var(--black)", textDecoration: "none", lineHeight: 1.45, display: "block" }}>
                                {a.headline}
                              </a>
                            ) : (
                              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--black)", margin: 0, lineHeight: 1.45 }}>{a.headline}</p>
                            )}
                            {a.snippet && (
                              <p style={{ fontSize: 13, color: "var(--grey-dark)", margin: "4px 0 0", lineHeight: 1.55 }}>{a.snippet}</p>
                            )}
                          </div>
                          <span style={{ fontSize: 12, color: "var(--grey-mid)", whiteSpace: "nowrap", flexShrink: 0, marginTop: 2 }}>
                            {formatRelativeDate(a.date)}
                          </span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6, fontSize: 12 }}>
                          <span style={{ fontWeight: 600, color: "var(--black)" }}>{a.source}</span>
                          {a.journalist && a.journalist !== "Unknown" && <><span style={{ color: "var(--grey-light)" }}>·</span><span style={{ color: "var(--grey-dark)" }}>{a.journalist}</span></>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredArticles.length === 0 && articles.length > 0 && (
                  <div style={{ padding: "36px 0", textAlign: "center" }}>
                    <p style={{ color: "var(--grey-mid)", fontSize: 14 }}>No articles in this time range. Try expanding to 30 days.</p>
                  </div>
                )}

                {/* Actions panel */}
                <div style={{ marginTop: 32, padding: "28px 0", borderTop: "2px solid var(--black)" }}>
                  <h3 className="font-display" style={{ fontSize: 22, marginBottom: 6 }}>Analysis</h3>
                  <p style={{ fontSize: 13, color: "var(--grey-dark)", marginBottom: 20 }}>
                    Enter your organisation, then choose an action.
                  </p>

                  <div style={{ marginBottom: 16, maxWidth: 400 }}>
                    <label className="input-label">Your organisation</label>
                    <input className="input-field" placeholder="e.g. BusinessEurope, DigitalEurope, Bump..." value={org} onChange={(e) => setOrg(e.target.value)} />
                  </div>

                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                    <button className="btn-primary" onClick={handlePitch} disabled={!org.trim() || selected.size === 0 || busy} style={{ opacity: selected.size === 0 ? 0.5 : 1 }}>
                      {busy && actionType === "pitch" && <Spinner />}
                      {busy && actionType === "pitch" ? "Finding angles..." : `Pitch angles (${selected.size} selected)`}
                    </button>

                    <button className="btn-outline" onClick={handleFullAnalysis} disabled={!org.trim() || busy} style={{ opacity: busy ? 0.5 : 1 }}>
                      {busy && actionType === "analysis" && <Spinner />}
                      {busy && actionType === "analysis" ? "Analysing..." : "Full coverage analysis"}
                    </button>
                  </div>

                  <button onClick={() => setShowPaste(!showPaste)} style={{ background: "none", border: "none", color: "var(--grey-mid)", cursor: "pointer", fontSize: 12, padding: 0, textDecoration: "underline", textUnderlineOffset: 3 }}>
                    {showPaste ? "Hide paywalled content" : "Add paywalled content"}
                  </button>
                  {showPaste && (
                    <textarea className="input-field" style={{ marginTop: 10, minHeight: 80, resize: "vertical" }} placeholder="Paste article text from POLITICO Pro, FT, etc..." value={pasted} onChange={(e) => setPasted(e.target.value)} />
                  )}
                </div>

                {/* Loading */}
                {actionPhase === "loading" && (
                  <div style={{ padding: "48px 0", textAlign: "center", borderTop: "1px solid var(--grey-rule)" }}>
                    <LoadingDots />
                    <p style={{ color: "var(--grey-dark)", fontSize: 14 }}>
                      {actionType === "pitch"
                        ? `Finding pitch angles for ${org}...`
                        : `Running full coverage analysis for ${org}...`}
                    </p>
                    <p style={{ color: "var(--grey-light)", fontSize: 12, marginTop: 4 }}>{secs}s</p>
                  </div>
                )}

                {/* Result */}
                {actionPhase === "done" && result && (
                  <div ref={resultsRef} style={{ animation: "fade-up 0.5s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid var(--black)", paddingBottom: 12, marginBottom: 24 }}>
                      <h3 className="font-display" style={{ fontSize: 22 }}>
                        {actionType === "pitch" ? "Pitch Angles" : "Coverage Analysis"}
                      </h3>
                      <button onClick={() => { navigator.clipboard?.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={{
                        background: "none", border: "1px solid var(--grey-rule)", color: "var(--grey-dark)",
                        cursor: "pointer", fontSize: 11, padding: "5px 12px", letterSpacing: "0.04em", textTransform: "uppercase",
                        fontFamily: "'Inter', system-ui",
                      }}>
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div style={{ maxWidth: 720 }}>
                      <div className="analysis-content" dangerouslySetInnerHTML={{ __html: formatAnalysis(result) }} />
                    </div>
                    <p style={{ marginTop: 24, fontSize: 11, color: "var(--grey-light)", borderTop: "1px solid var(--grey-rule)", paddingTop: 12 }}>AI-generated analysis — verify before acting</p>
                  </div>
                )}
              </div>
            )}

            {searchPhase === "done" && articles.length === 0 && (
              <div style={{ padding: "48px 0", textAlign: "center", borderTop: "1px solid var(--grey-rule)", marginTop: 24 }}>
                <p style={{ color: "var(--grey-mid)", fontSize: 14 }}>No articles found. Try different terms or use quotes for exact phrases.</p>
              </div>
            )}
          </>
        )}

        {/* ═══ JOURNALIST TRACKER ═══ */}
        {tab === "journalists" && (
          <div>
            <div style={{ marginBottom: 32 }}>
              <h2 className="font-display" style={{ fontSize: 32, marginBottom: 8 }}>Journalists</h2>
              <p style={{ color: "var(--grey-dark)", lineHeight: 1.65, maxWidth: 600, fontSize: 14 }}>
                Builds automatically from your searches. Tracks who covers what.
              </p>
            </div>
            {journalistsLoading ? (
              <div style={{ padding: "48px 0", textAlign: "center" }}><LoadingDots /></div>
            ) : journalists.length === 0 ? (
              <div style={{ padding: "48px 0", textAlign: "center", borderTop: "1px solid var(--grey-rule)" }}>
                <p style={{ color: "var(--grey-mid)", fontSize: 14 }}>No journalists tracked yet. Run a search to start building your database.</p>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div style={{ display: "flex", gap: 0, borderTop: "2px solid var(--black)", borderBottom: "1px solid var(--grey-rule)", marginBottom: 28 }}>
                  {[
                    [journalists.length, "Journalists"],
                    [new Set(journalists.map(j => j.outlet)).size, "Outlets"],
                    [new Set(journalists.flatMap(j => j.topics)).size, "Topics"],
                  ].map(([n, l], i) => (
                    <div key={i} style={{ flex: 1, padding: "16px 0", borderRight: i < 2 ? "1px solid var(--grey-rule)" : "none", paddingLeft: i > 0 ? 20 : 0 }}>
                      <p className="font-display" style={{ fontSize: 28 }}>{n}</p>
                      <p style={{ fontSize: 11, color: "var(--grey-mid)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</p>
                    </div>
                  ))}
                </div>

                {/* Journalist list */}
                <div>
                  {journalists.map((j, i) => (
                    <div key={i} style={{ borderBottom: "1px solid var(--grey-rule)" }}>
                      <button onClick={() => setExpJ(expJ === i ? null : i)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", color: "var(--black)", cursor: "pointer", display: "flex", justifyContent: "space-between", padding: "14px 0", fontFamily: "'Inter', system-ui" }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600 }}>{j.name}</p>
                          <p style={{ fontSize: 13, color: "var(--grey-dark)", marginTop: 2 }}>
                            {j.outlet}
                            {j.email && <span style={{ marginLeft: 8, color: "var(--grey-mid)" }}>· {j.email}</span>}
                          </p>
                          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                            {j.topics.map(t => (
                              <span key={t} style={{ fontSize: 10, padding: "2px 8px", background: "var(--grey-bg)", color: "var(--grey-dark)", border: "1px solid var(--grey-rule)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{t}</span>
                            ))}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, paddingLeft: 16 }}>
                          <span className="font-display" style={{ fontSize: 22 }}>{j.articleCount}</span>
                          <p style={{ fontSize: 10, color: "var(--grey-mid)", textTransform: "uppercase", letterSpacing: "0.04em" }}>articles</p>
                        </div>
                      </button>
                      {expJ === i && (
                        <div style={{ paddingBottom: 14, paddingLeft: 16, borderLeft: "2px solid var(--grey-rule)", marginLeft: 4, marginBottom: 8, animation: "fade-up 0.2s" }}>
                          {j.articles.map((a, ai) => (
                            <div key={ai} style={{ fontSize: 13, marginBottom: 4, lineHeight: 1.6 }}>
                              {a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--black-light)", textDecoration: "none", borderBottom: "1px solid var(--grey-rule)" }}>{a.headline}</a> : <span style={{ color: "var(--black-light)" }}>{a.headline}</span>}
                              {a.date && <span style={{ color: "var(--grey-light)", marginLeft: 8, fontSize: 12 }}>{a.date}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      <footer style={{ borderTop: "1px solid var(--grey-rule)", marginTop: 80 }}>
        <div style={{ maxWidth: 1060, margin: "0 auto", padding: "16px 24px", display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--grey-light)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          <span>The Wire</span><span>Powered by Claude</span>
        </div>
      </footer>
    </div>
  );
}
