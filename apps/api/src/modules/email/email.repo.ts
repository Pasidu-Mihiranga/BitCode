/**
 * Email verification repo (feat3). Only place that touches
 * `email_verifications`.
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import { db, type DbTx } from "../../db/client";
import {
  emailVerifications,
  type EmailVerification,
  type NewEmailVerification,
} from "../../db/schema";

type Exec = DbTx | typeof db;

export async function insert(
  data: NewEmailVerification,
  exec: Exec = db,
): Promise<EmailVerification> {
  const rows = await exec.insert(emailVerifications).values(data).returning();
  return rows[0]!;
}

/**
 * Invalidate older un-used tokens for a (user, purpose) pair. Called before
 * issuing a fresh token so only the latest link is valid.
 */
export async function invalidatePending(
  userId: string,
  purpose: EmailVerification["purpose"],
  exec: Exec = db,
): Promise<void> {
  await exec
    .update(emailVerifications)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(emailVerifications.userId, userId),
        eq(emailVerifications.purpose, purpose),
        isNull(emailVerifications.usedAt),
      ),
    );
}

export async function findByToken(
  token: string,
  exec: Exec = db,
): Promise<EmailVerification | null> {
  const rows = await exec
    .select()
    .from(emailVerifications)
    .where(eq(emailVerifications.token, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function markUsed(id: string, exec: Exec = db): Promise<void> {
  await exec
    .update(emailVerifications)
    .set({ usedAt: new Date() })
    .where(eq(emailVerifications.id, id));
}
