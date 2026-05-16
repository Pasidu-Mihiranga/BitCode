/**
 * Idempotent seed:
 *   - 1 verified admin (SEED_ADMIN_EMAIL)
 *   - 1 verified customer (SEED_CUSTOMER_EMAIL)
 *   - 1 LOCKED sample event with 3 items (100..500 stock each)
 *   - 1 LIVE sample event (go_live_at = now()) so judges can buy immediately
 *
 *   bun run src/seed.ts
 */

import { sql } from "drizzle-orm";
import { db, sqlClient } from "./db/client";
import { users, events, items } from "./db/schema";
import { hashPassword } from "./shared/hash";
import { appendAudit } from "./shared/audit";

async function main() {
  console.log("[seed] starting…");

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@swiftdrop.local").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin#12345";
  const custEmail = (process.env.SEED_CUSTOMER_EMAIL ?? "customer@swiftdrop.local").toLowerCase();
  const custPassword = process.env.SEED_CUSTOMER_PASSWORD ?? "Customer#12345";

  const adminHash = await hashPassword(adminPassword);
  const custHash = await hashPassword(custPassword);

  await db.transaction(async (tx) => {
    // ---- Admin (verified) ----
    const existingAdmin = await tx.execute<{ id: string }>(sql`
      SELECT id FROM users WHERE email = ${adminEmail} LIMIT 1
    `);
    let adminId: string;
    if ((existingAdmin as unknown as { id: string }[]).length === 0) {
      const inserted = await tx
        .insert(users)
        .values({
          email: adminEmail,
          passwordHash: adminHash,
          displayName: "Platform Admin",
          role: "admin",
          status: "active",
        })
        .returning({ id: users.id });
      adminId = inserted[0]!.id;
      await appendAudit(tx, {
        actorUserId: null,
        action: "seed.adminCreated",
        payload: { email: adminEmail },
      });
      console.log(`[seed] admin created: ${adminEmail} / ${adminPassword}`);
    } else {
      adminId = (existingAdmin as unknown as { id: string }[])[0]!.id;
      console.log(`[seed] admin already exists: ${adminEmail}`);
    }

    // ---- Customer (verified) ----
    const existingCust = await tx.execute<{ id: string }>(sql`
      SELECT id FROM users WHERE email = ${custEmail} LIMIT 1
    `);
    if ((existingCust as unknown as { id: string }[]).length === 0) {
      await tx.insert(users).values({
        email: custEmail,
        passwordHash: custHash,
        displayName: "Sample Customer",
        role: "customer",
        status: "active",
      });
      await appendAudit(tx, {
        actorUserId: null,
        action: "seed.customerCreated",
        payload: { email: custEmail },
      });
      console.log(`[seed] customer created: ${custEmail} / ${custPassword}`);
    } else {
      console.log(`[seed] customer already exists: ${custEmail}`);
    }

    // ---- Sample LOCKED event (goes live in 30 minutes) ----
    const existingLocked = await tx.execute<{ id: string }>(sql`
      SELECT id FROM events WHERE name = 'Friday Night Drop' LIMIT 1
    `);
    if ((existingLocked as unknown as { id: string }[]).length === 0) {
      const ev = await tx
        .insert(events)
        .values({
          name: "Friday Night Drop",
          goLiveAt: new Date(Date.now() + 30 * 60_000),
          status: "locked",
          createdBy: adminId,
        })
        .returning({ id: events.id });
      const eventId = ev[0]!.id;
      await tx.insert(items).values([
        {
          eventId,
          name: "Imported Wireless Earbuds",
          unitPriceCents: 4999_00,
          stockQuantity: 200,
        },
        {
          eventId,
          name: "Slim Carbon Wallet",
          unitPriceCents: 1499_00,
          stockQuantity: 350,
        },
        {
          eventId,
          name: "Smart Espresso Frother",
          unitPriceCents: 2299_00,
          stockQuantity: 150,
        },
      ]);
      await appendAudit(tx, {
        actorUserId: adminId,
        action: "seed.lockedEvent",
        payload: { eventId, name: "Friday Night Drop" },
      });
      console.log(`[seed] locked event created (goes live in 30m)`);
    }

    // ---- Sample LIVE event so judges can purchase immediately ----
    const existingLive = await tx.execute<{ id: string }>(sql`
      SELECT id FROM events WHERE name = 'Live Demo Drop' LIMIT 1
    `);
    if ((existingLive as unknown as { id: string }[]).length === 0) {
      const ev = await tx
        .insert(events)
        .values({
          name: "Live Demo Drop",
          goLiveAt: new Date(Date.now() - 60_000),
          status: "live",
          createdBy: adminId,
        })
        .returning({ id: events.id });
      const eventId = ev[0]!.id;
      await tx.insert(items).values([
        {
          eventId,
          name: "Demo Sneakers (concurrency test)",
          unitPriceCents: 7999_00,
          stockQuantity: 100,
        },
        {
          eventId,
          name: "Demo Smartwatch",
          unitPriceCents: 5499_00,
          stockQuantity: 120,
        },
      ]);
      await appendAudit(tx, {
        actorUserId: adminId,
        action: "seed.liveEvent",
        payload: { eventId, name: "Live Demo Drop" },
      });
      console.log(`[seed] live event created (you can buy now)`);
    }
  });

  console.log("[seed] done.");
  await sqlClient.end({ timeout: 2 });
}

main().catch((e) => {
  console.error("[seed] failed", e);
  process.exit(1);
});
