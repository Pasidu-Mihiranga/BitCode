import { and, desc, eq } from "drizzle-orm";
import { db, type DbTx } from "../../db/client";
import { events, items, orders, users } from "../../db/schema";

type Exec = DbTx | typeof db;

export async function ordersFor(userId: string, exec: Exec = db) {
  return exec
    .select({
      orderId: orders.id,
      createdAt: orders.createdAt,
      status: orders.status,
      quantity: orders.quantity,
      pricePaidCents: orders.pricePaidCents,
      paymentMethod: orders.paymentMethod,
      eventId: orders.eventId,
      eventName: events.name,
      itemId: orders.itemId,
      itemName: items.name,
    })
    .from(orders)
    .innerJoin(events, eq(orders.eventId, events.id))
    .innerJoin(items, eq(orders.itemId, items.id))
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
}

export async function updateDisplayName(
  userId: string,
  displayName: string,
  exec: Exec = db,
) {
  await exec
    .update(users)
    .set({ displayName, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
