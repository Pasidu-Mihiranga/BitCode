"use client";

import { Fragment, useEffect, useState } from "react";
import { api } from "@/lib/api";

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
    <section className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">System logs</h1>
          <p className="text-sm text-zinc-500">
            Tamper-evident SHA-256 hash chain. Every state change is recorded.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {verify && (
            <span
              className={
                verify.ok
                  ? "badge-live"
                  : "badge-sold-out"
              }
              title={!verify.ok ? `${verify.reason} at row ${verify.brokenAtId}` : undefined}
            >
              {verify.ok
                ? `Chain integrity ✓ (${verify.total} rows)`
                : `BROKEN at id ${verify.brokenAtId}: ${verify.reason}`}
            </span>
          )}
          <button onClick={runVerify} disabled={verifying} className="btn-primary">
            {verifying ? "Verifying…" : "Verify chain"}
          </button>
        </div>
      </header>

      <div className="flex items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Filter by action prefix (purchase, auth, event, …)"
          value={filter}
          onChange={(e) => {
            setPage(1);
            setFilter(e.target.value);
          }}
        />
        <span className="text-sm text-zinc-500">{total} entries</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Entry hash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr
                  className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50"
                  onClick={() => setExpanded((x) => (x === r.id ? null : r.id))}
                >
                  <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                  <td className="px-3 py-2 text-zinc-500">{new Date(r.ts).toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                    {r.actorUserId ? r.actorUserId.slice(0, 8) : "system"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                    {r.entryHash.slice(0, 16)}…
                  </td>
                </tr>
                {expanded === r.id && (
                  <tr className="bg-zinc-50">
                    <td colSpan={5} className="px-3 py-2">
                      <pre className="overflow-auto text-xs">{JSON.stringify(r.payloadJson, null, 2)}</pre>
                      <div className="mt-2 grid grid-cols-2 gap-3 font-mono text-xs text-zinc-500">
                        <div>
                          <div className="text-zinc-400">prev_hash</div>
                          <div className="break-all">{r.prevHash ?? "GENESIS"}</div>
                        </div>
                        <div>
                          <div className="text-zinc-400">payload_hash</div>
                          <div className="break-all">{r.payloadHash}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <button
          className="btn-ghost border border-zinc-200"
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          ← Prev
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button
          className="btn-ghost border border-zinc-200"
          disabled={page === pages}
          onClick={() => setPage((p) => Math.min(pages, p + 1))}
        >
          Next →
        </button>
      </div>
    </section>
  );
}
