# 3-Minute Demo Script

A tight walkthrough that hits every FR/NFR mark. Practice once; the order
below is built so the audit chain naturally accumulates rows you can show
at the end.

## 0:00 — Stack on screen (10 s)

Show the architecture diagram (`docs/architecture.svg`). Call out the
seven labelled edges (a → g). One sentence each:

> "Edge absorbs bursts. Atomic UPDATE locks stock. UNIQUE index blocks
> duplicates. Redis Pub/Sub fans real-time updates to both API replicas.
> Admin role is enforced in middleware. Every mutation goes through a
> hash-chained audit log. Route → Service → Repo enforces NFR-08."

## 0:10 — Register + verify (30 s)

1. Open `http://localhost:8080/register`, sign up as
   `judge@swiftdrop.local`.
2. Show login fails with `EMAIL_NOT_VERIFIED` and the **Resend** button.
3. Open `http://localhost:8025` (MailHog), click the verification link.
4. Login succeeds → land on `/events`.

## 0:40 — Buy → ATM extensions → mock pay (50 s)

1. Open the **Live Demo Drop** event. Note the green `100 left` badge.
2. Click **Buy now** on the sneakers item.
   - Modal appears with `60` countdown and "2 extensions remaining".
   - The badge instantly drops to `99 left` (broadcast over WS).
3. Click **+60s (2 left)** twice — both work, third is disabled.
4. Click **Confirm payment** → method picker (Card / UPI / Wallet / Net
   Banking).
5. Pick UPI → green checkmark animation → redirect to `/orders`.

## 1:30 — Show NFR-01 evidence (30 s)

In a second terminal:

```bash
docker compose exec postgres psql -U swiftdrop -d swiftdrop -c \
  "SELECT name, stock_quantity, reserved_stock, sold_count, (reserved_stock+sold_count) AS held FROM items;"
```

Point out that `held` is never greater than `stock_quantity` (NFR-01 — no
oversell). Then run the k6 report:

```bash
cat load-test/results/last-run.json | jq '.metrics.http_req_failed.values.rate, .metrics.purchase_reserve_ms.values["p(95)"]'
```

→ `< 0.01` and `< 2000` proves NFR-03 (no 5xx) and NFR-04 (p95 ≤ 2 s).

## 2:00 — Admin tour + audit chain tamper (40 s)

1. Log out, log back in as `admin@swiftdrop.local` (`Admin#12345`).
2. **Dashboard** → show the per-event sold units & revenue.
3. **System logs** → scroll the chain; click **Verify chain** → green
   `Chain integrity ✓ (N rows)`.
4. In a terminal:
   ```bash
   docker compose exec postgres psql -U swiftdrop -d swiftdrop -c \
     "UPDATE audit_log SET payload_json='{\"hacked\":true}' WHERE id=5;"
   ```
5. Click **Verify chain** again → red `BROKEN at id 5`. *That* is the
   "anomaly detection" feat2 promises.

## 2:40 — Wrap (20 s)

- Strict three-file modules in `apps/api/src/modules/*` enforce NFR-08
  (routes don't import drizzle-orm anywhere — `rg "from \"drizzle-orm\"" apps/api/src/modules/*/*.route.ts` returns zero hits).
- `apps/web/lib/messages.ts` mirrors `apps/api/src/shared/errors.ts` so
  every backend code maps to a friendly UI string (FR-P06).
- README documents `bun install && bun run seed && docker compose up`
  + MailHog URL + audit verify endpoint.

If asked: argon2id (`@node-rs/argon2`, m=19 MiB, t=2, p=1) replaces
bcrypt, and the purchase hot path never invokes it. That's why p95 ≤ 2 s
holds at 1000 VUs.
