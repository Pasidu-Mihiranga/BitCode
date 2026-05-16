/**
 * feat2 — Hash-chained audit log.
 *
 *   entry_hash = SHA-256(prev_hash || ts || actor || action || payload_hash)
 *   payload_hash = SHA-256(canonical-json(payload))
 *
 * Same cryptographic construction Git/Bitcoin/Merkle trees use for block
 * linkage. Not a distributed blockchain — there's no consensus, no P2P, no
 * mining. The point is *tamper-evidence*: any silent edit to a historical
 * row propagates a mismatch forward and is caught by `/admin/audit/verify`.
 *
 * `withAudit(actor, action, payload, fn)` wraps a service call in a
 * transaction, performs the business mutation, then inserts the chained
 * audit entry. Business mutation and audit insert commit atomically (NFR-07).
 */

import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, type DbTx } from "../db/client";
import { auditLog } from "../db/schema";

function canonicalize(value: unknown): string {
  // Deterministic JSON: sort keys, drop undefined, never use NaN/Infinity.
  return JSON.stringify(value, function (_key, v) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v).sort()) sorted[k] = (v as any)[k];
      return sorted;
    }
    if (typeof v === "number" && !Number.isFinite(v)) return null;
    return v;
  });
}

function sha256Hex(...parts: string[]): string {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest("hex");
}

/**
 * Append a single audit row to an open transaction. Locks the chain tip via
 * advisory lock (cheaper than `FOR UPDATE` on bigserial) so concurrent
 * appends always observe the latest prev_hash.
 */
export async function appendAudit(
  tx: DbTx,
  params: {
    actorUserId: string | null;
    action: string;
    payload: unknown;
  },
): Promise<{ id: number; entryHash: string }> {
  // 0xA1D17 = "audit" — keep advisory-lock keys distinct per concern.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${0xa1d17})`);

  const tipRows = await tx.execute<{ entry_hash: string }>(
    sql`SELECT entry_hash FROM audit_log ORDER BY id DESC LIMIT 1`,
  );
  const prevHash =
    Array.isArray(tipRows) && tipRows[0] ? (tipRows[0] as any).entry_hash : null;

  const ts = new Date();
  const tsIso = ts.toISOString();
  const actor = params.actorUserId ?? "system";
  const payloadCanonical = canonicalize(params.payload ?? null);
  const payloadHash = sha256Hex(payloadCanonical);
  const entryHash = sha256Hex(
    prevHash ?? "GENESIS",
    "|",
    tsIso,
    "|",
    actor,
    "|",
    params.action,
    "|",
    payloadHash,
  );

  const inserted = await tx
    .insert(auditLog)
    .values({
      ts,
      actorUserId: params.actorUserId,
      action: params.action,
      payloadJson: (params.payload ?? null) as any,
      payloadHash,
      prevHash,
      entryHash,
    })
    .returning({ id: auditLog.id });

  return { id: inserted[0]!.id, entryHash };
}

/**
 * Convenience wrapper: open a transaction, run the business `fn`, then append
 * an audit entry **in the same transaction** so the business mutation and
 * the chain commit atomically.
 */
export async function withAudit<T>(
  actorUserId: string | null,
  action: string,
  buildPayload: (result: T) => unknown,
  fn: (tx: DbTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const result = await fn(tx);
    await appendAudit(tx, {
      actorUserId,
      action,
      payload: buildPayload(result),
    });
    return result;
  });
}

/**
 * Re-walk the chain end-to-end. O(N) but only invoked by an admin.
 * Returns the first row that fails verification, if any.
 */
export async function verifyChain(): Promise<
  | { ok: true; total: number }
  | { ok: false; total: number; brokenAtId: number; reason: string }
> {
  const rows = await db.execute<{
    id: number;
    ts: Date;
    actor_user_id: string | null;
    action: string;
    payload_json: unknown;
    payload_hash: string;
    prev_hash: string | null;
    entry_hash: string;
  }>(
    sql`SELECT id, ts, actor_user_id, action, payload_json, payload_hash, prev_hash, entry_hash
        FROM audit_log ORDER BY id ASC`,
  );

  let prev: string | null = null;
  let total = 0;
  for (const r of rows as any[]) {
    total++;
    if ((r.prev_hash ?? null) !== (prev ?? null)) {
      return {
        ok: false,
        total,
        brokenAtId: Number(r.id),
        reason: "prev_hash mismatch",
      };
    }
    const expectedPayloadHash = sha256Hex(canonicalize(r.payload_json));
    if (expectedPayloadHash !== r.payload_hash) {
      return {
        ok: false,
        total,
        brokenAtId: Number(r.id),
        reason: "payload tampered (payload_hash mismatch)",
      };
    }
    const expectedEntryHash = sha256Hex(
      prev ?? "GENESIS",
      "|",
      new Date(r.ts).toISOString(),
      "|",
      r.actor_user_id ?? "system",
      "|",
      r.action,
      "|",
      r.payload_hash,
    );
    if (expectedEntryHash !== r.entry_hash) {
      return {
        ok: false,
        total,
        brokenAtId: Number(r.id),
        reason: "entry_hash mismatch",
      };
    }
    prev = r.entry_hash;
  }
  return { ok: true, total };
}
