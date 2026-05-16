"use client";

import { Fragment, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

type Entry = {
  id: number;
  ts: string;
  actorUserId: string | null;
  action: string;
  payloadJson: unknown;
  payloadHash: string;
  prevHash: string | null;
  entryHash: string;
};

type Verify =
  | { ok: true; total: number }
  | { ok: false; total: number; brokenAtId: number; reason: string };

function actionTone(action: string): string {
  if (action.startsWith("purchase")) return "text-accent-dark";
  if (action.startsWith("auth")) return "text-foreground";
  if (action.startsWith("event")) return "text-success";
  return "text-muted";
}

export default function SystemLogsPage() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const size = 50;
  const [filter, setFilter] = useState("");
  const [verify, setVerify] = useState<Verify | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  async function load() {
    const qs = new URLSearchParams({ page: String(page), size: String(size) });
    if (filter) qs.set("action", filter);
    const r = await api<{ ok: true; rows: Entry[]; total: number }>(
      `/api/admin/audit?${qs.toString()}`,
    );
    setRows(r.rows);
    setTotal(r.total);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter]);

  async function runVerify() {
    setVerifying(true);
    try {
      const r = await api<{ ok: true; result: Verify }>("/api/admin/audit/verify", {
        method: "POST",
      });
      setVerify(r.result);
    } finally {
      setVerifying(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / size));

  return (
    <section className="relative">
      <div
        className={
          "sticky top-0 z-20 -mx-4 border-b border-black/5 bg-surface/95 px-4 pb-5 pt-3 " +
          "shadow-[0_12px_28px_-16px_rgb(163_177_198_/_0.55)] backdrop-blur-md supports-[backdrop-filter]:bg-surface/88 " +
          "md:-mx-6 md:px-6"
        }
      >
        <div className="mb-4 h-1 w-10 rounded-full bg-accent shadow-neu-sm" aria-hidden />
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="page-title">System logs</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Tamper-evident SHA-256 hash chain. Every state change is recorded.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {verify && (
              <span
                className={verify.ok ? "badge-live" : "badge-sold-out"}
                title={!verify.ok ? `${verify.reason} at row ${verify.brokenAtId}` : undefined}
              >
                {verify.ok
                  ? `Chain integrity ✓ (${verify.total} rows)`
                  : `BROKEN at id ${verify.brokenAtId}: ${verify.reason}`}
              </span>
            )}
            <button type="button" onClick={runVerify} disabled={verifying} className="btn-primary">
              {verifying ? "Verifying…" : "Verify chain"}
            </button>
          </div>
        </header>
      </div>

      <div className="space-y-6 pt-6">
        <div className="card space-y-4 p-5 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            className="input max-w-md"
            placeholder="Filter by action prefix (purchase, auth, event, …)"
            value={filter}
            onChange={(e) => {
              setPage(1);
              setFilter(e.target.value);
            }}
          />
          <span className="text-sm font-medium text-muted">{total} entries</span>
        </div>

        <div className="table-wrap">
          <div className="overflow-x-auto">
            <table className="table-neu min-w-[640px]">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entry hash</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const open = expanded === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr
                        className={cn("table-neu-row", open && "shadow-neu-inset-sm")}
                        onClick={() => setExpanded((x) => (x === r.id ? null : r.id))}
                      >
                        <td className="font-mono text-xs font-semibold text-foreground">{r.id}</td>
                        <td className="text-muted">{new Date(r.ts).toLocaleString()}</td>
                        <td className="font-mono text-xs text-muted">
                          {r.actorUserId ? r.actorUserId.slice(0, 8) : "system"}
                        </td>
                        <td className={cn("font-mono text-xs font-medium", actionTone(r.action))}>
                          {r.action}
                        </td>
                        <td className="font-mono text-xs text-muted">
                          {r.entryHash.slice(0, 16)}…
                        </td>
                      </tr>
                      {open && (
                        <tr className="table-neu-detail">
                          <td colSpan={5} className="!border-t-0 px-4 py-4">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                              Payload
                            </p>
                            <pre className="code-block max-h-48">
                              {JSON.stringify(r.payloadJson, null, 2)}
                            </pre>
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                              <div className="demo-panel">
                                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                                  prev_hash
                                </div>
                                <div className="break-all font-mono text-xs text-foreground">
                                  {r.prevHash ?? "GENESIS"}
                                </div>
                              </div>
                              <div className="demo-panel">
                                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                                  payload_hash
                                </div>
                                <div className="break-all font-mono text-xs text-foreground">
                                  {r.payloadHash}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">No log entries match this filter.</p>
        )}

        <div className="flex flex-col items-center justify-between gap-3 border-t border-black/5 pt-4 sm:flex-row">
          <button
            type="button"
            className="btn-secondary w-full sm:w-auto"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Prev
          </button>
          <span className="text-sm font-medium text-muted">
            Page {page} of {pages}
          </span>
          <button
            type="button"
            className="btn-secondary w-full sm:w-auto"
            disabled={page === pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
          >
            Next →
          </button>
        </div>
        </div>
      </div>
    </section>
  );
}
