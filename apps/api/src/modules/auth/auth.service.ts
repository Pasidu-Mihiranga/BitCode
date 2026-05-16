/**
 * Auth service — business logic for FR-A01..A06 + feat3 + feat4. Only this
 * file (and other services) is allowed to call `withAudit`. Routes never do.
 */

import { hashPassword, verifyPassword } from "../../shared/hash";
import { AppError } from "../../shared/errors";
import { appendAudit, withAudit } from "../../shared/audit";
import { db } from "../../db/client";
import { assertEmailVerified } from "../../middleware/requireVerifiedEmail";
import { redis, RedisKeys } from "../../shared/redis";
import * as repo from "./auth.repo";
import * as emailService from "../email/email.service";

const PASSWORD_MIN = 8;

function assertPasswordStrength(pw: string): void {
  if (pw.length < PASSWORD_MIN) throw new AppError("PASSWORD_TOO_WEAK");
}

function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function register(input: {
  email: string;
  displayName: string;
  password: string;
}): Promise<{ userId: string; needsVerification: true }> {
  assertPasswordStrength(input.password);
  const email = normaliseEmail(input.email);
  const existing = await repo.findByEmail(email);
  if (existing) throw new AppError("EMAIL_ALREADY_REGISTERED");

  const passwordHash = await hashPassword(input.password);

  const created = await withAudit(
    null,
    "auth.register",
    (r) => ({ userId: r.userId, email }),
    async (tx) => {
      const user = await repo.insertUser(
        {
          email,
          passwordHash,
          displayName: input.displayName.trim(),
          role: "customer",
          status: "pending_verification",
        },
        tx,
      );
      return { userId: user.id };
    },
  );

  // Send verification email AFTER commit — if SMTP fails the user can resend.
  await emailService.sendRegistrationVerification(created.userId, email);
  return { userId: created.userId, needsVerification: true };
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<{ userId: string; role: "customer" | "admin" }> {
  const email = normaliseEmail(input.email);
  const user = await repo.findByEmail(email);
  if (!user) {
    // Constant work even on miss to avoid trivial timing oracle.
    await hashPassword("dummy-password-for-timing-safety");
    throw new AppError("INVALID_CREDENTIALS");
  }
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) throw new AppError("INVALID_CREDENTIALS");
  assertEmailVerified(user);

  // Audit the login (no payload secrets)
  await db.transaction(async (tx) => {
    await appendAudit(tx, {
      actorUserId: user.id,
      action: "auth.login",
      payload: { email },
    });
  });

  return { userId: user.id, role: user.role };
}

export async function logout(args: { userId: string; jti: string; expSeconds: number }) {
  // Blocklist this specific jti until its natural expiry.
  if (args.expSeconds > 0) {
    await redis.set(RedisKeys.jwtBlock(args.jti), "1", "EX", args.expSeconds);
  }
  await db.transaction(async (tx) => {
    await appendAudit(tx, {
      actorUserId: args.userId,
      action: "auth.logout",
      payload: { jti: args.jti },
    });
  });
}

/**
 * Initiate a password change. Verifies current password, hashes the new one,
 * and stashes the hash on a single-use email token. The change is only
 * applied when the user clicks the link (handled by email.service).
 */
export async function initiatePasswordChange(args: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ delivered: true }> {
  assertPasswordStrength(args.newPassword);
  const user = await repo.findById(args.userId);
  if (!user) throw new AppError("UNAUTHORIZED");
  const ok = await verifyPassword(user.passwordHash, args.currentPassword);
  if (!ok) throw new AppError("CURRENT_PASSWORD_WRONG");
  const pendingHash = await hashPassword(args.newPassword);
  await emailService.sendPasswordChangeConfirmation(user.id, user.email, pendingHash);
  await db.transaction(async (tx) => {
    await appendAudit(tx, {
      actorUserId: user.id,
      action: "auth.passwordChange.initiated",
      payload: { email: user.email },
    });
  });
  return { delivered: true };
}

/**
 * Called by email.service when a password-change token is confirmed. Applies
 * the pending hash, bumps the global gen counter (invalidating all existing
 * JWTs for this user), audits.
 */
export async function applyPasswordChange(args: {
  userId: string;
  newPasswordHash: string;
}): Promise<void> {
  await withAudit(
    args.userId,
    "auth.passwordChange.applied",
    () => ({ userId: args.userId }),
    async (tx) => {
      await repo.updatePasswordHash(args.userId, args.newPasswordHash, tx);
    },
  );
  await redis.incr(RedisKeys.userGen(args.userId));
}

export async function findById(userId: string) {
  return repo.findById(userId);
}
