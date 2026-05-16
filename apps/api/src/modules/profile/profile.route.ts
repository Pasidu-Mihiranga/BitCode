import { Elysia, t } from "elysia";
import { requireAuth } from "../../middleware/auth";
import * as service from "./profile.service";

export const profileRoutes = new Elysia()
  .use(requireAuth)
  // FR-O01 — order history
  .get("/orders", async ({ currentUser }) => {
    const rows = await service.getOrders(currentUser.id);
    return { ok: true, orders: rows };
  })
  // FR-O02 — update display name
  .patch(
    "/profile",
    async ({ body, currentUser }) => {
      await service.setDisplayName(currentUser.id, body.displayName);
      return { ok: true };
    },
    {
      body: t.Object({
        displayName: t.String({ minLength: 1, maxLength: 60 }),
      }),
    },
  );
