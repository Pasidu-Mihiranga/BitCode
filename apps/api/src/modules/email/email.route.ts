/**
 * Email verification routes (feat3). HTTP layer only.
 */

import { Elysia, t } from "elysia";
import { enforceRateLimit, clientIp } from "../../middleware/rateLimit";
import * as service from "./email.service";

export const emailRoutes = new Elysia({ prefix: "/email" })
  // Click target from the verify email
  .get(
    "/verify",
    async ({ query }) => {
      const out = await service.verifyRegistrationToken(query.token);
      return { ok: true, userId: out.userId, message: "Email verified. You can log in now." };
    },
    { query: t.Object({ token: t.String({ minLength: 16, maxLength: 200 }) }) },
  )
  // Click target from the password-change email
  .get(
    "/confirm-password-change",
    async ({ query }) => {
      await service.confirmPasswordChangeToken(query.token);
      return {
        ok: true,
        message: "Password changed. Please log in with your new password.",
      };
    },
    { query: t.Object({ token: t.String({ minLength: 16, maxLength: 200 }) }) },
  )
  // Resend verification email — rate-limited per IP and per email.
  .post(
    "/resend",
    async ({ body, headers, request, server }) => {
      const ip = clientIp(headers, server?.requestIP(request)?.address ?? null);
      await enforceRateLimit({
        bucket: "email-resend-ip",
        windowMs: 60_000,
        max: 3,
        key: ip,
      });
      await enforceRateLimit({
        bucket: "email-resend",
        windowMs: 60_000,
        max: 1,
        key: body.email.toLowerCase(),
      });
      await service.resendRegistrationVerification(body.email);
      // Always 200 — never reveal whether the address exists.
      return { ok: true, message: "If the address is valid, a new verification email has been sent." };
    },
    {
      body: t.Object({ email: t.String({ format: "email", maxLength: 254 }) }),
    },
  );
