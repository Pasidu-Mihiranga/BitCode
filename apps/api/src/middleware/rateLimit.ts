/**
 * App-layer Redis sliding-window rate limiter (NFR-03 layer 2 — the NGINX
 * layer is the first gate). Per-user when authed, per-IP otherwise.
 *
 * Implementation: ZSET with timestamp-microsecond scores, ZADD + ZREMRANGEBYSCORE
 * in a MULTI block, count post-trim. Fails *open* if Redis is unreachable
 * — losing the cap is better than 500ing every request when Redis flakes.
 */

import { redis, RedisKeys } from "../shared/redis";
import { AppError } from "../shared/errors";

export interface RateLimitOptions {
  bucket: string; // e.g. "purchase", "login"
  windowMs: number;
  max: number;
  key: string; // pre-computed identifier (userId or IP)
}

export async function enforceRateLimit(opts: RateLimitOptions): Promise<void> {
  const now = Date.now();
  const cutoff = now - opts.windowMs;
  const k = RedisKeys.rateLimit(opts.bucket, opts.key);

  try {
    const m = redis.multi();
    m.zremrangebyscore(k, 0, cutoff);
    m.zadd(k, now, `${now}-${Math.random()}`);
    m.zcard(k);
    m.pexpire(k, opts.windowMs);
    const results = await m.exec();
    const card = results && results[2] ? Number(results[2][1]) : 0;
    if (card > opts.max) {
      throw new AppError("RATE_LIMITED");
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Redis down — fail open and log.
    console.warn("[rateLimit] redis error — failing open", (err as Error).message);
  }
}

export function clientIp(headers: Headers, fallback: string | null): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return fallback ?? "unknown";
}
