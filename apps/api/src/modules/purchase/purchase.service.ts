/**
 * Purchase service — FR-P01..P06 + feat1 + mock-payment.
 *
 * Owns the state machine:
 *     active ──extend──┐
 *        │            │ (≤ 2 times)
 *        ├──decline───┴─→ declined
 *        ├──expiry sweep ──→ expired
 *        └──confirm → (method picker) ──pay──→ confirmed (+ Order row)
 *
 * Every mutation goes through `withAudit` so the hash chain captures it.
 * Stock motion happens inside the same transaction as the audit insert.
 */

import { db } from "../../db/client";
import { AppError } from "../../shared/errors";
import { appendAudit, withAudit } from "../../shared/audit";
import { broadcastStock, broadcastEvent } from "../../ws/hub";
import * as repo from "./purchase.repo";

const RES_TTL = Number(process.env.RESERVATION_TTL_SECONDS ?? 60);
const MAX_EXT = Number(process.env.RESERVATION_MAX_EXTENSIONS ?? 2);

type Method = "card" | "upi" | "wallet" | "netbanking";
const VALID_METHODS = new Set<Method>(["card", "upi", "wallet", "netbanking"]);

export type ReservationView = {
  reservationId: string;
  itemId: string;
  eventId: string;
  status: string;
  expiresAt: string;
  extensionsUsed: number;
  extensionsRemaining: number;
  pricePaidCents?: number;
};

function viewOf(r: {
  id: string;
  itemId: string;
  eventId: string;
  status: string;
  expiresAt: Date;
  extensionsUsed: number;
}): ReservationView {
  return {
    reservationId: r.id,
    itemId: r.itemId,
    eventId: r.eventId,
    status: r.status,
    expiresAt: r.expiresAt.toISOString(),
    extensionsUsed: r.extensionsUsed,
    extensionsRemaining: Math.max(MAX_EXT - r.extensionsUsed, 0),
  };
}

async function broadcastItemStock(eventId: string, itemId: string): Promise<void> {
  const a = await repo.itemAvailability(itemId);
  if (!a) return;
  await broadcastStock(eventId, {
    itemId,
    available: a.available,
    reservedStock: a.reservedStock,
    soldCount: a.soldCount,
    stockQuantity: a.stockQuantity,
  });
}

/**
 * FR-P01 — Buy click. Atomic reserve. From the customer's perspective the
 * available count drops *immediately* because reserved_stock includes them.
 */
export async function reserve(args: {
  userId: string;
  itemId: string;
}): Promise<ReservationView> {
  const item = await repo.findItemById(args.itemId);
  if (!item) throw new AppError("ITEM_NOT_FOUND");

  const event = await repo.findEventById(item.eventId);
  if (!event) throw new AppError("EVENT_NOT_FOUND");
  if (event.status !== "live") throw new AppError("EVENT_NOT_LIVE");
  if (event.goLiveAt.getTime() > Date.now()) throw new AppError("EVENT_NOT_LIVE");

  // FR-P04 — pre-check for nice error; UNIQUE partial index is the backstop.
  if (await repo.hasConfirmedOrder(args.userId, args.itemId, item.eventId)) {
    throw new AppError("ALREADY_PURCHASED");
  }

  let createdView: ReservationView | null = null;
  try {
    createdView = await withAudit(
      args.userId,
      "purchase.reserve",
      (r) => ({
        reservationId: r.reservationId,
        itemId: r.itemId,
        eventId: r.eventId,
      }),
      async (tx) => {
        const updatedItem = await repo.tryReserveOneUnit(args.itemId, tx);
        if (!updatedItem) throw new AppError("ITEM_SOLD_OUT");
        const expiresAt = new Date(Date.now() + RES_TTL * 1000);
        const reservation = await repo.insertReservation(
          {
            userId: args.userId,
            eventId: item.eventId,
            itemId: args.itemId,
            expiresAt,
          },
          tx,
        );
        return viewOf(reservation);
      },
    );
  } catch (err) {
    // Unique-violation on the active-reservation partial index → user is
    // double-clicking before their previous hold expired.
    if ((err as { code?: string }).code === "23505") {
      throw new AppError("ALREADY_PURCHASED");
    }
    throw err;
  }

  await broadcastItemStock(item.eventId, args.itemId);
  return createdView;
}

