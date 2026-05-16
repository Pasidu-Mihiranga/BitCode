/**
 * Predictions microservice — business logic.
 *
 * Pipeline:
 *   1. aggregate platform context (audit + orders + events) via repo
 *   2. ask Gemini to produce a "world brief" + a precise question for the
 *      swarm sim
 *   3. forward to MiroFish (poll until terminal, or timeout)
 *   4. ask Gemini to format the raw report into a structured insight
 *   5. persist + emit an audit-chain entry ("prediction.run")
 *
 * Designed so the route layer can simply call `kickoff()` and the service
 * runs the pipeline asynchronously, updating prediction_runs.status as it
 * progresses. The route then polls via /api/admin/predictions/:id.
 */

import { AppError } from "../../shared/errors";
import { withAudit } from "../../shared/audit";
import * as gemini from "../../shared/gemini";
import * as mirofish from "../../shared/mirofish";
import * as repo from "./predictions.repo";

const POLL_TIMEOUT_MS = Number(process.env.PREDICTION_POLL_TIMEOUT_MS ?? 60000);
const POLL_INTERVAL_MS = Number(process.env.PREDICTION_POLL_INTERVAL_MS ?? 2000);

export type Question = gemini.QuestionTemplate;

export async function health() {
  const m = await mirofish.health();
  return {
    mirofish: m,
    gemini: { ok: Boolean(process.env.GEMINI_API_KEY), model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash" },
  };
}

/**
 * Start a prediction run. Returns immediately with the run id. The full
 * pipeline executes in the background and updates prediction_runs.status.
 */
export async function kickoff(input: {
  question: Question;
  eventId?: string;
  params?: Record<string, unknown>;
  requestedBy: string;
}): Promise<{ runId: string }> {
  // Pre-flight: don't even start if we have basically no data.
  const ctxQuick = await repo.aggregateContext({ eventId: input.eventId, lookbackDays: 30 });
  if (ctxQuick.totals.orders + ctxQuick.totals.reservations < 1) {
    throw new AppError("PREDICTION_INSUFFICIENT_DATA");
  }

  const simId = mirofish.resolveSimId(process.env.MIROFISH_DEFAULT_PRODUCT);
  const row = await repo.insertRun({
    question: input.question,
    requestedBy: input.requestedBy,
    eventId: input.eventId,
    params: input.params ?? {},
    miroSimId: simId,
  });

  // Fire-and-forget pipeline. We swallow errors here because they're
  // recorded into prediction_runs.errorCode for the UI to display.
  runPipeline(row.id, input.question, ctxQuick, input.params ?? {}, simId, input.requestedBy)
    .catch((e) => {
      console.error("[predictions] pipeline crashed", row.id, e);
    });

  return { runId: row.id };
}

async function runPipeline(
  runId: string,
  question: Question,
  context: any,
  params: Record<string, unknown>,
  simId: string,
  actor: string,
) {
  try {
    // Step 1: brief
    const { brief, prompt } = await gemini.buildBrief(question, context, params);
    await repo.updateRun(runId, { status: "running_sim", brief });

    // Step 2: MiroFish run + poll
    const { runId: miroRunId, report, status: simStatus } = await mirofish.runAndAwait(
      simId,
      brief,
      prompt,
      POLL_INTERVAL_MS,
      POLL_TIMEOUT_MS,
    );
    await repo.updateRun(runId, {
      miroRunId,
      status: "analysing",
      rawReport: { miroStatus: simStatus, report },
    });

    // Step 3: format
    // If the engine was unreachable, hand Gemini the brief + context so it
    // can still produce something useful instead of an empty card.
    const inputForFormatter =
      report && report.length > 20
        ? report
        : `MiroFish engine was offline. Use this context to answer the question.\n\nBrief:\n${brief}\n\nContext:\n${JSON.stringify(
            context,
          ).slice(0, 6000)}`;
    const result = await gemini.formatReport(question, inputForFormatter);

    // Step 4: persist + audit-chain
    await withAudit(actor, "prediction.run", () => ({
      runId,
      question,
      simId,
      miroRunId,
      confidence: result.confidence,
    }), async () => {
      // intentionally empty mutation — withAudit handles the chain insert
      return null;
    });

    await repo.updateRun(runId, {
      status: "done",
      resultJson: result as any,
      finishedAt: new Date(),
    });
  } catch (e: any) {
    const code =
      e instanceof AppError ? e.code : "INTERNAL_ERROR";
    await repo.updateRun(runId, {
      status: "failed",
      errorCode: code,
      finishedAt: new Date(),
    });
  }
}

export async function get(runId: string) {
  const r = await repo.getRun(runId);
  if (!r) throw new AppError("PREDICTION_NOT_FOUND");
  return r;
}

export async function list() {
  return repo.listRuns(20);
}
