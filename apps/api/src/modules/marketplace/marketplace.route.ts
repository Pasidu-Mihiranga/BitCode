/**
 * Public marketplace endpoints — FR-M01 list + event detail. Browsing
 * doesn't require auth in the PRD (only purchases do), but we still want
 * the user object if it's present so the frontend can hide the Buy button
 * when the viewer is the admin or unverified.
 */

import { Elysia, t } from "elysia";
import * as service from "./marketplace.service";

export const marketplaceRoutes = new Elysia()
  .get("/events", async () => {
    const list = await service.listEvents();
    return { ok: true, events: list };
  })
  .get(
    "/events/:id",
    async ({ params }) => {
      const e = await service.findEvent(params.id);
      return { ok: true, event: e };
    },
    { params: t.Object({ id: t.String() }) },
  );
