/**
 * Purchase routes — HTTP only. FR-P01 reserve, FR-P03 extend/decline/
 * confirm/pay. App-layer rate limiter is applied per-user (or per-IP if
 * un-authed which shouldn't happen because requireAuth runs first).
 */

import { Elysia, t } from "elysia";
import { requireAuth } from "../../middleware/auth";
import { enforceRateLimit, clientIp } from "../../middleware/rateLimit";
import * as service from "./purchase.service";

const PURCHASE_RATE = Number(process.env.PURCHASE_RATE_PER_MIN ?? 30);

const ReserveBody = t.Object({ itemId: t.String({ minLength: 8, maxLength: 80 }) });
const ResIdParam = t.Object({ id: t.String({ minLength: 8, maxLength: 80 }) });
const PayBody = t.Object({
  method: t.Union([
    t.Literal("card"),
    t.Literal("upi"),
    t.Literal("wallet"),
    t.Literal("netbanking"),
  ]),
});

export const purchaseRoutes = new Elysia({ prefix: "/purchase" })
  .use(requireAuth)
  .onBeforeHandle(async ({ currentUser, headers, request, server }) => {
    const ip = clientIp(headers, server?.requestIP(request)?.address ?? null);
    await enforceRateLimit({
      bucket: "purchase",
      windowMs: 60_000,
      max: PURCHASE_RATE,
      key: `${currentUser.id}|${ip}`,
    });
  })
  // FR-P01 — Buy click → immediate deduct (feat1)
  .post(
    "/reserve",
    async ({ body, currentUser }) => {
      const view = await service.reserve({ userId: currentUser.id, itemId: body.itemId });
      return { ok: true, reservation: view };
    },
    { body: ReserveBody },
  )
  // feat1 — Extend timer (max 2)
  .post(
    "/:id/extend",
    async ({ params, currentUser }) => {
      const view = await service.extend({ userId: currentUser.id, reservationId: params.id });
      return { ok: true, reservation: view };
    },
    { params: ResIdParam },
  )
  // feat1 — Decline; releases stock
  .post(
    "/:id/decline",
    async ({ params, currentUser }) => {
      const out = await service.decline({ userId: currentUser.id, reservationId: params.id });
      return { ok: true, ...out };
    },
    { params: ResIdParam },
  )
  // Mock payment — returns method picker
  .post(
    "/:id/confirm",
    async ({ params, currentUser }) => {
      const out = await service.confirmStep({
        userId: currentUser.id,
        reservationId: params.id,
      });
      return { ok: true, ...out };
    },
    { params: ResIdParam },
  )
  // Mock payment — finalise (always succeeds in this build)
  .post(
    "/:id/pay",
    async ({ params, body, currentUser }) => {
      const out = await service.pay({
        userId: currentUser.id,
        reservationId: params.id,
        method: body.method,
      });
      return { ok: true, order: out };
    },
    { params: ResIdParam, body: PayBody },
  );
