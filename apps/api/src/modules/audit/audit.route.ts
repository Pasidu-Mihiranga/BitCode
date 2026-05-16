/**
 * Admin audit endpoints (feat2). The Verify button calls /verify and the UI
 * shows the breaking row id if any. The list endpoint is paginated and
 * filterable.
 */

import { Elysia, t } from "elysia";
import { requireAdmin } from "../../middleware/auth";
import * as service from "./audit.service";

export const auditRoutes = new Elysia({ prefix: "/admin/audit" })
  .use(requireAdmin)
  .get(
    "/",
    async ({ query }) => {
      const page = Math.max(1, Number(query.page ?? 1));
      const size = Math.min(200, Math.max(1, Number(query.size ?? 50)));
      const out = await service.list({
        page,
        size,
        actor: query.actor || undefined,
        action: query.action || undefined,
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
  .post("/verify", async () => {
    const out = await service.verify();
    return { ok: true, result: out };
  });
