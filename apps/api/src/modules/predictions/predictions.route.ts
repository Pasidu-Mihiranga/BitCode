/**
 * Routing layer for the predictions microservice (admin only).
 * HTTP I/O only. All business logic lives in predictions.service.
 */

import { Elysia } from "elysia";
import { jwtPlugin, resolveAdmin } from "../../middleware/auth";
import { AppError } from "../../shared/errors";
import * as service from "./predictions.service";

const VALID_QUESTIONS = new Set([
  "best_go_live_time",
  "sell_through",
  "price_sensitivity",
  "conversion",
  "anomaly_summary",
  "next_drop",
]);

export const predictionsRoutes = new Elysia({ prefix: "/admin/predictions" })
  .use(jwtPlugin)
  .get("/health", async (ctx) => {
    await resolveAdmin(ctx);
    return { ok: true, ...(await service.health()) };
  })
  .post("/run", async (ctx) => {
    const user = await resolveAdmin(ctx);
    const b = (ctx.body ?? {}) as any;
    if (!b.question || !VALID_QUESTIONS.has(b.question)) {
      throw new AppError("VALIDATION_ERROR", "question is required");
    }
    const { runId } = await service.kickoff({
      question: b.question,
      eventId: b.eventId,
      params: b.params ?? {},
      requestedBy: user.id,
    });
    return { ok: true, runId };
  })
  .get("/:id", async (ctx) => {
    await resolveAdmin(ctx);
    const r = await service.get(ctx.params.id);
    return { ok: true, run: r };
  })
  .get("/", async (ctx) => {
    await resolveAdmin(ctx);
    const rows = await service.list();
    return { ok: true, runs: rows };
  });
