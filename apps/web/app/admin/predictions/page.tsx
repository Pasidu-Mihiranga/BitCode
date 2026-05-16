"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";

type Question =
  | "best_go_live_time"
  | "sell_through"
  | "price_sensitivity"
  | "conversion"
  | "anomaly_summary"
  | "next_drop";

const QUESTIONS: { id: Question; title: string; blurb: string; needsEvent?: boolean; needsShift?: boolean }[] = [
  {
    id: "best_go_live_time",
    title: "Best go-live time",
    blurb: "When should the next drop start to maximise conversion?",
  },
  {
    id: "sell_through",
    title: "Predicted sell-through",
    blurb: "Sell-through % and time-to-sellout for a specific event.",
    needsEvent: true,
  },
  {
    id: "price_sensitivity",
    title: "Price sensitivity",
    blurb: "Impact on units & revenue if price shifts by N%.",
    needsEvent: true,
    needsShift: true,
  },
  {
    id: "conversion",
    title: "Conversion rate",
    blurb: "Predicted reservation → pay conversion for an event.",
    needsEvent: true,
  },
  {
    id: "anomaly_summary",
    title: "Anomaly summary",
    blurb: "What actions in the audit chain look unusual lately?",
  },
  {
    id: "next_drop",
    title: "Next drop suggestion",
    blurb: "Category, price band, and timing to maximise revenue.",
  },
];

type EventOption = { id: string; name: string; status: string; goLiveAt: string };
type Run = {
  id: string;
  question: Question;
  status: "queued" | "running_sim" | "analysing" | "done" | "failed";
  eventId: string | null;
  miroSimId: string;
  miroRunId: string | null;
  brief: string | null;
  resultJson: {
    headline?: string;
    insight?: string;
    recommendations?: string[];
    confidence?: number;
  } | null;
  rawReport: any;
  errorCode: string | null;
  startedAt: string;
  finishedAt: string | null;
  params: Record<string, unknown>;
};

