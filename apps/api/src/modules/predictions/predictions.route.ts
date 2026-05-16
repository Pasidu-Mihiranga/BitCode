/**
 * Routing layer for the predictions microservice (admin only).
 * HTTP I/O only. All business logic lives in predictions.service.
 */

import { Elysia } from "elysia";
import { jwtPlugin, SESSION_COOKIE, type AuthClaims } from "../../middleware/auth";
import { headerGet } from "../../shared/headers";
import { AppError } from "../../shared/errors";
import { redis, RedisKeys } from "../../shared/redis";
import * as service from "./predictions.service";

const VALID_QUESTIONS = new Set([
  "best_go_live_time",
  "sell_through",
  "price_sensitivity",
  "conversion",
  "anomaly_summary",
  "next_drop",
]);

/**
 * Inline admin guard. Avoids an Elysia derive-scoping bug we hit with
 * .use(requireAdmin) + POST + JSON body — currentUser was reaching GET
 * handlers but disappearing on POST. Extracting the JWT ourselves is the
 * simplest stable fix.
 */
async function requireAdminUser(
  jwt: { verify: (t: string) => Promise<AuthClaims | false> },
  headers: any,
  cookie: any,
): Promise<{ id: string }> {
  const fromHeader = headerGet(headers, "authorization");
  const bearer =
    fromHeader && fromHeader.toLowerCase().startsWith("bearer ")
      ? fromHeader.slice(7).trim()
      : null;
  const fromCookie = cookie?.[SESSION_COOKIE]?.value;
  const token = bearer ?? fromCookie;
  if (!token) throw new AppError("UNAUTHORIZED");
  const claims = (await jwt.verify(token)) as AuthClaims | false;
  if (!claims) throw new AppError("UNAUTHORIZED");
  if (typeof claims.exp === "number" && Date.now() / 1000 > claims.exp) {
    throw new AppError("TOKEN_EXPIRED");
  }
  const isBlocked = await redis.get(RedisKeys.jwtBlock(claims.jti));
  if (isBlocked) throw new AppError("TOKEN_EXPIRED");
  const currentGen = Number((await redis.get(RedisKeys.userGen(claims.sub))) ?? 0);
  if (currentGen > claims.gen) throw new AppError("TOKEN_EXPIRED");
  if (claims.role !== "admin") throw new AppError("FORBIDDEN");
  return { id: claims.sub };
}

export const predictionsRoutes = new Elysia({ prefix: "/admin/predictions" })
  .use(jwtPlugin)
  .get("/health", async ({ jwt, headers, cookie }) => {
    await requireAdminUser(jwt, headers, cookie);
    return { ok: true, ...(await service.health()) };
  })
  .post("/run", async ({ jwt, headers, cookie, body }) => {
    const user = await requireAdminUser(jwt, headers, cookie);
    const b = (body ?? {}) as any;
    if (!b.question || !VALID_QUESTIONS.has(b.question)) {
      throw new AppError("VALIDATION_ERROR", "question is required");
    }
    const { runId } = await service.kickoff({
      question: b.question,
      eventId: b.eventId,
      params: b.params ?? {},
      requestedBy: user.id,
    });
    return { ok: true, runId };
  })
  .get("/:id", async ({ jwt, headers, cookie, params }) => {
    await requireAdminUser(jwt, headers, cookie);
    const r = await service.get(params.id);
    return { ok: true, run: r };
  })
  .get("/", async ({ jwt, headers, cookie }) => {
    await requireAdminUser(jwt, headers, cookie);
    const rows = await service.list();
    return { ok: true, runs: rows };
  });
