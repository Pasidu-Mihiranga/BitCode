/**
 * Admin events routes — FR-E01..E06. Multipart for cover photo + JSON body
 * for the rest. Each handler calls `resolveAdmin(ctx)` for FR-A04/FR-A05 to
 * be bullet-proof against Elysia's multi-level `.use()` plugin scoping
 * dropping the derive.
 */

import { Elysia, t } from "elysia";
import { jwtPlugin, resolveAdmin } from "../../middleware/auth";
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
  .use(jwtPlugin)
  // FR-E01 — create event with cover photo + items[]
  .post(
    "/",
    async (ctx) => {
      const admin = await resolveAdmin(ctx);
      const b = ctx.body as Record<string, unknown>;
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
        createdBy: admin.id,
      });
      return { ok: true, event: out.event, items: out.items, cover: out.cover };
    },
    {
      type: "multipart/form-data",
      // Bun/Elysia may coerce JSON-like parts to arrays/objects and dates — avoid strict t.String() (422).
      // additionalProperties: true keeps the dynamic itemImage_N parts.
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
    async (ctx) => {
      const admin = await resolveAdmin(ctx);
      const b = ctx.body as Record<string, unknown>;
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
        eventId: ctx.params.id,
        patch: { name, goLiveAt, items },
        coverPhotoBytes: cover,
        itemImageBytes,
        updatedBy: admin.id,
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
    async (ctx) => {
      const admin = await resolveAdmin(ctx);
      const out = await service.forceOpen(ctx.params.id, admin.id);
      return { ok: true, event: out };
    },
    { params: t.Object({ id: t.String() }) },
  )
  .post(
    "/:id/force-close",
    async (ctx) => {
      const admin = await resolveAdmin(ctx);
      const out = await service.forceClose(ctx.params.id, admin.id);
      return { ok: true, event: out };
    },
    { params: t.Object({ id: t.String() }) },
  );

export const adminDashboardRoutes = new Elysia({ prefix: "/admin" })
  .use(jwtPlugin)
  // FR-E05 — dashboard
  .get("/dashboard", async (ctx) => {
    await resolveAdmin(ctx);
    const rows = await service.dashboard();
    return { ok: true, events: rows };
  })
  .get("/analytics", async (ctx) => {
    await resolveAdmin(ctx);
    const data = await service.analytics();
    return { ok: true, ...data };
  })
  .get("/admins", async (ctx) => {
    await resolveAdmin(ctx);
    const admins = await authService.listAdminUsers();
    return { ok: true, admins };
  })
  .post(
    "/admins",
    async (ctx) => {
      const admin = await resolveAdmin(ctx);
      const created = await authService.createAdminAccount({
        ...(ctx.body as any),
        createdBy: admin.id,
      });
      return { ok: true, admin: created };
    },
    { body: CreateAdminBody },
  )
  // FR-O03 — paginated customer list
  .get(
    "/customers",
    async (ctx) => {
      await resolveAdmin(ctx);
      const page = Math.max(1, Number(ctx.query.page ?? 1));
      const size = Math.min(100, Math.max(1, Number(ctx.query.size ?? 20)));
      const out = await service.listCustomers(page, size);
      return { ok: true, ...out };
    },
    { query: t.Object({ page: t.Optional(t.String()), size: t.Optional(t.String()) }) },
  )
  // FR-E06 — deactivate a customer
  .post(
    "/customers/:id/deactivate",
    async (ctx) => {
      const admin = await resolveAdmin(ctx);
      await service.deactivateCustomer(ctx.params.id, admin.id);
      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) },
  );