export default function AdminPredictionsPage() {
  const [question, setQuestion] = useState<Question>("best_go_live_time");
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [shiftPct, setShiftPct] = useState<number>(0);
  const [running, setRunning] = useState<Run | null>(null);
  const [history, setHistory] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<{
    mirofish: { ok: boolean; reason?: string; base: string };
    gemini: { ok: boolean; model: string };
  } | null>(null);

  const selected = useMemo(() => QUESTIONS.find((q) => q.id === question)!, [question]);

  async function loadEvents() {
    try {
      const r = await api<{ ok: true; events: EventOption[] }>("/api/admin/dashboard");
      setEvents(r.events);
      if (r.events.length && !eventId) setEventId(r.events[0].id);
    } catch {
      // dashboard may need admin login — that's fine
    }
  }

  async function loadHealth() {
    try {
      const r = await api<{ ok: true; mirofish: any; gemini: any }>(
        "/api/admin/predictions/health",
      );
      setHealth({ mirofish: r.mirofish, gemini: r.gemini });
    } catch {
      setHealth(null);
    }
  }

  async function loadHistory() {
    try {
      const r = await api<{ ok: true; runs: Run[] }>("/api/admin/predictions");
      setHistory(r.runs);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadEvents();
    loadHealth();
    loadHistory();
  }, []);

  async function startRun() {
    setError(null);
    try {
      const params: Record<string, unknown> = {};
      if (selected.needsShift) params.shiftPct = shiftPct;
      const body: any = { question };
      if (selected.needsEvent && eventId) body.eventId = eventId;
      if (Object.keys(params).length) body.params = params;
      const r = await api<{ ok: true; runId: string }>("/api/admin/predictions/run", {
        method: "POST",
        body: JSON.stringify(body),
      });
      pollRun(r.runId);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    }
  }

  async function pollRun(runId: string) {
    setRunning({
      id: runId,
      question,
      status: "queued",
      eventId: eventId || null,
      miroSimId: "",
      miroRunId: null,
      brief: null,
      resultJson: null,
      rawReport: null,
      errorCode: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      params: {},
    });
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      try {
        const r = await api<{ ok: true; run: Run }>(`/api/admin/predictions/${runId}`);
        setRunning(r.run);
        if (r.run.status === "done" || r.run.status === "failed") {
          loadHistory();
          return;
        }
      } catch (e: any) {
        setError(e instanceof ApiError ? e.message : (e as Error).message);
        return;
      }
      await new Promise((res) => setTimeout(res, 1500));
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Predictions</h1>
          <p className="text-sm text-muted">
            MiroFish swarm simulation, orchestrated by Gemini, fed by the
            hash-chained audit log.
          </p>
        </div>
        <HealthBadges health={health} />
      </header>

      {/* Question picker */}
      <div className="grid gap-3 md:grid-cols-3">
        {QUESTIONS.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setQuestion(q.id)}
            className={
              "card p-4 text-left transition " +
              (question === q.id
                ? "ring-2 ring-accent shadow-neu"
                : "hover:shadow-neu")
            }
          >
            <h3 className="font-semibold">{q.title}</h3>
            <p className="mt-1 text-xs text-muted">{q.blurb}</p>
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="card space-y-3 p-4">
        {selected.needsEvent && (
          <div>
            <label className="label">Event</label>
            <select
              className="input"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            >
              <option value="">— pick an event —</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.status})
                </option>
              ))}
            </select>
          </div>
        )}
        {selected.needsShift && (
          <div>
            <label className="label">Price shift</label>
            <input
              type="range"
              min={-30}
              max={30}
              step={1}
              value={shiftPct}
              onChange={(e) => setShiftPct(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-sm text-muted">{shiftPct >= 0 ? "+" : ""}{shiftPct}%</p>
          </div>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button onClick={startRun} className="btn-primary">
          Run prediction
        </button>
      </div>

      {/* Live run status */}
      {running && <RunCard run={running} />}

      {/* History */}
      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-muted">Recent runs</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted">No runs yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-1">When</th>
                <th className="py-1">Question</th>
                <th className="py-1">Status</th>
                <th className="py-1">Confidence</th>
                <th className="py-1">Headline</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-t border-black/5 hover:bg-black/[0.02]"
                  onClick={() => setRunning(r)}
                >
                  <td className="py-2">{new Date(r.startedAt).toLocaleString()}</td>
                  <td className="py-2">{r.question}</td>
                  <td className="py-2">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="py-2">
                    {r.resultJson?.confidence != null
                      ? `${Math.round(r.resultJson.confidence * 100)}%`
                      : "—"}
                  </td>
                  <td className="py-2 truncate max-w-md">
                    {r.resultJson?.headline ?? r.errorCode ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function HealthBadges({
  health,
}: {
  health: {
    mirofish: { ok: boolean; reason?: string; base: string };
    gemini: { ok: boolean; model: string };
  } | null;
}) {
  if (!health) return <span className="text-xs text-muted">Checking engines…</span>;
  return (
    <div className="flex gap-2 text-xs">
      <span
        className={
          "rounded-full px-3 py-1 font-medium " +
          (health.mirofish.ok
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-700")
        }
        title={health.mirofish.reason ?? health.mirofish.base}
      >
        MiroFish: {health.mirofish.ok ? "online" : "offline"}
      </span>
      <span
        className={
          "rounded-full px-3 py-1 font-medium " +
          (health.gemini.ok
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-700")
        }
        title={health.gemini.model}
      >
        Gemini: {health.gemini.ok ? "ready" : "missing key"}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: Run["status"] }) {
  const cls: Record<Run["status"], string> = {
    queued: "bg-zinc-200 text-zinc-700",
    running_sim: "bg-sky-100 text-sky-700",
    analysing: "bg-violet-100 text-violet-700",
    done: "bg-emerald-100 text-emerald-700",
    failed: "bg-rose-100 text-rose-700",
  };
  return (
    <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + cls[status]}>
      {status}
    </span>
  );
}

function RunCard({ run }: { run: Run }) {
  const r = run.resultJson;
  const isRunning = run.status === "queued" || run.status === "running_sim" || run.status === "analysing";
  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-muted">Run {run.id.slice(0, 8)}</p>
          <h2 className="text-lg font-semibold">{r?.headline ?? "(generating…)"}</h2>
        </div>
        <StatusPill status={run.status} />
      </div>

      {isRunning && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          Running pipeline: brief → MiroFish swarm → Gemini formatter
        </div>
      )}

      {run.status === "failed" && (
        <p className="text-sm text-rose-600">
          Failed: {run.errorCode ?? "unknown error"}
        </p>
      )}

      {r?.insight && <p className="text-sm">{r.insight}</p>}

      {r?.recommendations && r.recommendations.length > 0 && (
        <div>
          <p className="text-xs uppercase text-muted">Recommendations</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-sm">
            {r.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {r?.confidence != null && (
        <div>
          <p className="text-xs uppercase text-muted">Confidence</p>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full bg-accent"
              style={{ width: `${Math.round((r.confidence ?? 0) * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted">
            {Math.round((r.confidence ?? 0) * 100)}%
          </p>
        </div>
      )}

      {run.brief && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-muted">
            World brief sent to MiroFish
          </summary>
          <pre className="mt-2 whitespace-pre-wrap rounded bg-black/[0.03] p-3">
            {run.brief}
          </pre>
        </details>
      )}

      {run.rawReport && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-muted">
            Raw MiroFish report
          </summary>
          <pre className="mt-2 whitespace-pre-wrap rounded bg-black/[0.03] p-3">
            {typeof run.rawReport === "string"
              ? run.rawReport
              : JSON.stringify(run.rawReport, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