async function loadOwnedActive(reservationId: string, userId: string) {
  const r = await repo.findReservationById(reservationId);
  if (!r) throw new AppError("RESERVATION_NOT_FOUND");
  if (r.userId !== userId) throw new AppError("RESERVATION_NOT_OWNED");
  if (r.status !== "active") throw new AppError("RESERVATION_NOT_ACTIVE");
  if (r.expiresAt.getTime() <= Date.now()) throw new AppError("RESERVATION_EXPIRED");
  return r;
}

/**
 * feat1 — Extend (ATM-style up to two times).
 */
export async function extend(args: {
  userId: string;
  reservationId: string;
}): Promise<ReservationView> {
  const current = await loadOwnedActive(args.reservationId, args.userId);
  if (current.extensionsUsed >= MAX_EXT) {
    throw new AppError("EXTENSION_LIMIT_REACHED");
  }
  const view = await withAudit(
    args.userId,
    "purchase.extend",
    (r) => ({ reservationId: r.reservationId, extensionsUsed: r.extensionsUsed }),
    async (tx) => {
      const updated = await repo.tryExtendReservation(args.reservationId, RES_TTL, tx);
      if (!updated) throw new AppError("EXTENSION_LIMIT_REACHED");
      return viewOf(updated);
    },
  );
  return view;
}

export async function decline(args: {
  userId: string;
  reservationId: string;
}): Promise<{ released: boolean }> {
  const r = await loadOwnedActive(args.reservationId, args.userId);
  await withAudit(
    args.userId,
    "purchase.decline",
    () => ({ reservationId: args.reservationId }),
    async (tx) => {
      const out = await repo.releaseStock(args.reservationId, "declined", tx);
      return out;
    },
  );
  await broadcastItemStock(r.eventId, r.itemId);
  return { released: true };
}

/**
 * Mock payment confirm step — returns the available methods. NO stock motion.
 */
export async function confirmStep(args: {
  userId: string;
  reservationId: string;
}): Promise<{ reservation: ReservationView; methods: Method[] }> {
  const r = await loadOwnedActive(args.reservationId, args.userId);
  return {
    reservation: viewOf(r),
    methods: ["card", "upi", "wallet", "netbanking"],
  };
}

/**
 * Mock payment finalisation. Always succeeds in this build. The README
 * explicitly notes this is the seam where Stripe/Razorpay would be wired in.
 */
export async function pay(args: {
  userId: string;
  reservationId: string;
  method: Method;
}): Promise<{
  orderId: string;
  pricePaidCents: number;
  method: Method;
  itemId: string;
  eventId: string;
}> {
  if (!VALID_METHODS.has(args.method)) throw new AppError("INVALID_PAYMENT_METHOD");
  const r = await loadOwnedActive(args.reservationId, args.userId);

  let result: { orderId: string; pricePaidCents: number; itemId: string; eventId: string };
  try {
    result = await withAudit(
      args.userId,
      "purchase.pay",
      (out) => ({
        reservationId: args.reservationId,
        orderId: out.orderId,
        method: args.method,
      }),
      async (tx) => {
        const { order, item } = await repo.finalisePayment(
          args.reservationId,
          args.method,
          tx,
        );
        return {
          orderId: order.id,
          pricePaidCents: order.pricePaidCents,
          itemId: item.id,
          eventId: item.eventId,
        };
      },
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      throw new AppError("ALREADY_PURCHASED");
    }
    throw err;
  }

  // Broadcast new stock and auto sold-out if needed
  await broadcastItemStock(result.eventId, result.itemId);
  if (await repo.eventAllItemsExhausted(result.eventId)) {
    await repo.markEventSoldOut(result.eventId);
    await broadcastEvent(result.eventId, { status: "sold_out", reason: "all_items_exhausted" });
    await db.transaction(async (tx) => {
      await appendAudit(tx, {
        actorUserId: args.userId,
        action: "event.autoSoldOut",
        payload: { eventId: result.eventId },
      });
    });
  }

  return {
    orderId: result.orderId,
    pricePaidCents: result.pricePaidCents,
    method: args.method,
    itemId: result.itemId,
    eventId: result.eventId,
  };
}
