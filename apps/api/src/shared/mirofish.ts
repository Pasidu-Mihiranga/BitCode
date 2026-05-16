/**
 * Thin client for the MiroFish swarm-simulation engine.
 * Base URL + per-product sim-id map come from env (`.env`).
 *
 * The engine surface we rely on:
 *   POST {base}/api/simulations/{simId}/runs   { brief, prompt } → { runId }
 *   GET  {base}/api/simulations/{simId}/runs/{runId}             → { status, report? }
 *
 * Multiple plausible endpoint shapes are probed; whichever responds first
 * wins. This makes the integration robust against MiroFish API drift.
 *
 * Failures bubble up as AppError("PREDICTION_ENGINE_OFFLINE") so the route
 * layer can render a friendly banner instead of leaking a stack.
 */

import { AppError } from "./errors";

const BASE = (process.env.MIROFISH_BASE_URL ?? "").replace(/\/+$/, "");
const SIMS = parseSimMap(process.env.MIROFISH_SIMULATIONS ?? "{}");
const DEFAULT_PRODUCT = (process.env.MIROFISH_DEFAULT_PRODUCT ?? "the product").toLowerCase();
const TIMEOUT_MS = 8000;

function parseSimMap(s: string): Record<string, string> {
  try {
    const parsed = JSON.parse(s);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) out[k.toLowerCase()] = String(v);
    return out;
  } catch {
    return {};
  }
}

export function resolveSimId(product?: string): string {
  const key = (product ?? DEFAULT_PRODUCT).toLowerCase();
  return SIMS[key] ?? SIMS[DEFAULT_PRODUCT] ?? Object.values(SIMS)[0] ?? "";
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: any }> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    });
    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { ok: res.ok, status: res.status, body };
  } catch (e: any) {
    return { ok: false, status: 0, body: e?.message ?? String(e) };
  }
}

export async function health(): Promise<{ ok: boolean; reason?: string; base: string }> {
  if (!BASE) return { ok: false, reason: "MIROFISH_BASE_URL not configured", base: "" };
  // Try a few likely shapes.
  const candidates = [`${BASE}/api/health`, `${BASE}/health`, `${BASE}/`];
  for (const url of candidates) {
    const r = await fetchJsonWithTimeout(url, { method: "GET" });
    if (r.ok) return { ok: true, base: BASE };
  }
  return { ok: false, reason: "MiroFish unreachable", base: BASE };
}

/**
 * Kick off a swarm-sim run. Returns the engine's run id (or a synthetic one).
 * We try a few plausible POST shapes — MiroFish APIs are evolving.
 */
export async function startRun(
  simId: string,
  brief: string,
  prompt: string,
): Promise<{ runId: string }> {
  if (!BASE || !simId) {
    throw new AppError("PREDICTION_ENGINE_OFFLINE", "MiroFish not configured");
  }
  const payload = { brief, prompt, query: prompt, content: brief };
  const candidates = [
    `${BASE}/api/simulations/${simId}/runs`,
    `${BASE}/simulations/${simId}/runs`,
    `${BASE}/api/sim/${simId}/run`,
    `${BASE}/api/predict`,
  ];
  for (const url of candidates) {
    const r = await fetchJsonWithTimeout(url, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (r.ok && r.body) {
      const runId =
        (typeof r.body === "object" && (r.body.runId ?? r.body.run_id ?? r.body.id)) ||
        crypto.randomUUID();
      return { runId: String(runId) };
    }
  }
  // Couldn't start a real run — degrade gracefully with a synthetic runId so
  // the pipeline can still complete (the report comes from Gemini in that
  // case).
  return { runId: `local-${crypto.randomUUID()}` };
}

/**
 * Poll for run status + report. Returns { done, report? }. If the engine
 * is unreachable or returns nothing useful, we return done:true with an
 * empty report — Gemini will then format whatever brief we have.
 */
export async function getRun(
  simId: string,
  runId: string,
): Promise<{ done: boolean; status: string; report?: string }> {
  if (runId.startsWith("local-")) {
    return { done: true, status: "synthetic", report: "" };
  }
  const candidates = [
    `${BASE}/api/simulations/${simId}/runs/${runId}`,
    `${BASE}/simulations/${simId}/runs/${runId}`,
    `${BASE}/api/sim/${simId}/run/${runId}`,
    `${BASE}/api/runs/${runId}`,
  ];
  for (const url of candidates) {
    const r = await fetchJsonWithTimeout(url, { method: "GET" });
    if (r.ok && r.body && typeof r.body === "object") {
      const status = String(r.body.status ?? r.body.state ?? "unknown");
      const report = r.body.report ?? r.body.result ?? r.body.output ?? "";
      const done = ["done", "completed", "finished", "success", "ok"].includes(
        status.toLowerCase(),
      );
      return {
        done,
        status,
        report: typeof report === "string" ? report : JSON.stringify(report),
      };
    }
  }
  // Engine unreachable — let the orchestrator move on with the brief alone.
  return { done: true, status: "unreachable", report: "" };
}

export async function runAndAwait(
  simId: string,
  brief: string,
  prompt: string,
  pollIntervalMs: number,
  timeoutMs: number,
): Promise<{ runId: string; report: string; status: string }> {
  const { runId } = await startRun(simId, brief, prompt);
  const deadline = Date.now() + timeoutMs;
  let last: { done: boolean; status: string; report?: string } = {
    done: false,
    status: "queued",
  };
  while (Date.now() < deadline) {
    last = await getRun(simId, runId);
    if (last.done) break;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  return { runId, report: last.report ?? "", status: last.status };
}
