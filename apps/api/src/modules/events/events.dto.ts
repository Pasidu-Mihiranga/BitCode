import { t } from "elysia";

export const ItemInput = t.Object({
  name: t.String({ minLength: 1, maxLength: 120 }),
  unitPriceCents: t.Integer({ minimum: 0, maximum: 100_000_00 }),
  stockQuantity: t.Integer({ minimum: 100, maximum: 500 }),
});

export const CreateEventBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 120 }),
  goLiveAt: t.String({ format: "date-time" }),
  items: t.Array(ItemInput, { minItems: 1, maxItems: 20 }),
});

export const UpdateEventBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
  goLiveAt: t.Optional(t.String({ format: "date-time" })),
  items: t.Optional(t.Array(ItemInput, { minItems: 1, maxItems: 20 })),
});
