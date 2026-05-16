# SwiftDrop — Flash Sale Platform

A locally-deployable flash-sale platform built for the BitCode 5-hour
challenge. Implements every FR/NFR from the PRD plus four custom features:

- **feat1** — Click Buy → immediate stock deduction → 60 s timer with up to
  2 ATM-style extensions → mock payment.
- **feat2** — Every state-changing call is recorded in a SHA-256
  hash-chained audit log; admin UI has a one-click integrity verifier.
- **feat3** — SMTP email verification on register + confirmation email on
  password change (MailHog locally).
- **feat4** — Argon2id (OWASP 2024 params) replaces bcrypt.

## Architecture at a glance

![architecture](docs/architecture.svg)

- **API** — Bun + Elysia + Drizzle, behind NGINX with two replicas.
- **DB** — PostgreSQL 16. Atomic conditional `UPDATE` does the reservation;
  UNIQUE partial indexes are the duplicate-purchase backstop.
- **Cache / Pub-Sub** — Redis 7. WebSocket fan-out across replicas, JWT
  blocklist on logout, sliding-window rate limiter.
- **Realtime** — Elysia native WebSocket + Redis Pub/Sub.
- **Frontend** — Next.js 15 (App Router) + Tailwind + Framer Motion.
- **Mail** — MailHog (`http://localhost:8025`) for the demo.

The full architecture write-up is in [`docs/architecture.svg`](docs/architecture.svg)
and the cryptographic audit-chain design in [`docs/audit-chain.md`](docs/audit-chain.md).

## Quick start

```bash
# 1. Copy env (the defaults already work for the docker-compose stack)
cp .env.example .env

# 2. Build and bring up the stack (api×2, web, postgres, redis, mailhog, nginx)
docker compose build
docker compose up -d

# 3. Push the schema and seed test data
docker compose exec api1 bun run db:push
docker compose exec api1 bun run seed
```

App URLs:

| URL                               | What                                    |
|-----------------------------------|-----------------------------------------|
| `http://localhost:8080`           | Customer + admin UI (Next.js via NGINX) |
| `http://localhost:8080/api/docs`  | Swagger (Elysia)                        |
| `http://localhost:8080/api/health`| Health check (reports `instance: api1/api2`) |
| `http://localhost:8025`           | MailHog inbox (verification + password-change emails) |

Default seeded accounts (override via env in `.env`):

- Admin: `admin@swiftdrop.local` / `Admin#12345`
- Customer (verified): `customer@swiftdrop.local` / `Customer#12345`

## Demo flow

The full 3-minute script is in [`docs/demo-script.md`](docs/demo-script.md).
TL;DR:

1. Register → MailHog → click verify link → login.
2. Open the **Live Demo Drop** event → Buy → modal counts down → Extend
   twice → Confirm payment → pick method → success animation → /orders.
3. Login as admin → Dashboard, System Logs.
4. Tamper a row in `audit_log`, click **Verify chain** → red badge with
   `brokenAtId`.

## Layout

```
.
├─ apps/
│  ├─ api/                  # Elysia + Drizzle (route → service → repo)
│  │  └─ src/
│  │     ├─ db/             # Drizzle schema + client
│  │     ├─ shared/         # hash (argon2id), audit chain, mailer,
│  │     │                  # imageSanitizer, errors, redis
│  │     ├─ middleware/     # auth, rate limit, error handler
│  │     ├─ modules/
│  │     │  ├─ auth/        # FR-A01..A06 (+ feat3, feat4)
│  │     │  ├─ email/       # feat3 verify + password-change links
│  │     │  ├─ events/      # FR-E01..E06 (+ image sanitizer)
│  │     │  ├─ marketplace/ # FR-M01..M05
│  │     │  ├─ purchase/    # FR-P01..P06 + feat1 + mock payment
│  │     │  ├─ profile/     # FR-O01..O03
│  │     │  └─ audit/       # feat2 admin endpoints
│  │     ├─ ws/             # WebSocket hub (Redis Pub/Sub backed)
│  │     ├─ index.ts        # bootstrap + cron + sweeper
│  │     └─ seed.ts         # 1 admin + 1 customer + 1 locked + 1 live event
│  └─ web/                  # Next.js 15 (App Router)
│     ├─ app/(public)       # /events, /events/[id], /orders, /login, /register
│     └─ app/admin/         # /dashboard, /events/new, /customers, /system-logs
├─ nginx/nginx.conf         # LB + limit_req_zone + WS upgrade
├─ docker-compose.yml       # api×2, web, postgres, redis, mailhog, nginx
├─ load-test/
│  ├─ k6-purchase.js        # NFR-01/03/04 evidence
│  └─ seed-users.sh         # bulk-seed N pre-verified users for k6
├─ docs/
│  ├─ architecture.svg
│  ├─ edge-cases.md
│  ├─ audit-chain.md
│  └─ demo-script.md
└─ uploads/                 # served by NGINX at /uploads/ (sanitized images)
```

