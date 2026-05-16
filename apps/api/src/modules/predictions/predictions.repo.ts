/**
 * Data access layer for the predictions microservice.
 * Pulls a compact context blob from audit_log + orders + events + items
 * and persists prediction_runs rows. Strictly no business logic here.
 */

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../../db/client";
import {
  predictionRuns,
  auditLog,
  orders,
  events,
  items,
  reservations,
  users,
} from "../../db/schema";

export type AggregatedContext = {
  generatedAt: string;
  lookbackDays: number;
  totals: {
    customers: number;
    orders: number;
    reservations: number;
    revenueCents: number;
  };
  hourlyOrders: Record<string, number>;
  weekdayOrders: Record<string, number>;
  conversion: {
    reservationsTotal: number;
    reservationsPaid: number;
    reservationsExpired: number;
    reservationsDeclined: number;
    rate: number;
  };
  extensions: { zero: number; one: number; two: number };
  paymentMethods: Record<string, number>;
  auditActionFrequency: Record<string, number>;
  topItems: { id: string; name: string; sold: number; revenueCents: number; priceCents: number }[];
  liveEvents: { id: string; name: string; goLiveAt: string; status: string }[];
  focus?: {
    eventId: string;
    name: string;
    status: string;
    goLiveAt: string;
    items: {
      id: string;
      name: string;
      priceCents: number;
      stock: number;
      reserved: number;
      sold: number;
    }[];
  };
};

