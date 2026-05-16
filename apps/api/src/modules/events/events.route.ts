/**
 * Admin events routes — FR-E01..E06. Multipart for cover photo + JSON body
 * for the rest. Behind `requireAdmin` (role check inside).
 */

import { Elysia, t } from "elysia";
import { requireAdmin } from "../../middleware/auth";
import { CreateAdminBody } from "../auth/auth.dto";
import * as authService from "../auth/auth.service";
import { AppError } from "../../shared/errors";
import type { CreateEventInput } from "./events.service";
import * as service from "./events.service";

async function readUpload(maybeFile: unknown): Promise<Uint8Array | null> {
  if (!maybeFile) return null;
  if (typeof (maybeFile as any).arrayBuffer === "function") {
    return new Uint8Array(await (maybeFile as File).arrayBuffer());
  }
  return null;
}

/** Multipart parsers may yield strings, parsed JSON arrays, or Date for datetimes. */
function normalizeGoLiveIso(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  if (raw instanceof Date) return raw.toISOString();
  return String(raw);
}

function parseItemsField(raw: unknown): CreateEventInput["items"] {
  let v: unknown = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    } catch {
      throw new AppError("VALIDATION_ERROR");
    }
  }
  if (!Array.isArray(v)) throw new AppError("VALIDATION_ERROR");
  return v as CreateEventInput["items"];
}

async function collectItemImageUploads(
  body: Record<string, unknown>,
  count: number,
): Promise<(Uint8Array | null)[]> {
  const out: (Uint8Array | null)[] = [];
  for (let i = 0; i < count; i++) {
    out.push(await readUpload(body[`itemImage_${i}`]));
  }
  return out;
}

const multipartBody = {
  additionalProperties: true,
} as const;

export const adminEventsRoutes = new Elysia({ prefix: "/admin/events" })
  .use(requireAdmin)
  // FR-E01 — create event with cover photo + items[]
  .post(
    "/",
    async ({ body, currentUser }) => {
      const b = body as Record<string, unknown>;
      const name = String(b.name ?? "").trim();
      if (!name || name.length > 120) throw new AppError("VALIDATION_ERROR");
      const goLiveAt = normalizeGoLiveIso(b.goLiveAt);
      if (goLiveAt.length < 8) throw new AppError("VALIDATION_ERROR");
      const items = parseItemsField(b.items);
      const itemImageBytes = await collectItemImageUploads(b, items.length);
      const cover = await readUpload(b.cover);
      const out = await service.create({
        name,
        goLiveAt,
        items,
        itemImageBytes,
        coverPhotoBytes: cover,
        createdBy: currentUser.id,
      });
      return { ok: true, event: out.event, items: out.items, cover: out.cover };
    },
    {
      type: "multipart/form-data",
      // Bun/Elysia may coerce JSON-like parts to arrays/objects and dates — avoid strict t.String() (422).
      body: t.Object(
        {
          name: t.Any(),
          goLiveAt: t.Any(),
          items: t.Any(),
          cover: t.Optional(t.Any()),
        },
        multipartBody,
      ),
    },
  )
  // FR-E03 — patch a locked event
  .patch(
    "/:id",
    async ({ body, params, currentUser }) => {
      const b = body as Record<string, unknown>;
      const cover = await readUpload(b.cover);
      const items =
        b.items !== undefined && b.items !== null ? parseItemsField(b.items) : undefined;
      const nameRaw = b.name;
      const name =
        nameRaw !== undefined && nameRaw !== null && String(nameRaw).trim()
          ? String(nameRaw).trim()
          : undefined;
      if (name !== undefined && name.length > 120) throw new AppError("VALIDATION_ERROR");
      let goLiveAt: string | undefined;
      if (b.goLiveAt !== undefined && b.goLiveAt !== null) {
        const g = normalizeGoLiveIso(b.goLiveAt);
        if (g.length < 8) throw new AppError("VALIDATION_ERROR");
        goLiveAt = g;
      }
      let itemImageBytes: (Uint8Array | null)[] | undefined;
      if (items !== undefined) {
        itemImageBytes = await collectItemImageUploads(b, items.length);
      }
      const out = await service.update({
        eventId: params.id,
        patch: { name, goLiveAt, items },
        coverPhotoBytes: cover,
        itemImageBytes,
        updatedBy: currentUser.id,
      });
      return { ok: true, event: out.event };
    },
    {
      type: "multipart/form-data",
      body: t.Object(
        {
          name: t.Optional(t.Any()),
          goLiveAt: t.Optional(t.Any()),
          items: t.Optional(t.Any()),
          cover: t.Optional(t.Any()),
        },
        multipartBody,
      ),
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
  .get("/analytics", async () => {
    const data = await service.analytics();
    return { ok: true, ...data };
  })
  .get("/admins", async () => {
    const admins = await authService.listAdminUsers();
    return { ok: true, admins };
  })
  .post(
    "/admins",
    async ({ body, currentUser }) => {
      const admin = await authService.createAdminAccount({
        ...body,
        createdBy: currentUser.id,
      });
      return { ok: true, admin };
    },
    { body: CreateAdminBody },
  )
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
