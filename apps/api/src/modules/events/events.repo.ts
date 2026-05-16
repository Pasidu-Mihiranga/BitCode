/**
 * Events repo — events + items reads/writes for admin & dashboard.
 */

import { and, eq, sql, desc, lte, gte, count, inArray } from "drizzle-orm";
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
    .where(inArray(items.eventId, ids));
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

/** Admin KPIs: global totals, top SKUs, best-performing events (from confirmed orders). */
export async function adminAnalytics(exec: Exec = db) {
  const [totalsRow] = await exec
    .select({
      confirmedOrders: sql<number>`count(*)::int`,
      totalRevenueCents: sql<number>`coalesce(sum(${orders.pricePaidCents})::bigint, 0)::int`,
      totalUnitsSold: sql<number>`coalesce(sum(${orders.quantity})::bigint, 0)::int`,
    })
    .from(orders)
    .where(eq(orders.status, "confirmed"));

  const [{ eventsTotal }] = await exec.select({ eventsTotal: count() }).from(events);
  const [{ eventsLive }] = await exec
    .select({ eventsLive: count() })
    .from(events)
    .where(eq(events.status, "live"));

  const [{ uniqueItemsListed }] = await exec.select({ uniqueItemsListed: count() }).from(items);

  const topByUnits = await exec
    .select({
      itemId: items.id,
      itemName: items.name,
      eventId: events.id,
      eventName: events.name,
      unitsSold: sql<number>`coalesce(sum(${orders.quantity})::bigint, 0)::int`,
      revenueCents: sql<number>`coalesce(sum(${orders.pricePaidCents})::bigint, 0)::int`,
    })
    .from(orders)
    .innerJoin(items, eq(orders.itemId, items.id))
    .innerJoin(events, eq(orders.eventId, events.id))
    .where(eq(orders.status, "confirmed"))
    .groupBy(items.id, items.name, events.id, events.name)
    .orderBy(desc(sql`sum(${orders.quantity})`))
    .limit(10);

  const topByRevenue = await exec
    .select({
      itemId: items.id,
      itemName: items.name,
      eventId: events.id,
      eventName: events.name,
      unitsSold: sql<number>`coalesce(sum(${orders.quantity})::bigint, 0)::int`,
      revenueCents: sql<number>`coalesce(sum(${orders.pricePaidCents})::bigint, 0)::int`,
    })
    .from(orders)
    .innerJoin(items, eq(orders.itemId, items.id))
    .innerJoin(events, eq(orders.eventId, events.id))
    .where(eq(orders.status, "confirmed"))
    .groupBy(items.id, items.name, events.id, events.name)
    .orderBy(desc(sql`sum(${orders.pricePaidCents})`))
    .limit(10);

  const eventsByRevenue = await exec
    .select({
      eventId: events.id,
      eventName: events.name,
      status: events.status,
      revenueCents: sql<number>`coalesce(sum(${orders.pricePaidCents})::bigint, 0)::int`,
      unitsSold: sql<number>`coalesce(sum(${orders.quantity})::bigint, 0)::int`,
    })
    .from(orders)
    .innerJoin(events, eq(orders.eventId, events.id))
    .where(eq(orders.status, "confirmed"))
    .groupBy(events.id, events.name, events.status)
    .orderBy(desc(sql`sum(${orders.pricePaidCents})`))
    .limit(10);

  return {
    totals: {
      confirmedOrders: Number(totalsRow?.confirmedOrders ?? 0),
      totalRevenueCents: Number(totalsRow?.totalRevenueCents ?? 0),
      totalUnitsSold: Number(totalsRow?.totalUnitsSold ?? 0),
      eventsTotal: Number(eventsTotal),
      eventsLive: Number(eventsLive),
      uniqueItemsListed: Number(uniqueItemsListed),
    },
    topByUnits: topByUnits.map((r) => ({
      itemId: r.itemId,
      itemName: r.itemName,
      eventId: r.eventId,
      eventName: r.eventName,
      unitsSold: Number(r.unitsSold),
      revenueCents: Number(r.revenueCents),
    })),
    topByRevenue: topByRevenue.map((r) => ({
      itemId: r.itemId,
      itemName: r.itemName,
      eventId: r.eventId,
      eventName: r.eventName,
      unitsSold: Number(r.unitsSold),
      revenueCents: Number(r.revenueCents),
    })),
    eventsByRevenue: eventsByRevenue.map((r) => ({
      eventId: r.eventId,
      eventName: r.eventName,
      status: r.status,
      revenueCents: Number(r.revenueCents),
      unitsSold: Number(r.unitsSold),
    })),
  };
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
