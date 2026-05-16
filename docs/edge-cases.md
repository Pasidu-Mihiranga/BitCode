# Edge Cases → Code Paths

Every edge case the PRD calls out (§15) plus the ones introduced by the four
new features. Each row points to the *exact* file/function that handles it.

| # | Edge case | Where it's handled |
|---|-----------|--------------------|
| 1 | Two users buy the last unit | `apps/api/src/modules/purchase/purchase.repo.ts::tryReserveOneUnit` — single conditional UPDATE returns 0 rows to the loser → `purchase.service.ts` throws `ITEM_SOLD_OUT`. |
| 2 | Double-click / rapid retry on Buy | Frontend disables the button while waiting (`apps/web/app/events/[id]/page.tsx::buy`), backend has `uniq_active_reservation` UNIQUE partial index — second hit becomes `ALREADY_PURCHASED`. |
| 3 | Request at exact go-live | `purchase.service.ts::reserve` checks `event.status === 'live' AND go_live_at <= now()`. Auto-flip cron `events.service.ts::flipDueEventsLive` runs every 3 s. |
| 4 | Event closes mid-purchase | `purchase.service.ts::loadOwnedActive` re-checks reservation state before `extend / decline / confirm / pay`; admin `forceClose` broadcasts via `broadcastEvent` and existing holds expire naturally. |
| 5 | Reservation expires before payment | `purchase.expiry.ts::startExpirySweeper` runs `repo.sweepExpired` every 5 s, releases stock atomically, audits, and re-broadcasts the new available count. |
| 6 | **Customer needs more time (feat1)** | `purchase.service.ts::extend` → `tryExtendReservation` updates `extensions_used += 1` only if `< 2`. Third try → `EXTENSION_LIMIT_REACHED`. |
| 7 | **Customer declines payment (feat1 + demo-pay)** | `purchase.service.ts::decline` releases stock in TX, broadcasts WS update, audits as `purchase.decline`. |
| 8 | JWT expires mid-purchase | `middleware/auth.ts::verifyClaims` rejects with `TOKEN_EXPIRED`. Frontend treats `UNAUTHORIZED`/`TOKEN_EXPIRED` as redirect-to-login. |
| 9 | Logged-out user clicks Buy | `purchase.route.ts` is mounted behind `requireAuth`; returns `UNAUTHORIZED`. Frontend pushes to `/login`. |
| 10 | Deactivated user logs in | `auth.service.ts::login` calls `assertEmailVerified` which throws `ACCOUNT_DEACTIVATED`. |
| 11 | **Unverified email tries to log in (feat3)** | `auth.service.ts::login` → `assertEmailVerified` → `EMAIL_NOT_VERIFIED`. Login page shows a Resend button. |
| 12 | **Password-change link re-used (feat3)** | `email.service.ts::confirmPasswordChangeToken` checks `used_at IS NOT NULL` → `TOKEN_ALREADY_USED`. New tokens for the same `(user, purpose)` invalidate older ones in the same TX (`email.repo.ts::invalidatePending`). |
| 13 | **Password change after token applied** | `auth.service.ts::applyPasswordChange` bumps Redis `auth:gen:<userId>` → every outstanding JWT for that user fails the `gen` check on next request → forces re-login. |
| 14 | **Audit chain tampered (feat2)** | `POST /api/admin/audit/verify` runs `shared/audit.ts::verifyChain`, walks every row, returns `{ok:false, brokenAtId, reason}`. Admin UI badge turns red. Demo: `UPDATE audit_log SET payload_json = '{"hacked":true}' WHERE id = 5;` then click Verify. |
| 15 | **Malicious upload (image-sanitizer)** | `shared/imageSanitizer.ts`: file-type magic-byte sniff (SVG rejected explicitly), `sharp` re-encode (strips EXIF + drops malicious payloads), 5 MB output cap. Throws `INVALID_IMAGE` for `.exe`, `.svg`, oversize, or unreadable bytes. |
| 16 | Cover photo re-upload on live event | `events.service.ts::update` blocks when `status !== 'locked'` → `EVENT_NOT_EDITABLE`. |
| 17 | Auto sold-out (FR-M05) | After a successful `pay`, `purchase.service.ts::pay` calls `repo.eventAllItemsExhausted`. If true, `markEventSoldOut` + `broadcastEvent('sold_out')`. |
| 18 | Stock UPDATE wins but reservation INSERT loses (race vs UNIQUE) | `tryReserveOneUnit` runs inside a transaction with `insertReservation`. Postgres SQLSTATE `23505` (unique violation) → rollback (UPDATE undone) → `ALREADY_PURCHASED`. Stock is never left over-reserved. |
| 19 | Redis goes down | Rate limiter fails open (logged), JWT blocklist defaults to "allow" (loses logout enforcement until Redis recovers), WS clients reconnect with backoff. Postgres remains the source of truth so no orders are lost. |
| 20 | NGINX rate-limited request | NGINX returns structured JSON `{"error":{"code":"RATE_LIMITED",…}}` (custom 429). App layer also returns `RATE_LIMITED` if it slips past the edge. |
| 21 | Same user, multiple browser tabs | `uniq_active_reservation` UNIQUE partial index → only one active hold per (user,item,event). Second tab gets `ALREADY_PURCHASED` immediately. |
| 22 | Sweeper restart / clock skew | Sweeper is idempotent (`status='active'` filter). Setting `RUN_SWEEPER=false` on api2 means there's exactly one sweeper across replicas. |
| 23 | Email transport down | Verification falls back to MailHog; if MailHog is unreachable, the audit log records `email.verify.requested` with token prefix so judges can still recover the link. |