export async function aggregateContext(
  opts: { eventId?: string; lookbackDays?: number } = {},
): Promise<AggregatedContext> {
  const lookbackDays = opts.lookbackDays ?? 30;
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  // Totals
  const [totals] = await db.execute<{
    customers: number;
    orders: number;
    reservations: number;
    revenue: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'customer')::int AS customers,
      (SELECT COUNT(*) FROM orders WHERE created_at >= ${since})::int AS orders,
      (SELECT COUNT(*) FROM reservations WHERE created_at >= ${since})::int AS reservations,
      COALESCE((SELECT SUM(price_paid_cents) FROM orders WHERE created_at >= ${since}), 0)::bigint AS revenue
  `) as any;

  // Hourly + weekday histograms
  const hourly = await db.execute<{ hour: number; c: number }>(sql`
    SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour,
           COUNT(*)::int AS c
      FROM orders
     WHERE created_at >= ${since}
     GROUP BY 1 ORDER BY 1
  `);
  const weekday = await db.execute<{ dow: number; c: number }>(sql`
    SELECT EXTRACT(DOW FROM created_at AT TIME ZONE 'UTC')::int AS dow,
           COUNT(*)::int AS c
      FROM orders
     WHERE created_at >= ${since}
     GROUP BY 1 ORDER BY 1
  `);
  const dowNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hourlyOrders = Object.fromEntries(
    (hourly as any[]).map((r) => [`${r.hour}:00`, Number(r.c)]),
  );
  const weekdayOrders = Object.fromEntries(
    (weekday as any[]).map((r) => [dowNames[Number(r.dow)] ?? `dow${r.dow}`, Number(r.c)]),
  );

  // Reservation conversion
  const resStats = await db.execute<{
    status: string;
    c: number;
  }>(sql`
    SELECT status::text AS status, COUNT(*)::int AS c
      FROM reservations
     WHERE created_at >= ${since}
     GROUP BY status
  `);
  let rTotal = 0,
    rPaid = 0,
    rExp = 0,
    rDecl = 0;
  for (const r of resStats as any[]) {
    rTotal += Number(r.c);
    if (r.status === "confirmed") rPaid += Number(r.c);
    else if (r.status === "expired") rExp += Number(r.c);
    else if (r.status === "declined" || r.status === "cancelled") rDecl += Number(r.c);
  }

  const extRows = await db.execute<{ used: number; c: number }>(sql`
    SELECT extensions_used::int AS used, COUNT(*)::int AS c
      FROM reservations
     WHERE created_at >= ${since}
     GROUP BY 1
  `);
  const extensions = { zero: 0, one: 0, two: 0 };
  for (const r of extRows as any[]) {
    if (r.used === 0) extensions.zero = Number(r.c);
    else if (r.used === 1) extensions.one = Number(r.c);
    else if (r.used === 2) extensions.two = Number(r.c);
  }

  const payRows = await db.execute<{ method: string; c: number }>(sql`
    SELECT payment_method::text AS method, COUNT(*)::int AS c
      FROM orders
     WHERE created_at >= ${since}
     GROUP BY 1
  `);
  const paymentMethods: Record<string, number> = {};
  for (const r of payRows as any[]) paymentMethods[r.method] = Number(r.c);

  const auditFreq = await db.execute<{ action: string; c: number }>(sql`
    SELECT action, COUNT(*)::int AS c
      FROM audit_log
     WHERE ts >= ${since}
     GROUP BY action
     ORDER BY c DESC
     LIMIT 20
  `);
  const auditActionFrequency: Record<string, number> = {};
  for (const r of auditFreq as any[]) auditActionFrequency[r.action] = Number(r.c);

  const topItems = await db.execute<{
    id: string;
    name: string;
    sold: number;
    revenue: number;
    price: number;
  }>(sql`
    SELECT i.id::text AS id, i.name, i.sold_count::int AS sold,
           (i.sold_count * i.unit_price_cents)::bigint AS revenue,
           i.unit_price_cents::int AS price
      FROM items i
      ORDER BY i.sold_count DESC
      LIMIT 5
  `);

  const liveEvents = await db.execute<{
    id: string;
    name: string;
    go_live_at: Date;
    status: string;
  }>(sql`
    SELECT id::text AS id, name, go_live_at, status::text AS status
      FROM events
      ORDER BY go_live_at DESC
      LIMIT 10
  `);

  const ctx: AggregatedContext = {
    generatedAt: new Date().toISOString(),
    lookbackDays,
    totals: {
      customers: Number((totals as any)?.customers ?? 0),
      orders: Number((totals as any)?.orders ?? 0),
      reservations: Number((totals as any)?.reservations ?? 0),
      revenueCents: Number((totals as any)?.revenue ?? 0),
    },
    hourlyOrders,
    weekdayOrders,
    conversion: {
      reservationsTotal: rTotal,
      reservationsPaid: rPaid,
      reservationsExpired: rExp,
      reservationsDeclined: rDecl,
      rate: rTotal === 0 ? 0 : Number((rPaid / rTotal).toFixed(3)),
    },
    extensions,
    paymentMethods,
    auditActionFrequency,
    topItems: (topItems as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      sold: Number(r.sold),
      revenueCents: Number(r.revenue),
      priceCents: Number(r.price),
    })),
    liveEvents: (liveEvents as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      goLiveAt: new Date(r.go_live_at).toISOString(),
      status: r.status,
    })),
  };

  if (opts.eventId) {
    const ev = await db
      .select()
      .from(events)
      .where(eq(events.id, opts.eventId))
      .limit(1);
    if (ev[0]) {
      const its = await db.select().from(items).where(eq(items.eventId, opts.eventId));
      ctx.focus = {
        eventId: ev[0].id,
        name: ev[0].name,
        status: ev[0].status,
        goLiveAt: ev[0].goLiveAt.toISOString(),
        items: its.map((i) => ({
          id: i.id,
          name: i.name,
          priceCents: i.unitPriceCents,
          stock: i.stockQuantity,
          reserved: i.reservedStock,
          sold: i.soldCount,
        })),
      };
    }
  }

  return ctx;
}

export async function insertRun(row: {
  question: any;
  requestedBy: string;
  eventId?: string | null;
  params: Record<string, unknown>;
  miroSimId: string;
}) {
  const [inserted] = await db
    .insert(predictionRuns)
    .values({
      question: row.question,
      status: "queued",
      requestedBy: row.requestedBy,
      eventId: row.eventId ?? null,
      params: row.params as any,
      miroSimId: row.miroSimId,
    })
    .returning();
  return inserted!;
}

export async function updateRun(
  id: string,
  patch: Partial<{
    status: any;
    miroRunId: string | null;
    brief: string | null;
    rawReport: unknown;
    resultJson: unknown;
    errorCode: string | null;
    finishedAt: Date | null;
  }>,
) {
  const [updated] = await db
    .update(predictionRuns)
    .set({
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.miroRunId !== undefined ? { miroRunId: patch.miroRunId } : {}),
      ...(patch.brief !== undefined ? { brief: patch.brief } : {}),
      ...(patch.rawReport !== undefined ? { rawReport: patch.rawReport as any } : {}),
      ...(patch.resultJson !== undefined ? { resultJson: patch.resultJson as any } : {}),
      ...(patch.errorCode !== undefined ? { errorCode: patch.errorCode } : {}),
      ...(patch.finishedAt !== undefined ? { finishedAt: patch.finishedAt } : {}),
    })
    .where(eq(predictionRuns.id, id))
    .returning();
  return updated!;
}

export async function getRun(id: string) {
  const [row] = await db.select().from(predictionRuns).where(eq(predictionRuns.id, id)).limit(1);
  return row ?? null;
}

export async function listRuns(limit = 20) {
  return db
    .select()
    .from(predictionRuns)
    .orderBy(desc(predictionRuns.startedAt))
    .limit(limit);
}
