/**
 * Marketplace repo — read-only, no audit (audit is for state changes only).
 */

import { eq, sql } from "drizzle-orm";
import { db, type DbTx } from "../../db/client";
import { events, items, type Event, type Item } from "../../db/schema";

type Exec = DbTx | typeof db;

export async function listEventsWithItems(
  exec: Exec = db,
): Promise<(Event & { items: (Item & { available: number })[] })[]> {
  const evts = await exec.select().from(events).orderBy(events.goLiveAt);
  if (evts.length === 0) return [];
  const ids = evts.map((e) => e.id);
  const its = await exec
    .select()
    .from(items)
    .where(sql`event_id = ANY(${ids})`);
  return evts.map((e) => ({
    ...e,
    items: its
      .filter((i) => i.eventId === e.id)
      .map((i) => ({
        ...i,
        available: Math.max(i.stockQuantity - i.reservedStock - i.soldCount, 0),
      })),
  }));
}

export async function findEvent(
  id: string,
  exec: Exec = db,
): Promise<(Event & { items: (Item & { available: number })[] }) | null> {
  const evt = await exec.select().from(events).where(eq(events.id, id)).limit(1);
  if (evt.length === 0) return null;
  const its = await exec.select().from(items).where(eq(items.eventId, id));
  return {
    ...evt[0]!,
    items: its.map((i) => ({
      ...i,
      available: Math.max(i.stockQuantity - i.reservedStock - i.soldCount, 0),
    })),
  };
}
