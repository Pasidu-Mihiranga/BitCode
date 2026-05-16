/**
 * Email verification service (feat3). Owns:
 *   - Register verification flow (status pending → active)
 *   - Password-change confirmation flow (apply the stashed hash on click)
 *   - Resend with rate limit
 *
 * Tokens are random 32-byte hex strings, single-use, 15-minute TTL. Stored
 * in Postgres (not Redis) because we need durable single-use semantics + the
 * pending password hash for the change flow.
 */

import { randomBytes } from "node:crypto";
import { sendMail, publicBaseUrl } from "../../shared/mailer";
import { AppError } from "../../shared/errors";
import { appendAudit } from "../../shared/audit";
import { db } from "../../db/client";
import * as repo from "./email.repo";
import * as authRepo from "../auth/auth.repo";
import * as authService from "../auth/auth.service";

const TOKEN_TTL_MIN = 15;

function newToken(): string {
  return randomBytes(32).toString("hex");
}

function expiresAt(): Date {
  return new Date(Date.now() + TOKEN_TTL_MIN * 60_000);
}

export async function sendRegistrationVerification(
  userId: string,
  email: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await repo.invalidatePending(userId, "register", tx);
    const token = newToken();
    await repo.insert(
      {
        userId,
        token,
        purpose: "register",
        expiresAt: expiresAt(),
      },
      tx,
    );
    await appendAudit(tx, {
      actorUserId: userId,
      action: "email.verify.requested",
      payload: { email, purpose: "register", tokenPrefix: token.slice(0, 8) },
    });
    const url = `${publicBaseUrl()}/verify-email?token=${token}`;
    await sendMail({
      to: email,
      subject: "Verify your SwiftDrop account",
      text: `Welcome to SwiftDrop!\n\nClick to verify your email (valid 15 minutes):\n${url}\n`,
      html: `<p>Welcome to SwiftDrop!</p>
             <p><a href="${url}">Click here to verify your email</a> (valid for 15 minutes).</p>
             <p><code>${url}</code></p>`,
    });
  });
}

export async function sendPasswordChangeConfirmation(
  userId: string,
  email: string,
  pendingPasswordHash: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await repo.invalidatePending(userId, "password_change", tx);
    const token = newToken();
    await repo.insert(
      {
        userId,
        token,
        purpose: "password_change",
        pendingPasswordHash,
        expiresAt: expiresAt(),
      },
      tx,
    );
    const url = `${publicBaseUrl()}/confirm-password-change?token=${token}`;
    await sendMail({
      to: email,
      subject: "Confirm your SwiftDrop password change",
      text: `Click to confirm your new password (valid 15 minutes):\n${url}\nIf you did not request this, ignore this email.\n`,
      html: `<p>Click to confirm your password change (valid for 15 minutes):</p>
             <p><a href="${url}">Confirm password change</a></p>
             <p>If you did not request this, ignore this email.</p>`,
    });
  });
}

export async function verifyRegistrationToken(token: string): Promise<{ userId: string }> {
  const row = await repo.findByToken(token);
  if (!row || row.purpose !== "register") throw new AppError("INVALID_TOKEN");
  if (row.usedAt) throw new AppError("TOKEN_ALREADY_USED");
  if (row.expiresAt.getTime() < Date.now()) throw new AppError("INVALID_TOKEN");

  await db.transaction(async (tx) => {
    await authRepo.markVerified(row.userId, tx);
    await repo.markUsed(row.id, tx);
    await appendAudit(tx, {
      actorUserId: row.userId,
      action: "email.verify.confirmed",
      payload: { tokenPrefix: token.slice(0, 8) },
    });
  });
  return { userId: row.userId };
}

export async function confirmPasswordChangeToken(token: string): Promise<{ userId: string }> {
  const row = await repo.findByToken(token);
  if (!row || row.purpose !== "password_change") throw new AppError("INVALID_TOKEN");
  if (row.usedAt) throw new AppError("TOKEN_ALREADY_USED");
  if (row.expiresAt.getTime() < Date.now()) throw new AppError("INVALID_TOKEN");
  if (!row.pendingPasswordHash) throw new AppError("INVALID_TOKEN");

  await authService.applyPasswordChange({
    userId: row.userId,
    newPasswordHash: row.pendingPasswordHash,
  });
  await db.transaction(async (tx) => {
    await repo.markUsed(row.id, tx);
  });
  return { userId: row.userId };
}

export async function resendRegistrationVerification(email: string): Promise<void> {
  const user = await authRepo.findByEmail(email.trim().toLowerCase());
  if (!user) return; // do not leak which emails exist
  if (user.status !== "pending_verification") return;
  await sendRegistrationVerification(user.id, user.email);
}
