/**
 * Auth repo — every Drizzle query that touches `users` lives here.
 * Service and route layers MUST NOT import drizzle-orm directly (NFR-08).
 */

import { eq, sql } from "drizzle-orm";
import { db, type DbTx } from "../../db/client";
import { users, type NewUser, type User } from "../../db/schema";

type Exec = DbTx | typeof db;

export async function findByEmail(
  email: string,
  exec: Exec = db,
): Promise<User | null> {
  const rows = await exec.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function findById(id: string, exec: Exec = db): Promise<User | null> {
  const rows = await exec.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function insertUser(
  data: NewUser,
  exec: Exec = db,
): Promise<User> {
  const rows = await exec.insert(users).values(data).returning();
  return rows[0]!;
}

export async function updatePasswordHash(
  userId: string,
  passwordHash: string,
  exec: Exec = db,
): Promise<void> {
  await exec
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function markVerified(userId: string, exec: Exec = db): Promise<void> {
  await exec
    .update(users)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function deactivate(userId: string, exec: Exec = db): Promise<void> {
  await exec
    .update(users)
    .set({ status: "deactivated", updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function updateDisplayName(
  userId: string,
  displayName: string,
  exec: Exec = db,
): Promise<void> {
  await exec
    .update(users)
    .set({ displayName, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
