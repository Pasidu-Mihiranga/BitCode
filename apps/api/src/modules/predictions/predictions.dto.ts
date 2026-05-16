import { t } from "elysia";

export const PredictionQuestion = t.Union([
  t.Literal("best_go_live_time"),
  t.Literal("sell_through"),
  t.Literal("price_sensitivity"),
  t.Literal("conversion"),
  t.Literal("anomaly_summary"),
  t.Literal("next_drop"),
]);

export const RunPredictionBody = t.Object({
  question: PredictionQuestion,
  eventId: t.Optional(t.String({ format: "uuid" })),
  params: t.Optional(t.Record(t.String(), t.Any())),
});

export type RunPredictionInput = (typeof RunPredictionBody)["static"];
