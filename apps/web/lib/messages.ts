/**
 * Mirror of apps/api/src/shared/errors.ts copy. Kept in sync by hand —
 * exporting from a shared package wasn't worth the monorepo plumbing in a
 * 5h build.
 */

export type ErrorCode =
  | "INVALID_CREDENTIALS"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "TOKEN_EXPIRED"
  | "ACCOUNT_DEACTIVATED"
  | "EMAIL_ALREADY_REGISTERED"
  | "EMAIL_NOT_VERIFIED"
  | "INVALID_TOKEN"
  | "TOKEN_ALREADY_USED"
  | "PASSWORD_TOO_WEAK"
  | "CURRENT_PASSWORD_WRONG"
  | "EVENT_NOT_FOUND"
  | "EVENT_NOT_LIVE"
  | "EVENT_NOT_EDITABLE"
  | "EVENT_ALREADY_CLOSED"
  | "INVALID_IMAGE"
  | "ITEM_NOT_FOUND"
  | "ITEM_SOLD_OUT"
  | "ALREADY_PURCHASED"
  | "RESERVATION_NOT_FOUND"
  | "RESERVATION_EXPIRED"
  | "RESERVATION_NOT_OWNED"
  | "RESERVATION_NOT_ACTIVE"
  | "EXTENSION_LIMIT_REACHED"
  | "INVALID_PAYMENT_METHOD"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

const HUMAN: Record<ErrorCode, string> = {
  INVALID_CREDENTIALS: "Email or password is incorrect.",
  UNAUTHORIZED: "Please log in to continue.",
  FORBIDDEN: "You don't have permission to do that.",
  TOKEN_EXPIRED: "Your session has expired. Please log in again.",
  ACCOUNT_DEACTIVATED: "This account has been deactivated.",
  EMAIL_ALREADY_REGISTERED: "An account with this email already exists.",
  EMAIL_NOT_VERIFIED: "Please verify your email before logging in.",
  INVALID_TOKEN: "This verification link is invalid.",
  TOKEN_ALREADY_USED: "This verification link has already been used.",
  PASSWORD_TOO_WEAK: "Password must be at least 8 characters.",
  CURRENT_PASSWORD_WRONG: "Your current password is incorrect.",
  EVENT_NOT_FOUND: "We couldn't find that event.",
  EVENT_NOT_LIVE: "This event isn't open for purchases yet.",
  EVENT_NOT_EDITABLE: "Only locked events can be edited.",
  EVENT_ALREADY_CLOSED: "This event is already closed.",
  INVALID_IMAGE: "That image couldn't be accepted. Use JPEG, PNG, or WebP under 5 MB.",
  ITEM_NOT_FOUND: "We couldn't find that item.",
  ITEM_SOLD_OUT: "Sorry, this item just sold out.",
  ALREADY_PURCHASED: "You've already purchased this item.",
  RESERVATION_NOT_FOUND: "We couldn't find that reservation.",
  RESERVATION_EXPIRED: "Your hold expired and the stock was returned.",
  RESERVATION_NOT_OWNED: "That reservation belongs to someone else.",
  RESERVATION_NOT_ACTIVE: "This reservation is no longer active.",
  EXTENSION_LIMIT_REACHED: "You've already used both extensions.",
  INVALID_PAYMENT_METHOD: "Please choose a valid payment method.",
  RATE_LIMITED: "Too many requests. Please slow down.",
  VALIDATION_ERROR: "Please check the highlighted fields.",
  INTERNAL_ERROR: "Something went wrong on our end. Please try again.",
};

export function humanMessage(code: ErrorCode | "UNKNOWN" | string): string {
  return (HUMAN as any)[code] ?? "Something went wrong.";
}
