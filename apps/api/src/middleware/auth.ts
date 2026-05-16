/**
 * JWT auth + role middleware (FR-A04, FR-A05).
 *
 * Tokens carry { sub, role, gen, jti, iat, exp }. Two invalidation paths:
 *   - explicit logout → blocklist this jti in Redis until exp
 *   - password change → bump auth:gen:<userId>; tokens with stale `gen` fail
 *
 * Tokens come from either an `Authorization: Bearer ...` header (k6, curl)
 * or the `swiftdrop_session` httpOnly cookie (browser).
 */

import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { redis, RedisKeys } from "../shared/redis";
import { AppError } from "../shared/errors";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-secret-change-me-please";
const JWT_TTL = Number(process.env.JWT_TTL_SECONDS ?? 3600);
export const SESSION_COOKIE = "swiftdrop_session";

export type AuthClaims = {
  sub: string;
  role: "customer" | "admin";
  gen: number;
  jti: string;
  iat: number;
  exp: number;
};

export const jwtPlugin = jwt({
  name: "jwt",
  secret: JWT_SECRET,
  alg: "HS256",
});

async function readToken(headers: Headers, cookie: any): Promise<string | null> {
  const auth = headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const c = cookie?.[SESSION_COOKIE]?.value;
  return c ?? null;
}

export async function signSession(
  jwtSigner: { sign: (p: any) => Promise<string> },
  userId: string,
  role: "customer" | "admin",
): Promise<{ token: string; jti: string; gen: number; expSeconds: number }> {
  const gen = Number((await redis.get(RedisKeys.userGen(userId))) ?? 0);
  const jti = crypto.randomUUID();
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + JWT_TTL;
  const token = await jwtSigner.sign({ sub: userId, role, gen, jti, iat, exp });
  return { token, jti, gen, expSeconds: JWT_TTL };
}

async function verifyClaims(claims: AuthClaims | false | undefined): Promise<AuthClaims> {
  if (!claims) throw new AppError("UNAUTHORIZED");
  if (typeof claims.exp === "number" && Date.now() / 1000 > claims.exp) {
    throw new AppError("TOKEN_EXPIRED");
  }

  // Per-jti blocklist (explicit logout)
  const isBlocked = await redis.get(RedisKeys.jwtBlock(claims.jti));
  if (isBlocked) throw new AppError("TOKEN_EXPIRED");

  // Global per-user generation counter (password-change invalidation)
  const currentGen = Number((await redis.get(RedisKeys.userGen(claims.sub))) ?? 0);
  if (currentGen > claims.gen) throw new AppError("TOKEN_EXPIRED");

  return claims;
}

/**
 * `requireAuth` — gates a route group. Attaches `currentUser` to `store`.
 */
export const requireAuth = new Elysia({ name: "requireAuth" })
  .use(jwtPlugin)
  .derive({ as: "scoped" }, async ({ jwt, headers, cookie }) => {
    const token = await readToken(headers, cookie);
    if (!token) throw new AppError("UNAUTHORIZED");
    const claims = (await jwt.verify(token)) as AuthClaims | false;
    const verified = await verifyClaims(claims as AuthClaims | false);
    return {
      currentUser: { id: verified.sub, role: verified.role, jti: verified.jti, exp: verified.exp },
    };
  });

/**
 * `requireAdmin` — chain after `requireAuth` for admin-only routes (FR-A05).
 */
export const requireAdmin = new Elysia({ name: "requireAdmin" })
  .use(requireAuth)
  .onBeforeHandle(({ currentUser }) => {
    if (currentUser.role !== "admin") throw new AppError("FORBIDDEN");
  });
