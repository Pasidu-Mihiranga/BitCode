/**
 * Two Redis clients per process: one for normal commands, one dedicated to
 * Pub/Sub (the subscriber connection cannot be reused for issuing other
 * commands, per ioredis docs). Used by:
 *   - JWT blocklist (logout / password change) — `auth:blocklist:<jti>`
 *   - JWT generation counter for global blocklist — `auth:gen:<userId>`
 *   - Sliding-window rate limiter — `rl:<bucket>:<id>`
 *   - WebSocket fan-out — channel `stock:<eventId>` and `event:<eventId>`
 */

import Redis from "ioredis";

const url = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redis = new Redis(url, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

export const redisSub = new Redis(url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
});

export const redisPub = redis;

redis.on("error", (e) => console.error("[redis]", e.message));
redisSub.on("error", (e) => console.error("[redis:sub]", e.message));

export const RedisKeys = {
  jwtBlock: (jti: string) => `auth:blocklist:${jti}`,
  userGen: (userId: string) => `auth:gen:${userId}`,
  rateLimit: (bucket: string, id: string) => `rl:${bucket}:${id}`,
} as const;

export const RedisChannels = {
  stock: (eventId: string) => `stock:${eventId}`,
  event: (eventId: string) => `event:${eventId}`,
  audit: () => `audit:stream`,
} as const;
