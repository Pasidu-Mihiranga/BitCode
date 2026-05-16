/**
 * Purchase repo — all Drizzle queries for items / reservations / orders.
 *
 * The atomic reservation lives here as a raw conditional UPDATE so we can
 * read the row count directly and avoid any ORM abstraction surprise.
 */

import { and, eq, gt, sql } from "drizzle-orm";
import { db, type DbTx } from "../../db/client";
import {
  items,
  reservations,
  orders,
  events,
  type Item,
  type Reservation,
  type Order,
  type Event,
} from "../../db/schema";

type Exec = DbTx | typeof db;

export async function findItemById(id: string, exec: Exec = db): Promise<Item | null> {
  const rows = await exec.select().from(items).where(eq(items.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function findEventById(id: string, exec: Exec = db): Promise<Event | null> {
  const rows = await exec.select().from(events).where(eq(events.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function findReservationById(
  id: string,
  exec: Exec = db,
): Promise<Reservation | null> {
  const rows = await exec
    .select()
    .from(reservations)
    .where(eq(reservations.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Returns true iff this user already has a CONFIRMED order for (item,event).
 * Used as a pre-check for nicer error messages; the partial UNIQUE index is
 * the actual backstop.
 */
export async function hasConfirmedOrder(
  userId: string,
  itemId: string,
  eventId: string,
  exec: Exec = db,
): Promise<boolean> {
  const rows = await exec
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        eq(orders.itemId, itemId),
        eq(orders.eventId, eventId),
        eq(orders.status, "confirmed"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * THE atomic reservation step (NFR-01, NFR-07). Single SQL statement,
 * conditional UPDATE — no SELECT FOR UPDATE, no row-lock storm.
 *
 * Returns the post-update item row if the seat was secured, or null if the
 * caller lost the race (sold out from their perspective).
 */
export async function tryReserveOneUnit(
  itemId: string,
  exec: Exec = db,
): Promise<Item | null> {
  const result = await exec.execute<Item>(sql`
    UPDATE items
       SET reserved_stock = reserved_stock + 1,
           updated_at = now()
     WHERE id = ${itemId}
       AND (stock_quantity - reserved_stock - sold_count) >= 1
    RETURNING id, event_id AS "eventId", name, unit_price_cents AS "unitPriceCents",
              stock_quantity AS "stockQuantity", reserved_stock AS "reservedStock",
              sold_count AS "soldCount", created_at AS "createdAt", updated_at AS "updatedAt"
  `);
  const rows = result as unknown as Item[];
  return rows.length > 0 ? rows[0]! : null;
}

export async function insertReservation(
  data: {
    userId: string;
    eventId: string;
    itemId: string;
    expiresAt: Date;
  },
  exec: Exec = db,
): Promise<Reservation> {
  const rows = await exec
    .insert(reservations)
    .values({
      userId: data.userId,
      eventId: data.eventId,
      itemId: data.itemId,
      expiresAt: data.expiresAt,
      status: "active",
      extensionsUsed: 0,
    })
    .returning();
  return rows[0]!;
}

/**
 * Atomically extend an active reservation only if extensions_used < 2.
 * Returns the new row or null if the cap is reached / reservation isn't active.
 */
export async function tryExtendReservation(
  reservationId: string,
  ttlSeconds: number,
  exec: Exec = db,
): Promise<Reservation | null> {
  const result = await exec.execute<Reservation>(sql`
    UPDATE reservations
       SET extensions_used = extensions_used + 1,
           expires_at = now() + (${ttlSeconds} || ' seconds')::interval,
           updated_at = now()
     WHERE id = ${reservationId}
       AND status = 'active'
       AND extensions_used < 2
       AND expires_at > now()
    RETURNING id, user_id AS "userId", event_id AS "eventId", item_id AS "itemId",
              status, expires_at AS "expiresAt", extensions_used AS "extensionsUsed",
              payment_method AS "paymentMethod", created_at AS "createdAt",
              updated_at AS "updatedAt"
  `);
  const rows = result as unknown as Reservation[];
  return rows.length > 0 ? rows[0]! : null;
}

/**
 * Release stock + mark reservation in one transaction. Used by decline,
 * confirm-paid (after success), and the expiry sweeper.
 */
export async function releaseStock(
  reservationId: string,
  finalStatus: "declined" | "expired" | "cancelled",
  exec: Exec = db,
): Promise<{ released: boolean; itemId: string; eventId: string } | null> {
  const updated = await exec.execute<{ id: string; itemId: string; eventId: string }>(sql`
    UPDATE reservations
       SET status = ${finalStatus},
           updated_at = now()
     WHERE id = ${reservationId}
       AND status = 'active'
    RETURNING id, item_id AS "itemId", event_id AS "eventId"
  `);
  const rows = updated as unknown as { id: string; itemId: string; eventId: string }[];
  if (rows.length === 0) return null;
  const { itemId, eventId } = rows[0]!;
  await exec.execute(sql`
    UPDATE items
       SET reserved_stock = GREATEST(reserved_stock - 1, 0),
           updated_at = now()
     WHERE id = ${itemId}
  `);
  return { released: true, itemId, eventId };
}

/**
 * Finalise a confirmed payment: move 1 unit from reserved_stock to
 * sold_count, mark reservation confirmed, insert the order row. All in the
 * caller's transaction so the audit chain commits atomically.
 */
export async function finalisePayment(
  reservationId: string,
  paymentMethod: Reservation["paymentMethod"],
  exec: Exec = db,
): Promise<{ order: Order; item: Item }> {
  const rsRows = await exec
    .select()
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1);
  const reservation = rsRows[0];
  if (!reservation) {
    throw new Error("RESERVATION_GONE");
  }

  // Move 1 unit reserved -> sold; updated_at refresh
  const itemRes = await exec.execute<Item>(sql`
    UPDATE items
       SET reserved_stock = GREATEST(reserved_stock - 1, 0),
           sold_count = sold_count + 1,
           updated_at = now()
     WHERE id = ${reservation.itemId}
       AND reserved_stock >= 1
    RETURNING id, event_id AS "eventId", name, unit_price_cents AS "unitPriceCents",
              stock_quantity AS "stockQuantity", reserved_stock AS "reservedStock",
              sold_count AS "soldCount", created_at AS "createdAt", updated_at AS "updatedAt"
  `);
  const itemRows = itemRes as unknown as Item[];
  if (itemRows.length === 0) throw new Error("ITEM_INCONSISTENT");
  const item = itemRows[0]!;

  await exec
    .update(reservations)
    .set({
      status: "confirmed",
      paymentMethod: paymentMethod ?? null,
      updatedAt: new Date(),
    })
    .where(eq(reservations.id, reservationId));

  const inserted = await exec
    .insert(orders)
    .values({
      reservationId,
      userId: reservation.userId,
      eventId: reservation.eventId,
      itemId: reservation.itemId,
      quantity: 1,
      pricePaidCents: item.unitPriceCents,
      paymentMethod: paymentMethod!,
      status: "confirmed",
    })
    .returning();

  return { order: inserted[0]!, item };
}

/**
 * For the FR-M05 auto sold-out check after a successful pay.
 */
export async function eventAllItemsExhausted(
  eventId: string,
  exec: Exec = db,
): Promise<boolean> {
  const rows = await exec
    .select({
      remaining: sql<number>`SUM(GREATEST(stock_quantity - reserved_stock - sold_count, 0))`,
    })
    .from(items)
    .where(eq(items.eventId, eventId));
  return Number(rows[0]?.remaining ?? 0) === 0;
}

export async function markEventSoldOut(eventId: string, exec: Exec = db): Promise<void> {
  await exec
    .update(events)
    .set({ status: "sold_out", updatedAt: new Date() })
    .where(eq(events.id, eventId));
}

/**
 * Sweep expired reservations. Returns affected rows for downstream broadcast.
 */
export async function sweepExpired(
  exec: Exec = db,
): Promise<{ id: string; itemId: string; eventId: string }[]> {
  const updated = await exec.execute<{ id: string; itemId: string; eventId: string }>(sql`
    UPDATE reservations
       SET status = 'expired', updated_at = now()
     WHERE status = 'active' AND expires_at <= now()
    RETURNING id, item_id AS "itemId", event_id AS "eventId"
  `);
  const rows = updated as unknown as { id: string; itemId: string; eventId: string }[];
  for (const r of rows) {
    await exec.execute(sql`
      UPDATE items
         SET reserved_stock = GREATEST(reserved_stock - 1, 0),
             updated_at = now()
       WHERE id = ${r.itemId}
    `);
  }
  return rows;
}

export async function itemAvailability(
  itemId: string,
  exec: Exec = db,
): Promise<{ available: number; reservedStock: number; soldCount: number; stockQuantity: number; eventId: string } | null> {
  const it = await findItemById(itemId, exec);
  if (!it) return null;
  return {
    available: Math.max(it.stockQuantity - it.reservedStock - it.soldCount, 0),
    reservedStock: it.reservedStock,
    soldCount: it.soldCount,
    stockQuantity: it.stockQuantity,
    eventId: it.eventId,
  };
}
