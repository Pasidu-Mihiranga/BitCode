/**
 * Admin events routes — FR-E01..E06. Multipart for cover photo + JSON body
 * for the rest. Behind `requireAdmin` (role check inside).
 */

import { Elysia, t } from "elysia";
import { requireAdmin } from "../../middleware/auth";
import { CreateEventBody, UpdateEventBody } from "./events.dto";
import * as service from "./events.service";

async function readUpload(maybeFile: unknown): Promise<Uint8Array | null> {
  if (!maybeFile) return null;
  if (typeof (maybeFile as any).arrayBuffer === "function") {
    return new Uint8Array(await (maybeFile as File).arrayBuffer());
  }
  return null;
}

export const adminEventsRoutes = new Elysia({ prefix: "/admin/events" })
  .use(requireAdmin)
  // FR-E01 — create event with cover photo + items[]
  .post(
    "/",
    async ({ body, currentUser }) => {
      const cover = await readUpload((body as any).cover);
      // body.items + body.name + body.goLiveAt come through multipart as strings
      const itemsRaw = (body as any).items;
      const items =
        typeof itemsRaw === "string" ? JSON.parse(itemsRaw) : itemsRaw;
      const out = await service.create({
        name: (body as any).name,
        goLiveAt: (body as any).goLiveAt,
        items,
        coverPhotoBytes: cover,
        createdBy: currentUser.id,
      });
      return { ok: true, event: out.event, items: out.items, cover: out.cover };
    },
    {
      // Elysia parses multipart automatically; we keep validation lax to
      // accept stringified items[]. Service does the real validation.
      type: "multipart/form-data",
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 120 }),
        goLiveAt: t.String({ minLength: 8 }),
        items: t.String(),
        cover: t.Optional(t.Any()),
      }),
    },
  )
  // FR-E03 — patch a locked event
  .patch(
    "/:id",
    async ({ body, params, currentUser }) => {
      const cover = await readUpload((body as any).cover);
      const itemsRaw = (body as any).items;
      const items = itemsRaw
        ? typeof itemsRaw === "string"
          ? JSON.parse(itemsRaw)
          : itemsRaw
        : undefined;
      const out = await service.update({
        eventId: params.id,
        patch: {
          name: (body as any).name,
          goLiveAt: (body as any).goLiveAt,
          items,
        },
        coverPhotoBytes: cover,
        updatedBy: currentUser.id,
      });
      return { ok: true, event: out.event };
    },
    {
      type: "multipart/form-data",
      body: t.Object({
        name: t.Optional(t.String()),
        goLiveAt: t.Optional(t.String()),
        items: t.Optional(t.String()),
        cover: t.Optional(t.Any()),
      }),
      params: t.Object({ id: t.String() }),
    },
  )
  // FR-E04 — force open / close
  .post(
    "/:id/force-open",
    async ({ params, currentUser }) => {
      const out = await service.forceOpen(params.id, currentUser.id);
      return { ok: true, event: out };
    },
    { params: t.Object({ id: t.String() }) },
  )
  .post(
    "/:id/force-close",
    async ({ params, currentUser }) => {
      const out = await service.forceClose(params.id, currentUser.id);
      return { ok: true, event: out };
    },
    { params: t.Object({ id: t.String() }) },
  );

export const adminDashboardRoutes = new Elysia({ prefix: "/admin" })
  .use(requireAdmin)
  // FR-E05 — dashboard
  .get("/dashboard", async () => {
    const rows = await service.dashboard();
    return { ok: true, events: rows };
  })
  // FR-O03 — paginated customer list
  .get(
    "/customers",
    async ({ query }) => {
      const page = Math.max(1, Number(query.page ?? 1));
      const size = Math.min(100, Math.max(1, Number(query.size ?? 20)));
      const out = await service.listCustomers(page, size);
      return { ok: true, ...out };
    },
    { query: t.Object({ page: t.Optional(t.String()), size: t.Optional(t.String()) }) },
  )
  // FR-E06 — deactivate a customer
  .post(
    "/customers/:id/deactivate",
    async ({ params, currentUser }) => {
      await service.deactivateCustomer(params.id, currentUser.id);
      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) },
  );
