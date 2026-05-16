import { AppError } from "../../shared/errors";
import * as repo from "./marketplace.repo";

export async function listEvents() {
  return repo.listEventsWithItems();
}

export async function findEvent(id: string) {
  const e = await repo.findEvent(id);
  if (!e) throw new AppError("EVENT_NOT_FOUND");
  return e;
}
