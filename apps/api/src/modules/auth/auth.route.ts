/**
 * Auth route layer (HTTP only). No Drizzle, no business logic, no audit calls.
 *
 * Owns FR-A01 register, FR-A02 login, FR-A03 logout, FR-A06 change-password.
 */

import { Elysia } from "elysia";
import { jwtPlugin, requireAuth, signSession, SESSION_COOKIE } from "../../middleware/auth";
import { enforceRateLimit, clientIp } from "../../middleware/rateLimit";
import { RegisterBody, LoginBody, ChangePasswordBody } from "./auth.dto";
import * as service from "./auth.service";

const LOGIN_RATE_PER_MIN = Number(process.env.LOGIN_RATE_PER_MIN ?? 5);

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(jwtPlugin)
  // ---- Register (FR-A01) ----
  .post(
    "/register",
    async ({ body }) => {
      const out = await service.register(body);
      return {
        ok: true,
        userId: out.userId,
        message: "Account created. Check your email for the verification link.",
      };
    },
    { body: RegisterBody },
  )
  // ---- Login (FR-A02) ----
  .post(
    "/login",
    async ({ body, jwt, cookie, headers, server, request }) => {
      await enforceRateLimit({
        bucket: "login",
        windowMs: 60_000,
        max: LOGIN_RATE_PER_MIN,
        key: clientIp(headers, server?.requestIP(request)?.address ?? null),
      });
      const { userId, role } = await service.login(body);
      const { token, expSeconds } = await signSession(jwt, userId, role);
      cookie[SESSION_COOKIE]?.set({
        value: token,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: expSeconds,
        // secure: true in real prod
      });
      return { ok: true, token, role, userId };
    },
    { body: LoginBody },
  )
  // ---- Logout (FR-A03) ----
  .use(requireAuth)
  .post("/logout", async ({ currentUser, cookie }) => {
    const expSeconds = Math.max(0, currentUser.exp - Math.floor(Date.now() / 1000));
    await service.logout({
      userId: currentUser.id,
      jti: currentUser.jti,
      expSeconds,
    });
    cookie[SESSION_COOKIE]?.remove();
    return { ok: true };
  })
  // ---- Change password (FR-A06 + feat3) ----
  .post(
    "/change-password",
    async ({ body, currentUser }) => {
      await service.initiatePasswordChange({
        userId: currentUser.id,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
      });
      return {
        ok: true,
        message:
          "We sent a confirmation link to your inbox. Click it to apply the new password.",
      };
    },
    { body: ChangePasswordBody },
  )
  // ---- Whoami (for the frontend session check) ----
  .get("/me", async ({ currentUser }) => {
    const u = await service.findById(currentUser.id);
    if (!u) return { ok: false };
    return {
      ok: true,
      user: { id: u.id, email: u.email, displayName: u.displayName, role: u.role, status: u.status },
    };
  });
