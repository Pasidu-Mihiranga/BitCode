/**
 * Admin events service — FR-E01..E06.
 * Image sanitization is invoked here (service layer owns side effects);
 * the route only forwards the raw bytes.
 */

import { AppError } from "../../shared/errors";
import { appendAudit, withAudit } from "../../shared/audit";
import { sanitizeAndStoreImage, type SanitizedImage } from "../../shared/imageSanitizer";
import { db } from "../../db/client";
import { broadcastEvent } from "../../ws/hub";
import * as repo from "./events.repo";
import * as authRepo from "../auth/auth.repo";

export interface CreateEventInput {
  name: string;
  goLiveAt: string;
  items: { name: string; unitPriceCents: number; stockQuantity: number }[];
  coverPhotoBytes?: Uint8Array | null;
  createdBy: string;
}

export async function create(input: CreateEventInput) {
  const goLiveAt = new Date(input.goLiveAt);
  if (Number.isNaN(goLiveAt.getTime())) throw new AppError("VALIDATION_ERROR");

  let sanitized: SanitizedImage | null = null;
  if (input.coverPhotoBytes && input.coverPhotoBytes.length > 0) {
    sanitized = await sanitizeAndStoreImage(input.coverPhotoBytes);
  }

  const created = await withAudit(
    input.createdBy,
    "event.create",
    (r) => ({ eventId: r.event.id, items: r.items.map((i) => i.id) }),
    async (tx) => {
      const event = await repo.createEvent(
        {
          name: input.name.trim(),
          goLiveAt,
          status: "locked",
          coverPhotoUrl: sanitized?.url ?? null,
          createdBy: input.createdBy,
        },
        tx,
      );
      const items = await repo.insertItems(
        input.items.map((i) => ({
          eventId: event.id,
          name: i.name.trim(),
          unitPriceCents: i.unitPriceCents,
          stockQuantity: i.stockQuantity,
        })),
        tx,
      );
      return { event, items };
    },
  );
  return { event: created.event, items: created.items, cover: sanitized };
}

export async function update(input: {
  eventId: string;
  patch: { name?: string; goLiveAt?: string; items?: CreateEventInput["items"] };
  coverPhotoBytes?: Uint8Array | null;
  updatedBy: string;
}) {
  const current = await repo.findEvent(input.eventId);
  if (!current) throw new AppError("EVENT_NOT_FOUND");
  if (current.status !== "locked") throw new AppError("EVENT_NOT_EDITABLE");

  let sanitized: SanitizedImage | null = null;
  if (input.coverPhotoBytes && input.coverPhotoBytes.length > 0) {
    sanitized = await sanitizeAndStoreImage(input.coverPhotoBytes);
  }

  const out = await withAudit(
    input.updatedBy,
    "event.update",
    (r) => ({ eventId: r.event.id }),
    async (tx) => {
      const patch: any = {};
      if (input.patch.name) patch.name = input.patch.name.trim();
      if (input.patch.goLiveAt) {
        const d = new Date(input.patch.goLiveAt);
        if (Number.isNaN(d.getTime())) throw new AppError("VALIDATION_ERROR");
        patch.goLiveAt = d;
      }
      if (sanitized) patch.coverPhotoUrl = sanitized.url;
      const event = await repo.updateEvent(input.eventId, patch, tx);
      if (input.patch.items && input.patch.items.length > 0) {
        await repo.deleteItemsForEvent(input.eventId, tx);
        await repo.insertItems(
          input.patch.items.map((i) => ({
            eventId: input.eventId,
            name: i.name.trim(),
            unitPriceCents: i.unitPriceCents,
            stockQuantity: i.stockQuantity,
          })),
          tx,
        );
      }
      return { event };
    },
  );
  return out;
}

export async function forceOpen(eventId: string, actor: string) {
  const ev = await repo.findEvent(eventId);
  if (!ev) throw new AppError("EVENT_NOT_FOUND");
  if (ev.status !== "locked") throw new AppError("EVENT_NOT_EDITABLE");
  const out = await withAudit(
    actor,
    "event.forceOpen",
    (r) => ({ eventId: r.id }),
    async (tx) => repo.setStatus(eventId, "live", tx),
  );
  await broadcastEvent(eventId, { status: "live", reason: "force_open" });
  return out;
}

export async function forceClose(eventId: string, actor: string) {
  const ev = await repo.findEvent(eventId);
  if (!ev) throw new AppError("EVENT_NOT_FOUND");
  if (ev.status === "closed" || ev.status === "sold_out") {
    throw new AppError("EVENT_ALREADY_CLOSED");
  }
  const out = await withAudit(
    actor,
    "event.forceClose",
    (r) => ({ eventId: r.id }),
    async (tx) => repo.setStatus(eventId, "closed", tx),
  );
  await broadcastEvent(eventId, { status: "closed", reason: "force_close" });
  return out;
}

export async function dashboard() {
  return repo.dashboard();
}

export async function deactivateCustomer(customerId: string, actor: string) {
  const u = await authRepo.findById(customerId);
  if (!u) throw new AppError("EVENT_NOT_FOUND"); // not really, but no user code
  if (u.role !== "customer") throw new AppError("FORBIDDEN");
  await withAudit(
    actor,
    "customer.deactivate",
    () => ({ customerId }),
    async (tx) => authRepo.deactivate(customerId, tx),
  );
}

export async function listCustomers(page = 1, size = 20) {
  return repo.listCustomers(undefined, page, size);
}

/**
 * Cron-ish: flip locked → live when go-live time has arrived. Cheap, runs
 * on the sweeper replica every few seconds alongside expiry.
 */
export async function flipDueEventsLive() {
  const flipped = await repo.flipLiveIfDue();
  for (const id of flipped) {
    await broadcastEvent(id, { status: "live", reason: "scheduled_go_live" });
    await db.transaction(async (tx) => {
      await appendAudit(tx, {
        actorUserId: null,
        action: "event.autoGoLive",
        payload: { eventId: id },
      });
    });
  }
  return flipped;
}
