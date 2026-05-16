/**
 * Global error handler (NFR-06). Every response that is not a happy-path
 * 2xx ends up here and gets the same shape:
 *
 *   { "error": { "code": "...", "message": "...", "requestId": "..." } }
 *
 * Never leaks a stack trace or an internal error message to the client.
 */

import { Elysia } from "elysia";
import { AppError, httpStatusFor, humanMessage, type ErrorCode } from "../shared/errors";

export const errorHandler = new Elysia({ name: "errorHandler" })
  .onError(({ error, set, request, code }) => {
    const requestId =
      request.headers.get("x-request-id") ??
      crypto.randomUUID().slice(0, 8);

    if (error instanceof AppError) {
      set.status = error.status;
      return {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          ...(error.details ? { details: error.details } : {}),
        },
      };
    }

    // Elysia native code mapping (validation, not found, parse errors)
    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: {
          code: "VALIDATION_ERROR" satisfies ErrorCode,
          message: humanMessage("VALIDATION_ERROR"),
          requestId,
          // surface only the field paths, never internal "expected" strings
          details: (error as any).all
            ? (error as any).all.map((e: any) => ({ path: e.path, message: e.message }))
            : undefined,
        },
      };
    }
    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        error: {
          code: "VALIDATION_ERROR" satisfies ErrorCode,
          message: "Route not found.",
          requestId,
        },
      };
    }
    if (code === "PARSE") {
      set.status = 400;
      return {
        error: {
          code: "VALIDATION_ERROR" satisfies ErrorCode,
          message: "Malformed request body.",
          requestId,
        },
      };
    }

    // Unknown — log on server, keep client message generic.
    console.error("[unhandled]", requestId, error);
    set.status = httpStatusFor("INTERNAL_ERROR");
    return {
      error: {
        code: "INTERNAL_ERROR" satisfies ErrorCode,
        message: humanMessage("INTERNAL_ERROR"),
        requestId,
      },
    };
  });
