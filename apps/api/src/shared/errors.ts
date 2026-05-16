/**
 * Single source of truth for application error codes (FR-P06, NFR-06).
 * The same `code` strings are imported by the Next.js frontend in
 * `apps/web/lib/messages.ts` so user-facing copy stays consistent.
 */

export type ErrorCode =
  // auth
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
  // events
  | "USER_NOT_FOUND"
  | "EVENT_NOT_FOUND"
  | "EVENT_NOT_LIVE"
  | "EVENT_NOT_EDITABLE"
  | "EVENT_ALREADY_CLOSED"
  | "INVALID_IMAGE"
  // purchase
  | "ITEM_NOT_FOUND"
  | "ITEM_SOLD_OUT"
  | "ALREADY_PURCHASED"
  | "RESERVATION_NOT_FOUND"
  | "RESERVATION_EXPIRED"
  | "RESERVATION_NOT_OWNED"
  | "RESERVATION_NOT_ACTIVE"
  | "EXTENSION_LIMIT_REACHED"
  | "INVALID_PAYMENT_METHOD"
  // predictions (MiroFish microservice)
  | "PREDICTION_ENGINE_OFFLINE"
  | "PREDICTION_LLM_FAILED"
  | "PREDICTION_INSUFFICIENT_DATA"
  | "PREDICTION_NOT_FOUND"
  // system
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

const HTTP_FOR_CODE: Record<ErrorCode, number> = {
  INVALID_CREDENTIALS: 401,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  TOKEN_EXPIRED: 401,
  ACCOUNT_DEACTIVATED: 403,
  EMAIL_ALREADY_REGISTERED: 409,
  EMAIL_NOT_VERIFIED: 403,
  INVALID_TOKEN: 400,
  TOKEN_ALREADY_USED: 410,
  PASSWORD_TOO_WEAK: 400,
  CURRENT_PASSWORD_WRONG: 400,
  USER_NOT_FOUND: 404,
  EVENT_NOT_FOUND: 404,
  EVENT_NOT_LIVE: 409,
  EVENT_NOT_EDITABLE: 409,
  EVENT_ALREADY_CLOSED: 409,
  INVALID_IMAGE: 400,
  ITEM_NOT_FOUND: 404,
  ITEM_SOLD_OUT: 409,
  ALREADY_PURCHASED: 409,
  RESERVATION_NOT_FOUND: 404,
  RESERVATION_EXPIRED: 410,
  RESERVATION_NOT_OWNED: 403,
  RESERVATION_NOT_ACTIVE: 409,
  EXTENSION_LIMIT_REACHED: 409,
  INVALID_PAYMENT_METHOD: 400,
  PREDICTION_ENGINE_OFFLINE: 503,
  PREDICTION_LLM_FAILED: 502,
  PREDICTION_INSUFFICIENT_DATA: 409,
  PREDICTION_NOT_FOUND: 404,
  RATE_LIMITED: 429,
  VALIDATION_ERROR: 400,
  INTERNAL_ERROR: 500,
};

const HUMAN_MESSAGE: Record<ErrorCode, string> = {
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
  USER_NOT_FOUND: "We couldn't find that user.",
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
  PREDICTION_ENGINE_OFFLINE: "Prediction engine is offline. Try again shortly.",
  PREDICTION_LLM_FAILED: "Prediction analysis is temporarily unavailable.",
  PREDICTION_INSUFFICIENT_DATA: "Not enough activity yet to run a prediction. Try after a few sales.",
  PREDICTION_NOT_FOUND: "Prediction run not found.",
  RATE_LIMITED: "Too many requests. Please slow down.",
  VALIDATION_ERROR: "Please check the highlighted fields.",
  INTERNAL_ERROR: "Something went wrong on our end. Please try again.",
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message?: string, details?: Record<string, unknown>) {
    super(message ?? HUMAN_MESSAGE[code]);
    this.name = "AppError";
    this.code = code;
    this.status = HTTP_FOR_CODE[code];
    this.details = details;
  }
}

export function humanMessage(code: ErrorCode): string {
  return HUMAN_MESSAGE[code];
}

export function httpStatusFor(code: ErrorCode): number {
  return HTTP_FOR_CODE[code];
}
