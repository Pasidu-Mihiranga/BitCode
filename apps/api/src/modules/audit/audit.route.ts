/**
 * Admin audit endpoints (feat2). The Verify button calls /verify and the UI
 * shows the breaking row id if any. The list endpoint is paginated and
 * filterable. Each handler resolves admin inline (see middleware/auth.ts for
 * why we don't rely on `.use(requireAdmin)` propagation).
 */

import { Elysia, t } from "elysia";
import { jwtPlugin, resolveAdmin } from "../../middleware/auth";
import * as service from "./audit.service";

export const auditRoutes = new Elysia({ prefix: "/admin/audit" })
  .use(jwtPlugin)
  .get(
    "/",
    async (ctx) => {
      await resolveAdmin(ctx);
      const page = Math.max(1, Number(ctx.query.page ?? 1));
      const size = Math.min(200, Math.max(1, Number(ctx.query.size ?? 50)));
      const out = await service.list({
        page,
        size,
        actor: ctx.query.actor || undefined,
        action: ctx.query.action || undefined,
      });
      return { ok: true, page, size, ...out };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        size: t.Optional(t.String()),
        actor: t.Optional(t.String()),
        action: t.Optional(t.String()),
      }),
    },
  )
  .post("/verify", async (ctx) => {
    await resolveAdmin(ctx);
    const out = await service.verify();
    return { ok: true, result: out };
  });
