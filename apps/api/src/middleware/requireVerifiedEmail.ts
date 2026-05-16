/**
 * Login-time gate that prevents `pending_verification` accounts from
 * progressing to a session token (feat3). Called from the auth service
 * because it needs to see the freshly-loaded user row.
 */

import { AppError } from "../shared/errors";
import type { User } from "../db/schema";

export function assertEmailVerified(user: User): void {
  if (user.status === "pending_verification") {
    throw new AppError("EMAIL_NOT_VERIFIED");
  }
  if (user.status === "deactivated") {
    throw new AppError("ACCOUNT_DEACTIVATED");
  }
}
