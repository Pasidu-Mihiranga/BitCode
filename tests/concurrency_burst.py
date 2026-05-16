#!/usr/bin/env python3
"""
Concurrency burst utility for SwiftDrop NFR-03 / NFR-04 evidence.

Two modes:

  --auth-burst   N parallel POSTs to /api/auth/login with bad credentials.
                 Purpose: verify the rate-limit path returns structured 4xx,
                 never 5xx (NFR-03).

  --reserve-burst N parallel POSTs to /api/purchase/reserve as a logged-in
                 customer. Purpose: capture p50/p95/p99 latencies on the hot
                 path (NFR-04).

Output (stdout) is machine-greppable, e.g.:
    total=100
    2xx_count=0  4xx_count=92  5xx_count=0  429_count=8  err_count=0
    p50_ms=12.4  p95_ms=42.1   p99_ms=88.7

Pure stdlib — no extra deps.
"""
import argparse
import json
import statistics
import sys
import time
import urllib.request
import urllib.error
import http.cookiejar
from concurrent.futures import ThreadPoolExecutor, as_completed


def http_request(method, url, *, data=None, cookies=None, timeout=10):
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    if cookies:
        req.add_header("Cookie", cookies)
    body = data.encode() if isinstance(data, str) else data
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, body, timeout=timeout) as resp:
            elapsed = (time.perf_counter() - started) * 1000
            return resp.status, resp.read(), elapsed, dict(resp.headers)
    except urllib.error.HTTPError as e:
        elapsed = (time.perf_counter() - started) * 1000
        return e.code, e.read() if e.fp else b"", elapsed, dict(e.headers or {})
    except Exception as e:
        elapsed = (time.perf_counter() - started) * 1000
        return 0, str(e).encode(), elapsed, {}


def auth_burst(base, count):
    def one(_):
        return http_request(
            "POST",
            f"{base}/api/auth/login",
            data='{"email":"nope+%d@swiftdrop.local","password":"wrong"}' % time.time_ns(),
        )

    return run_concurrent(one, count)


def reserve_burst(base, count, cust_email, cust_pass):
    # 1) login once to get a cookie we can reuse across all threads.
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    body = json.dumps({"email": cust_email, "password": cust_pass}).encode()
    req = urllib.request.Request(
        f"{base}/api/auth/login", data=body, method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        opener.open(req, timeout=10).read()
    except Exception as e:
        print(f"login failed: {e}", file=sys.stderr)
        return [(0, b"", 0.0, {})] * count

    cookies = "; ".join(f"{c.name}={c.value}" for c in cj)

    # 2) pick a live item
    item_id = None
    try:
        with urllib.request.urlopen(f"{base}/api/events", timeout=10) as r:
            data = json.loads(r.read())
            for e in data.get("events", []):
                if e.get("status") == "live":
                    for it in e.get("items", []):
                        item_id = it["id"]
                        break
                    if item_id:
                        break
    except Exception as e:
        print(f"events fetch failed: {e}", file=sys.stderr)
    if not item_id:
        print("no live item found — cannot run reserve burst", file=sys.stderr)
        return [(0, b"", 0.0, {})] * count

    payload = json.dumps({"itemId": item_id})

    def one(_):
        return http_request(
            "POST",
            f"{base}/api/purchase/reserve",
            data=payload,
            cookies=cookies,
        )

    return run_concurrent(one, count)


def run_concurrent(fn, count):
    with ThreadPoolExecutor(max_workers=min(count, 200)) as ex:
        futs = [ex.submit(fn, i) for i in range(count)]
        results = [f.result() for f in as_completed(futs)]
    return results


def summarise(results):
    total = len(results)
    twos = sum(1 for s, *_ in results if 200 <= s < 300)
    fours = sum(1 for s, *_ in results if 400 <= s < 500)
    fives = sum(1 for s, *_ in results if 500 <= s < 600)
    rate_limited = sum(1 for s, *_ in results if s == 429)
    errs = sum(1 for s, *_ in results if s == 0)
    times = sorted([t for _, _, t, _ in results if t > 0])
    if times:
        p50 = statistics.median(times)
        p95 = times[int(len(times) * 0.95) - 1] if len(times) > 1 else times[0]
        p99 = times[int(len(times) * 0.99) - 1] if len(times) > 5 else times[-1]
    else:
        p50 = p95 = p99 = 0.0
    return total, twos, fours, fives, rate_limited, errs, p50, p95, p99


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8080")
    ap.add_argument("--count", type=int, default=100)
    ap.add_argument("--auth-burst", action="store_true")
    ap.add_argument("--reserve-burst", action="store_true")
    ap.add_argument("--cust-email", default="customer@swiftdrop.local")
    ap.add_argument("--cust-pass", default="Customer#12345")
    args = ap.parse_args()

    if args.auth_burst:
        results = auth_burst(args.base, args.count)
    elif args.reserve_burst:
        results = reserve_burst(args.base, args.count, args.cust_email, args.cust_pass)
    else:
        ap.error("pick --auth-burst or --reserve-burst")

    total, twos, fours, fives, rl, errs, p50, p95, p99 = summarise(results)
    print(f"total={total}")
    print(
        f"2xx_count={twos}  4xx_count={fours}  5xx_count={fives}  429_count={rl}  err_count={errs}"
    )
    print(f"p50_ms={p50:.1f}  p95_ms={p95:.1f}  p99_ms={p99:.1f}")


if __name__ == "__main__":
    main()
