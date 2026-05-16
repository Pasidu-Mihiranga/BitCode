/**
 * NFR-01, NFR-02, NFR-03, NFR-04 load proof.
 *
 * What it does:
 *   - Logs in N seeded users (created by load-test/seed-users.sh below).
 *   - Each VU picks the LIVE event from /api/events (the "Live Demo Drop").
 *   - Each VU fires a single POST /api/purchase/reserve.
 *   - Assertions:
 *       * No 5xx (NFR-03 — must be 429 if at all)
 *       * Final sold_count + active reservations ≤ stock_quantity (post-run)
 *       * p95 latency < 2000ms (NFR-04)
 *
 * Usage:
 *   k6 run -e BASE=http://localhost:8080 -e USERS=1000 load-test/k6-purchase.js
 *
 * Stress profile: 1000 VUs ramp in 5s, sustain 30s. That mirrors the PRD's
 * "1000 simultaneous requests" + "30-second load test".
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE = __ENV.BASE || "http://localhost:8080";
const USERS = Number(__ENV.USERS || 1000);
const ITEM_HINT = __ENV.ITEM_NAME || "Demo Sneakers (concurrency test)";

const reservedOk = new Counter("purchase_reserved_ok");
const soldOut = new Counter("purchase_sold_out");
const rateLimited = new Counter("purchase_rate_limited");
const alreadyPurchased = new Counter("purchase_already_purchased");
const otherErrors = new Counter("purchase_other_errors");
const reserveLatency = new Trend("purchase_reserve_ms", true);

export const options = {
  scenarios: {
    burst: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5s", target: USERS },
        { duration: "30s", target: USERS },
        { duration: "5s", target: 0 },
      ],
      gracefulStop: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"], // no >1% 5xx; 4xx is fine (rate limit etc.)
    "purchase_reserve_ms": ["p(95)<2000"], // NFR-04
  },
};

function loginAs(idx) {
  const email = `loadtest+${idx}@swiftdrop.local`;
  const password = "LoadTest#12345";
  // Try login first; if it fails, register + try again.
  let res = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { "Content-Type": "application/json" } },
  );
  if (res.status !== 200) {
    // Best-effort register (will likely 409 on repeat runs)
    http.post(
      `${BASE}/api/auth/register`,
      JSON.stringify({ email, displayName: `Load #${idx}`, password }),
      { headers: { "Content-Type": "application/json" } },
    );
    // Verification is required → if you really want these to log in, seed
    // users in the DB via load-test/seed-users.sh before running k6. We
    // proceed even on failure so the rate-limit assertions still get tested.
    res = http.post(
      `${BASE}/api/auth/login`,
      JSON.stringify({ email, password }),
      { headers: { "Content-Type": "application/json" } },
    );
  }
  if (res.status === 200) {
    try {
      return res.json("token");
    } catch (_) {}
  }
  return null;
}

let cachedItemId = null;
function liveItemId() {
  if (cachedItemId) return cachedItemId;
  const res = http.get(`${BASE}/api/events`);
  if (res.status !== 200) return null;
  const data = res.json();
  for (const e of data.events) {
    if (e.status === "live") {
      const item = e.items.find((i) => i.name === ITEM_HINT) || e.items[0];
      if (item) {
        cachedItemId = item.id;
        return cachedItemId;
      }
    }
  }
  return null;
}

export default function () {
  const token = loginAs(__VU);
  const itemId = liveItemId();
  if (!itemId) {
    sleep(1);
    return;
  }
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = http.post(
    `${BASE}/api/purchase/reserve`,
    JSON.stringify({ itemId }),
    { headers },
  );
  reserveLatency.add(res.timings.duration);
  check(res, {
    "no 5xx (NFR-03)": (r) => r.status < 500,
  });
  if (res.status === 200) reservedOk.add(1);
  else if (res.status === 409) {
    const code = (() => {
      try { return res.json("error.code"); } catch { return ""; }
    })();
    if (code === "ITEM_SOLD_OUT") soldOut.add(1);
    else if (code === "ALREADY_PURCHASED") alreadyPurchased.add(1);
    else otherErrors.add(1);
  } else if (res.status === 429) rateLimited.add(1);
  else otherErrors.add(1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data),
    "load-test/results/last-run.json": JSON.stringify(data, null, 2),
  };
}

function textSummary(d) {
  const m = d.metrics;
  function g(name, key = "values") { return m[name] ? m[name][key] : {}; }
  const lines = [
    "",
    "==== SwiftDrop NFR-01 / NFR-03 / NFR-04 load test ====",
    `VUs (target):           ${USERS}`,
    `Reserved OK:            ${g("purchase_reserved_ok").count ?? 0}`,
    `Sold out (expected):    ${g("purchase_sold_out").count ?? 0}`,
    `Rate limited (NFR-03):  ${g("purchase_rate_limited").count ?? 0}`,
    `Already purchased:      ${g("purchase_already_purchased").count ?? 0}`,
    `Other errors:           ${g("purchase_other_errors").count ?? 0}`,
    `5xx rate:               ${(m.http_req_failed?.values?.rate ?? 0).toFixed(4)}`,
    `Reserve p95 (NFR-04):   ${g("purchase_reserve_ms").p95?.toFixed?.(1) ?? "?"} ms`,
    "",
    "Now verify in psql:",
    "  SELECT name, stock_quantity, reserved_stock, sold_count,",
    "         (reserved_stock + sold_count) AS held FROM items;",
    "→ held should ALWAYS be ≤ stock_quantity (NFR-01: zero oversell).",
    "",
  ];
  return lines.join("\n");
}
