/**
 * Background TTL sweeper (feat1). Releases stock for any reservation past
 * its expires_at. Runs in only ONE api replica (controlled by env
 * RUN_SWEEPER=true) to keep it singleton, even though the operation is
 * idempotent at the SQL level.
 */

import { db } from "../../db/client";
import { appendAudit } from "../../shared/audit";
import { broadcastStock } from "../../ws/hub";
import * as repo from "./purchase.repo";

const INTERVAL_MS = Number(process.env.RESERVATION_SWEEP_INTERVAL_MS ?? 5000);

let started = false;

export function startExpirySweeper(): void {
  if (started) return;
  if ((process.env.RUN_SWEEPER ?? "true") !== "true") return;
  started = true;
  setInterval(async () => {
    try {
      await sweepOnce();
    } catch (e) {
      console.error("[sweeper]", e);
    }
  }, INTERVAL_MS).unref?.();
  console.log(`[sweeper] started — every ${INTERVAL_MS}ms`);
}

async function sweepOnce(): Promise<void> {
  const expired = await db.transaction(async (tx) => {
    const rows = await repo.sweepExpired(tx);
    if (rows.length > 0) {
      await appendAudit(tx, {
        actorUserId: null,
        action: "purchase.expirySweep",
        payload: { count: rows.length, ids: rows.map((r) => r.id) },
      });
    }
    return rows;
  });

  // Re-broadcast availability for every affected (item,event).
  const seen = new Set<string>();
  for (const r of expired) {
    const key = `${r.eventId}:${r.itemId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const a = await repo.itemAvailability(r.itemId);
    if (!a) continue;
    await broadcastStock(r.eventId, {
      itemId: r.itemId,
      available: a.available,
      reservedStock: a.reservedStock,
      soldCount: a.soldCount,
      stockQuantity: a.stockQuantity,
    });
  }
}
