# Audit Chain (feat2) — Cryptographic IDs Without a Blockchain

> "Use blockchain cryptography to identify anomalies and show it as system
> logs in a separate tab to admin."

## What we actually built

A **tamper-evident hash-chained log** in Postgres. The same cryptographic
construction that Git commits, Merkle trees, and Bitcoin block headers use
for chain linkage — applied to a single-tenant audit table.

```
audit_log(
  id            BIGSERIAL PRIMARY KEY,
  ts            TIMESTAMPTZ DEFAULT now(),
  actor_user_id UUID NULL,
  action        TEXT NOT NULL,         -- e.g. "purchase.reserve"
  payload_json  JSONB NOT NULL,        -- the business diff
  payload_hash  TEXT NOT NULL,         -- SHA-256(canonical_json(payload_json))
  prev_hash     TEXT NULL,             -- entry_hash of the previous row (NULL on row 1)
  entry_hash    TEXT NOT NULL UNIQUE   -- SHA-256(prev_hash || ts || actor || action || payload_hash)
)
```

`shared/audit.ts::appendAudit(tx, …)` performs the insert. It:

1. Takes a Postgres advisory lock keyed `0xA1D17` so concurrent appends
   never race on the chain tip.
2. Reads the latest `entry_hash` as `prev_hash`.
3. Computes `payload_hash = SHA256(canonicalJSON(payload))`.
4. Computes
   `entry_hash = SHA256(prev_hash || "|" || tsISO || "|" || actor || "|" || action || "|" || payload_hash)`.
5. Inserts the new row in the *caller's* transaction so the business
   mutation and the audit row commit atomically (NFR-07).

## Why this isn't a blockchain

- **No consensus**: a single Postgres node owns the chain.
- **No P2P or peers**: we don't gossip the chain to anyone else.
- **No mining**: no proof of work, no nonces.
- **No on-chain currency**: not a thing.

What it *is*: a Merkle-style append-only chain that gives us
**tamper-evidence**. Any silent edit, deletion, or reorder of historical
rows produces a hash mismatch that propagates forward to every later row.

If a distributed/consensus property were ever required, the chain head
could be periodically anchored into a public blockchain (single transaction
per day). That's how systems like Chainpoint do it — but that's well out
of scope here.

## Verifying integrity

```
POST /api/admin/audit/verify
```

→ runs `shared/audit.ts::verifyChain()` which walks the whole table, row
by row, recomputes each hash, and returns either

```json
{ "ok": true, "total": 412 }
```

or

```json
{ "ok": false, "total": 412, "brokenAtId": 187, "reason": "payload tampered (payload_hash mismatch)" }
```

The admin UI calls this on a button press (`/admin/system-logs`).

## Tampering demo (for the live walkthrough)

```sql
-- Start: click "Verify" → green badge
UPDATE audit_log
   SET payload_json = '{"hacked":true}'
 WHERE id = 5;
-- Click "Verify" again → red badge, "BROKEN at id 5".
```

Restore by re-running the seed or simply re-issuing the original payload.

## What gets logged

Every **state-changing** service call. Read-only endpoints are *not*
logged so the chain stays meaningful (and cheap):

- `auth.register`, `auth.login`, `auth.logout`,
  `auth.passwordChange.initiated`, `auth.passwordChange.applied`
- `email.verify.requested`, `email.verify.confirmed`
- `event.create`, `event.update`, `event.forceOpen`, `event.forceClose`,
  `event.autoGoLive`, `event.autoSoldOut`
- `purchase.reserve`, `purchase.extend`, `purchase.decline`,
  `purchase.pay`, `purchase.expirySweep`
- `customer.deactivate`
- `profile.updateDisplayName`
- `seed.*` (first-boot only)

## Privacy

- **Never log raw secrets** — no plaintext passwords, no JWTs, no full
  image bytes. The image-upload audit entry records the filename + SHA-256,
  not the bytes.
- `payload_json` is intentionally the *diff* / context, not the entire
  table row. Example for `purchase.reserve`:
  `{ "reservationId": "...", "itemId": "...", "eventId": "..." }`.

## Hot-path cost

The expensive bit is the SHA-256 + advisory lock + index lookup. On
Postgres 16 + a hot table that costs roughly ~0.3–0.5 ms per insert under
the 1000-VU k6 burst. The audit insert runs inside the same transaction as
the business mutation, so the marginal latency is paid by the purchase
path — accepted because NFR-04 (p95 ≤ 2 s) leaves room and the integrity
benefit is high.
