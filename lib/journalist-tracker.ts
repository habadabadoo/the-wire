// lib/journalist-tracker.ts
import { resolveOutlet } from "./outlets";

export interface JournalistRecord {
  name: string;
  outlet: string;
  email?: string;
  topics: string[];
  articleCount: number;
  lastSeen: string;
  articles: { headline: string; date: string; url: string; topic: string }[];
}

export interface ArticleForTracking {
  headline: string;
  source: string;
  journalist: string;
  date: string;
  url: string;
  topic: string;
}

// In-memory journalist database (persists within a server instance)
let journalistDB: JournalistRecord[] = [];

const BAD_NAMES = new Set([
  "unknown", "commission", "council", "spokesperson", "staff",
  "editorial", "press office", "press release", "none",
]);

export function trackJournalists(articles: ArticleForTracking[]): void {
  for (const a of articles) {
    const name = a.journalist?.trim();
    if (!name || BAD_NAMES.has(name.toLowerCase())) continue;

    const idx = journalistDB.findIndex(
      (j) =>
        j.name.toLowerCase() === name.toLowerCase() &&
        j.outlet.toLowerCase() === a.source.toLowerCase()
    );

    if (idx >= 0) {
      const j = journalistDB[idx];
      if (!j.topics.includes(a.topic)) j.topics.push(a.topic);
      if (!j.articles.some((x) => x.headline === a.headline)) {
        j.articles.push({
          headline: a.headline,
          date: a.date,
          url: a.url,
          topic: a.topic,
        });
        j.articleCount = j.articles.length;
      }
      j.lastSeen = new Date().toISOString().split("T")[0];
    } else {
      journalistDB.push({
        name,
        outlet: a.source,
        topics: [a.topic],
        articleCount: 1,
        lastSeen: new Date().toISOString().split("T")[0],
        articles: [
          {
            headline: a.headline,
            date: a.date,
            url: a.url,
            topic: a.topic,
          },
        ],
      });
    }
  }

  journalistDB.sort((a, b) => b.articleCount - a.articleCount);
}

export function getJournalists(): JournalistRecord[] {
  return journalistDB;
}

export function updateJournalistEmail(name: string, outlet: string, email: string): void {
  const j = journalistDB.find(
    (j) => j.name.toLowerCase() === name.toLowerCase() && j.outlet.toLowerCase() === outlet.toLowerCase()
  );
  if (j) j.email = email;
}
