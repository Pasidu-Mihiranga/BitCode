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

export interface EventItemInput {
  name: string;
  unitPriceCents: number;
  stockQuantity: number;
  /** Only used on update when no new file is uploaded — must be a prior /uploads/* path. */
  imageUrl?: string | null;
}

/** FR-E01 / FR-E03 — same bounds for create & edit while event is locked. */
function normalizeAndValidateItems(raw: unknown): EventItemInput[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new AppError("VALIDATION_ERROR", "Add at least one item.");
  }
  const out: EventItemInput[] = [];
  for (const row of raw) {
    const o = row as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name || name.length > 200) throw new AppError("VALIDATION_ERROR");
    const unitPriceCents = Number(o.unitPriceCents);
    const stockQuantity = Number(o.stockQuantity);
    if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0 || unitPriceCents > 100_000_00) {
      throw new AppError("VALIDATION_ERROR");
    }
    if (!Number.isInteger(stockQuantity) || stockQuantity < 100 || stockQuantity > 500) {
      throw new AppError("VALIDATION_ERROR", "Each item must have stock between 100 and 500 units.");
    }
    out.push({
      name,
      unitPriceCents,
      stockQuantity,
      imageUrl:
        typeof o.imageUrl === "string" || o.imageUrl === null ? (o.imageUrl as string | null) : undefined,
    });
  }
  return out;
}

export interface CreateEventInput {
  name: string;
  goLiveAt: string;
  items: EventItemInput[];
  coverPhotoBytes?: Uint8Array | null;
  /** Parallel to items[i]; new upload bytes or null to skip */
  itemImageBytes?: (Uint8Array | null)[];
  createdBy: string;
}

const SAFE_UPLOAD_URL = /^\/uploads\/[a-f0-9-]{36}\.jpe?g$/i;

function safeReuseImageUrl(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") return null;
  return SAFE_UPLOAD_URL.test(raw) ? raw : null;
}

async function resolveItemImageUrls(
  items: EventItemInput[],
  uploads: (Uint8Array | null)[] | undefined,
  mode: "create" | "update",
): Promise<(string | null)[]> {
  const out: (string | null)[] = [];
  for (let i = 0; i < items.length; i++) {
    const bytes = uploads?.[i];
    if (bytes && bytes.length > 0) {
      const sanitized = await sanitizeAndStoreImage(bytes);
      out.push(sanitized.url);
      continue;
    }
    if (mode === "update") {
      out.push(safeReuseImageUrl(items[i]!.imageUrl));
      continue;
    }
    out.push(null);
  }
  return out;
}

export async function create(input: CreateEventInput) {
  const goLiveAt = new Date(input.goLiveAt);
  if (Number.isNaN(goLiveAt.getTime())) throw new AppError("VALIDATION_ERROR");
  const items = normalizeAndValidateItems(input.items);

  let sanitized: SanitizedImage | null = null;
  if (input.coverPhotoBytes && input.coverPhotoBytes.length > 0) {
    sanitized = await sanitizeAndStoreImage(input.coverPhotoBytes);
  }

  const created = await withAudit(
    input.createdBy,
    "event.create",
    (r) => ({ eventId: r.event.id, items: r.items.map((i) => i.id) }),
    async (tx) => {
      const imageUrls = await resolveItemImageUrls(items, input.itemImageBytes, "create");
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
      const newItems = await repo.insertItems(
        items.map((it, idx) => ({
          eventId: event.id,
          name: it.name.trim(),
          unitPriceCents: it.unitPriceCents,
          stockQuantity: it.stockQuantity,
          imageUrl: imageUrls[idx] ?? null,
        })),
        tx,
      );
      return { event, items: newItems };
    },
  );
  return { event: created.event, items: created.items, cover: sanitized };
}

export async function update(input: {
  eventId: string;
  patch: { name?: string; goLiveAt?: string; items?: EventItemInput[] };
  coverPhotoBytes?: Uint8Array | null;
  itemImageBytes?: (Uint8Array | null)[];
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
        const items = normalizeAndValidateItems(input.patch.items);
        const imageUrls = await resolveItemImageUrls(items, input.itemImageBytes, "update");
        await repo.deleteItemsForEvent(input.eventId, tx);
        await repo.insertItems(
          items.map((it, idx) => ({
            eventId: input.eventId,
            name: it.name.trim(),
            unitPriceCents: it.unitPriceCents,
            stockQuantity: it.stockQuantity,
            imageUrl: imageUrls[idx] ?? null,
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

export async function analytics() {
  return repo.adminAnalytics();
}

export async function deactivateCustomer(customerId: string, actor: string) {
  const u = await authRepo.findById(customerId);
  if (!u) throw new AppError("USER_NOT_FOUND");
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
