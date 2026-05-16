/**
 * Elysia bootstrap. Mounts all module routes under /api, mounts the WS hub
 * at /ws/*, kicks off the reservation expiry sweeper and the event auto-
 * go-live tick.
 */

import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { errorHandler } from "./middleware/errorHandler";

import { authRoutes } from "./modules/auth/auth.route";
import { emailRoutes } from "./modules/email/email.route";
import { marketplaceRoutes } from "./modules/marketplace/marketplace.route";
import { purchaseRoutes } from "./modules/purchase/purchase.route";
import { profileRoutes } from "./modules/profile/profile.route";
import { adminEventsRoutes, adminDashboardRoutes } from "./modules/events/events.route";
import { auditRoutes } from "./modules/audit/audit.route";
import { wsHub } from "./ws/hub";

import { startExpirySweeper } from "./modules/purchase/purchase.expiry";
import * as eventsService from "./modules/events/events.service";

const PORT = Number(process.env.API_PORT ?? 3000);
const INSTANCE = process.env.INSTANCE_ID ?? "api";

const app = new Elysia()
  .use(
    cors({
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    }),
  )
  .use(errorHandler)
  .use(
    swagger({
      path: "/docs",
      documentation: {
        info: {
          title: "SwiftDrop API",
          version: "1.0.0",
          description: "Flash-sale platform — Elysia (Bun) + Drizzle + Postgres + Redis",
        },
      },
    }),
  )
  .get("/api/health", () => ({
    ok: true,
    instance: INSTANCE,
    ts: new Date().toISOString(),
  }))
  .group("/api", (g) =>
    g
      .use(authRoutes)
      .use(emailRoutes)
      .use(marketplaceRoutes)
      .use(purchaseRoutes)
      .use(profileRoutes)
      .use(adminEventsRoutes)
      .use(adminDashboardRoutes)
      .use(auditRoutes),
  )
  .use(wsHub);

// Singleton background jobs — run on the api1 replica only.
startExpirySweeper();
if ((process.env.RUN_SWEEPER ?? "true") === "true") {
  setInterval(async () => {
    try {
      await eventsService.flipDueEventsLive();
    } catch (e) {
      console.error("[autoGoLive]", e);
    }
  }, 3000).unref?.();
}

app.listen(PORT, () => {
  console.log(`[${INSTANCE}] SwiftDrop API listening on :${PORT}`);
});

export type App = typeof app;
