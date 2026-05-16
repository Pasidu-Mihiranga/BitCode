/**
 * Drizzle schema for SwiftDrop — mirrors PRD §11 with three additions:
 *   - users.status gains `pending_verification` (feat3 SMTP verify)
 *   - reservations.extensions_used + payment_method (feat1 ATM-style + demo-pay)
 *   - email_verifications and audit_log tables (feat3 + feat2)
 *
 * Critical correctness pieces are the partial UNIQUE indexes that DB-enforce
 * "one confirmed order per user/item/event" (FR-P04) and "one active
 * reservation per user/item/event" — defence in depth on top of the
 * conditional UPDATE in §6.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  bigint,
  bigserial,
  timestamp,
  jsonb,
  check,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ===== Enums =====
export const userRoleEnum = pgEnum("user_role", ["customer", "admin"]);
export const userStatusEnum = pgEnum("user_status", [
  "pending_verification",
  "active",
  "deactivated",
]);
export const eventStatusEnum = pgEnum("event_status", [
  "locked",
  "live",
  "closed",
  "sold_out",
]);
export const reservationStatusEnum = pgEnum("reservation_status", [
  "active",
  "expired",
  "confirmed",
  "cancelled",
  "declined",
]);
export const orderStatusEnum = pgEnum("order_status", ["confirmed", "cancelled"]);
export const emailPurposeEnum = pgEnum("email_purpose", [
  "register",
  "password_change",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "card",
  "upi",
  "wallet",
  "netbanking",
]);

// ===== Users =====
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    role: userRoleEnum("role").notNull().default("customer"),
    status: userStatusEnum("status").notNull().default("pending_verification"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUniq: uniqueIndex("users_email_uniq").on(t.email),
  }),
);

// ===== Events =====
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    coverPhotoUrl: text("cover_photo_url"),
    goLiveAt: timestamp("go_live_at", { withTimezone: true }).notNull(),
    status: eventStatusEnum("status").notNull().default("locked"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusGoLiveIdx: index("events_status_go_live_idx").on(t.status, t.goLiveAt),
  }),
);

// ===== Items =====
export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    unitPriceCents: integer("unit_price_cents").notNull(),
    stockQuantity: integer("stock_quantity").notNull(),
    reservedStock: integer("reserved_stock").notNull().default(0),
    soldCount: integer("sold_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    stockRange: check(
      "items_stock_quantity_range",
      sql`${t.stockQuantity} BETWEEN 100 AND 500`,
    ),
    priceNonNegative: check("items_price_nonneg", sql`${t.unitPriceCents} >= 0`),
    reservedNonNegative: check(
      "items_reserved_nonneg",
      sql`${t.reservedStock} >= 0`,
    ),
    soldNonNegative: check("items_sold_nonneg", sql`${t.soldCount} >= 0`),
    // The OVER-SELL backstop: sum of holds + sold can never exceed stock.
    soldPlusReservedCap: check(
      "items_sold_plus_reserved_cap",
      sql`(${t.reservedStock} + ${t.soldCount}) <= ${t.stockQuantity}`,
    ),
    eventIdIdx: index("items_event_id_idx").on(t.eventId),
  }),
);

// ===== Reservations (feat1 ATM-style extensions) =====
export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    status: reservationStatusEnum("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    extensionsUsed: integer("extensions_used").notNull().default(0),
    paymentMethod: paymentMethodEnum("payment_method"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    extensionsCap: check(
      "reservations_extensions_cap",
      sql`${t.extensionsUsed} BETWEEN 0 AND 2`,
    ),
    // Defence in depth: only one ACTIVE reservation per (user,item,event)
    uniqActiveReservation: uniqueIndex("uniq_active_reservation")
      .on(t.userId, t.itemId, t.eventId)
      .where(sql`status = 'active'`),
    userExpiryIdx: index("reservations_user_expiry_idx").on(t.userId, t.expiresAt),
    expirySweepIdx: index("reservations_expiry_sweep_idx")
      .on(t.expiresAt)
      .where(sql`status = 'active'`),
  }),
);

// ===== Orders =====
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => reservations.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    pricePaidCents: integer("price_paid_cents").notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    status: orderStatusEnum("status").notNull().default("confirmed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // FR-P04 backstop. Partial UNIQUE so cancelled orders don't block re-purchase.
    uniqUserItemEventConfirmed: uniqueIndex("uniq_user_item_event_confirmed")
      .on(t.userId, t.itemId, t.eventId)
      .where(sql`status = 'confirmed'`),
    userCreatedIdx: index("orders_user_created_idx").on(t.userId, t.createdAt),
    eventIdx: index("orders_event_idx").on(t.eventId),
  }),
);

// ===== Email verifications (feat3) =====
export const emailVerifications = pgTable(
  "email_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    purpose: emailPurposeEnum("purpose").notNull(),
    // For password_change we stash the *new* password hash on the token itself
    // so the email link is the only thing that can apply the change.
    pendingPasswordHash: text("pending_password_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenUniq: uniqueIndex("email_verifications_token_uniq").on(t.token),
    activePerUserPurpose: index("email_verifications_active_idx")
      .on(t.userId, t.purpose)
      .where(sql`used_at IS NULL`),
  }),
);

// ===== Audit log (feat2 — SHA-256 hash chain) =====
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    payloadJson: jsonb("payload_json").notNull(),
    payloadHash: text("payload_hash").notNull(),
    prevHash: text("prev_hash"),
    entryHash: text("entry_hash").notNull(),
  },
  (t) => ({
    entryHashUniq: uniqueIndex("audit_entry_hash_uniq").on(t.entryHash),
    tsIdx: index("audit_ts_idx").on(t.ts),
    actorTsIdx: index("audit_actor_ts_idx").on(t.actorUserId, t.ts),
    actionIdx: index("audit_action_idx").on(t.action),
  }),
);

// ===== Type exports for service/repo layers =====
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type NewEmailVerification = typeof emailVerifications.$inferInsert;
export type AuditEntry = typeof auditLog.$inferSelect;
export type NewAuditEntry = typeof auditLog.$inferInsert;
