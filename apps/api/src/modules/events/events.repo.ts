/**
 * Events repo — events + items reads/writes for admin & dashboard.
 */

import { and, eq, sql, desc, lte, gte, count } from "drizzle-orm";
import { db, type DbTx } from "../../db/client";
import {
  events,
  items,
  orders,
  users,
  type Event,
  type Item,
  type NewEvent,
  type NewItem,
} from "../../db/schema";

type Exec = DbTx | typeof db;

export async function createEvent(
  data: NewEvent,
  exec: Exec = db,
): Promise<Event> {
  const rows = await exec.insert(events).values(data).returning();
  return rows[0]!;
}

export async function findEvent(id: string, exec: Exec = db): Promise<Event | null> {
  const rows = await exec.select().from(events).where(eq(events.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listEvents(
  exec: Exec = db,
): Promise<(Event & { items: Item[] })[]> {
  const evts = await exec.select().from(events).orderBy(desc(events.goLiveAt));
  if (evts.length === 0) return [];
  const ids = evts.map((e) => e.id);
  const its = await exec
    .select()
    .from(items)
    .where(sql`event_id = ANY(${ids})`);
  return evts.map((e) => ({
    ...e,
    items: its.filter((i) => i.eventId === e.id),
  }));
}

export async function updateEvent(
  id: string,
  patch: Partial<NewEvent>,
  exec: Exec = db,
): Promise<Event> {
  const rows = await exec
    .update(events)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(events.id, id))
    .returning();
  return rows[0]!;
}

export async function insertItems(
  rows: NewItem[],
  exec: Exec = db,
): Promise<Item[]> {
  return exec.insert(items).values(rows).returning();
}

export async function deleteItemsForEvent(
  eventId: string,
  exec: Exec = db,
): Promise<void> {
  await exec.delete(items).where(eq(items.eventId, eventId));
}

export async function flipLiveIfDue(exec: Exec = db): Promise<string[]> {
  const updated = await exec.execute<{ id: string }>(sql`
    UPDATE events SET status = 'live', updated_at = now()
     WHERE status = 'locked' AND go_live_at <= now()
    RETURNING id
  `);
  const rows = updated as unknown as { id: string }[];
  return rows.map((r) => r.id);
}

export async function setStatus(
  id: string,
  status: Event["status"],
  exec: Exec = db,
): Promise<Event> {
  const rows = await exec
    .update(events)
    .set({ status, updatedAt: new Date() })
    .where(eq(events.id, id))
    .returning();
  return rows[0]!;
}

/**
 * Admin dashboard data (FR-E05). Per-event totals of units sold + revenue,
 * plus per-item breakdown.
 */
export async function dashboard(exec: Exec = db) {
  const evts = await listEvents(exec);
  const orderRows = await exec
    .select({
      eventId: orders.eventId,
      itemId: orders.itemId,
      revenueCents: sql<number>`SUM(${orders.pricePaidCents})`,
      unitsSold: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .where(eq(orders.status, "confirmed"))
    .groupBy(orders.eventId, orders.itemId);

  return evts.map((e) => {
    const itemAgg = e.items.map((i) => {
      const o = orderRows.find((r) => r.itemId === i.id);
      return {
        ...i,
        unitsSold: Number(o?.unitsSold ?? 0),
        revenueCents: Number(o?.revenueCents ?? 0),
      };
    });
    const totalRevenue = itemAgg.reduce((s, x) => s + x.revenueCents, 0);
    const totalSold = itemAgg.reduce((s, x) => s + x.unitsSold, 0);
    return { ...e, items: itemAgg, totalRevenueCents: totalRevenue, totalUnitsSold: totalSold };
  });
}

export async function listCustomers(
  exec: Exec = db,
  page = 1,
  size = 20,
) {
  const offset = (page - 1) * size;
  const [rows, totalRow] = await Promise.all([
    exec
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        status: users.status,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.role, "customer"))
      .orderBy(desc(users.createdAt))
      .limit(size)
      .offset(offset),
    exec.select({ c: count() }).from(users).where(eq(users.role, "customer")),
  ]);
  return { page, size, total: Number(totalRow[0]?.c ?? 0), rows };
}
