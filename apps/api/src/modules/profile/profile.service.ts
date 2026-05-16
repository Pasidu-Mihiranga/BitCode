import { withAudit } from "../../shared/audit";
import * as repo from "./profile.repo";

export async function getOrders(userId: string) {
  return repo.ordersFor(userId);
}

export async function setDisplayName(userId: string, displayName: string) {
  return withAudit(
    userId,
    "profile.updateDisplayName",
    () => ({ displayName }),
    async (tx) => repo.updateDisplayName(userId, displayName.trim(), tx),
  );
}
