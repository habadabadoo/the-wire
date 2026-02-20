// lib/rate-limit.ts

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (resets on cold starts — fine for a small tool)
const store = new Map<string, RateLimitEntry>();

const LIMIT = 10; // queries per day
const WINDOW = 24 * 60 * 60 * 1000; // 24 hours

export function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetIn: number;
} {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW });
    return { allowed: true, remaining: LIMIT - 1, limit: LIMIT, resetIn: WINDOW };
  }

  if (entry.count >= LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      limit: LIMIT,
      resetIn: entry.resetAt - now,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: LIMIT - entry.count,
    limit: LIMIT,
    resetIn: entry.resetAt - now,
  };
}
