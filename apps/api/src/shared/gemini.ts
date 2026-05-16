/**
 * Thin Gemini wrapper used by the predictions microservice as the M1
 * orchestrator. Two helpers:
 *   1. buildBrief — turn structured platform data into a tight natural-language
 *      "world brief" + a specific prediction question for the swarm sim.
 *   2. formatReport — turn the raw MiroFish output into a short structured
 *      result the admin UI can render directly.
 *
 * Falls back to deterministic stubs if GEMINI_API_KEY is missing so the
 * stack still boots without network access to Google.
 */

import { AppError } from "./errors";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_URL = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

export type QuestionTemplate =
  | "best_go_live_time"
  | "sell_through"
  | "price_sensitivity"
  | "conversion"
  | "anomaly_summary"
  | "next_drop";

const TEMPLATE_INSTRUCTIONS: Record<QuestionTemplate, string> = {
  best_go_live_time:
    "Predict which weekday and hour a new flash-sale drop would convert best, based on observed purchase timestamps. State a single recommended slot + 2 runner-ups.",
  sell_through:
    "Predict the sell-through percentage and time-to-sellout (minutes) for the named event, given current stock + observed buyer behaviour.",
  price_sensitivity:
    "Predict the impact of the supplied price shift on units sold and revenue. Compare against the current baseline.",
  conversion:
    "Predict the reservation→pay conversion rate for the named event, given observed extension usage and decline rates.",
  anomaly_summary:
    "Inspect the recent audit-log action distribution. Call out any action whose frequency looks anomalous and the user roles most involved.",
  next_drop:
    "Suggest the next drop to schedule: category, price band, and timing, optimised for revenue.",
};

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    // Deterministic stub keeps the pipeline traceable when no key is set.
    return JSON.stringify({
      stub: true,
      headline: "Prediction stub (no GEMINI_API_KEY set).",
      insight:
        "Set GEMINI_API_KEY in .env to get a real Gemini-backed brief and report.",
      recommendations: [
        "Set GEMINI_API_KEY in .env",
        "Restart the predictions container",
        "Re-run this prediction",
      ],
      confidence: 0.1,
    });
  }
  const res = await fetch(GEMINI_URL(GEMINI_API_KEY), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    }),
    signal: AbortSignal.timeout(20000),
  }).catch((e) => {
    throw new AppError("PREDICTION_LLM_FAILED", `gemini fetch failed: ${e?.message ?? e}`);
  });
  if (!res.ok) {
    throw new AppError(
      "PREDICTION_LLM_FAILED",
      `gemini HTTP ${res.status}: ${await res.text().catch(() => "")}`,
    );
  }
  const j: any = await res.json();
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || text.length === 0) {
    throw new AppError("PREDICTION_LLM_FAILED", "gemini returned empty text");
  }
  return text;
}

export async function buildBrief(
  template: QuestionTemplate,
  context: Record<string, unknown>,
  params: Record<string, unknown>,
): Promise<{ brief: string; prompt: string }> {
  const sys = `You are the orchestrator for a swarm-simulation engine called MiroFish.
You receive structured data from a flash-sale platform (audit-chain verified)
and must produce two things:
  1. A tight natural-language "world brief" (≤8 sentences) describing the
     buyer population, the event, and what they care about. Plausible
     personas, plausible price sensitivity, plausible timing.
  2. A precise prediction question for the swarm to deliberate on.
Output STRICT JSON: {"brief": "...", "prompt": "..."} and nothing else.

Question template: ${template}
Guidance: ${TEMPLATE_INSTRUCTIONS[template]}
Platform data (JSON): ${JSON.stringify(context).slice(0, 6000)}
User params (JSON): ${JSON.stringify(params).slice(0, 2000)}`;

  const text = await callGemini(sys);
  const parsed = safeParse(text);
  if (!parsed || typeof parsed.brief !== "string" || typeof parsed.prompt !== "string") {
    // Fallback: send raw text as brief + the template guidance as prompt.
    return {
      brief: text.slice(0, 2000),
      prompt: TEMPLATE_INSTRUCTIONS[template],
    };
  }
  return { brief: parsed.brief, prompt: parsed.prompt };
}

export async function formatReport(
  template: QuestionTemplate,
  rawText: string,
): Promise<{
  headline: string;
  insight: string;
  recommendations: string[];
  confidence: number;
}> {
  const sys = `You are formatting a MiroFish swarm simulation output for a busy
admin. Read the raw report and produce STRICT JSON:
{
  "headline": "<1 punchy sentence, no period at end>",
  "insight": "<2-4 sentences explaining what the swarm concluded>",
  "recommendations": ["<rec 1>", "<rec 2>", "<rec 3>"],
  "confidence": <0..1 float>
}
Question template: ${template}
Raw report (truncate as you see fit): ${rawText.slice(0, 8000)}`;

  const text = await callGemini(sys);
  const parsed = safeParse(text);
  if (
    parsed &&
    typeof parsed.headline === "string" &&
    typeof parsed.insight === "string" &&
    Array.isArray(parsed.recommendations)
  ) {
    return {
      headline: parsed.headline,
      insight: parsed.insight,
      recommendations: parsed.recommendations.slice(0, 5).map((r: unknown) => String(r)),
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.6,
    };
  }
  // Fallback: use raw text as insight.
  return {
    headline: "Prediction completed",
    insight: text.slice(0, 600),
    recommendations: [],
    confidence: 0.5,
  };
}

function safeParse(s: string): any | null {
  try {
    // Strip ```json fences if present
    const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    return JSON.parse(m ? m[1] : s);
  } catch {
    return null;
  }
}