The strict three-file `<module>/<module>.{route,service,repo}.ts` pattern
is how NFR-08 is enforced. Routes never `import` from `drizzle-orm` or
`db/`. Quick check:

```bash
rg "from \"drizzle-orm\"" apps/api/src/modules/*/*.route.ts || echo "clean"
```

## NFR ↔ implementation map

| NFR | Where |
|-----|-------|
| NFR-01 zero oversell | `purchase.repo.ts::tryReserveOneUnit` + `items_sold_plus_reserved_cap` CHECK + UNIQUE partial index on confirmed orders. Verified by `load-test/k6-purchase.js`. |
| NFR-02 ≥ 2 replicas | `docker-compose.yml` services `api1` + `api2`, NGINX `least_conn` upstream. |
| NFR-03 rate limiting | NGINX `limit_req_zone` for purchase/auth + Redis sliding-window in `middleware/rateLimit.ts`. Returns structured 429. |
| NFR-04 p95 ≤ 2 s | k6 threshold `purchase_reserve_ms p(95) < 2000`. Login is rate-limited so argon2id never bottlenecks the purchase path. |
| NFR-05 password security | argon2id via `@node-rs/argon2` (m=19 MiB, t=2, p=1); JWT HS256 in httpOnly cookie. |
| NFR-06 structured errors | Single `middleware/errorHandler.ts` returns `{error:{code,message,requestId}}`; codes shared with the UI via `lib/messages.ts`. |
| NFR-07 transactional integrity | Every state change runs inside `db.transaction`; `withAudit` writes the chain row in the same TX. |
| NFR-08 layering | Strict `route → service → repo` files per module; routes import nothing from `drizzle-orm`. |
| NFR-09 README + seed | This file + `bun run seed` + MailHog at `:8025` + the System Logs Verify button. |

## Running the load test

```bash
# (one-time) seed 1000 pre-verified load-test users so the auth rate-limiter
# doesn't reject your VUs at /api/auth/login
N=1000 ./load-test/seed-users.sh

# Run k6 against NGINX
k6 run -e BASE=http://localhost:8080 -e USERS=1000 load-test/k6-purchase.js
```

Output `load-test/results/last-run.json` ships with the repo as the
evidence screenshot.

## Common operations

```bash
# Apply schema changes during dev
docker compose exec api1 bun run db:push

# Tail API logs
docker compose logs -f api1 api2

# Open psql
docker compose exec postgres psql -U swiftdrop -d swiftdrop

# Watch the audit chain grow live
docker compose exec postgres psql -U swiftdrop -d swiftdrop -c \
  "SELECT id, ts, action, substr(entry_hash,1,12) AS hash FROM audit_log ORDER BY id DESC LIMIT 20;"

# Tamper + verify
docker compose exec postgres psql -U swiftdrop -d swiftdrop -c \
  "UPDATE audit_log SET payload_json='{\"hacked\":true}' WHERE id=5;"
curl -s -X POST -b cookies.txt http://localhost:8080/api/admin/audit/verify | jq
```

## Notes & caveats

- **No real payment gateway is integrated**. `/api/purchase/:id/pay` is the
  seam where Stripe / Razorpay / etc. would plug in.
- **`drizzle-kit push --force`** is used instead of full migrations to
  save build time. For production you'd add `drizzle-kit generate` runs.
- **MailHog is the only SMTP transport configured**. Swap `SMTP_*` env
  vars to point at a real SMTP relay for non-local use.
- **Sharp + N-API on Bun** works on Bun 1.1+ on Linux. If you hit a Sharp
  load error on macOS, set `BUN_INSTALL_NATIVE=true` and reinstall.
