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

/** Return a Response with Content-Type: application/json and the given status. */
function jsonError(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const errorHandler = new Elysia({ name: "errorHandler" })
  .onError({ as: "global" }, ({ error, request, code }) => {
    const requestId =
      request.headers.get("x-request-id") ??
      crypto.randomUUID().slice(0, 8);

    if (error instanceof AppError) {
      return jsonError(error.status, {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          ...(error.details ? { details: error.details } : {}),
        },
      });
    }

    if (code === "VALIDATION") {
      return jsonError(400, {
        error: {
          code: "VALIDATION_ERROR" satisfies ErrorCode,
          message: humanMessage("VALIDATION_ERROR"),
          requestId,
          details: (error as any).all
            ? (error as any).all.map((e: any) => ({ path: e.path, message: e.message }))
            : undefined,
        },
      });
    }
    if (code === "NOT_FOUND") {
      return jsonError(404, {
        error: { code: "VALIDATION_ERROR" satisfies ErrorCode, message: "Route not found.", requestId },
      });
    }
    if (code === "PARSE") {
      return jsonError(400, {
        error: { code: "VALIDATION_ERROR" satisfies ErrorCode, message: "Malformed request body.", requestId },
      });
    }

    console.error("[unhandled]", requestId, error);
    return jsonError(httpStatusFor("INTERNAL_ERROR"), {
      error: {
        code: "INTERNAL_ERROR" satisfies ErrorCode,
        message: humanMessage("INTERNAL_ERROR"),
        requestId,
      },
    });
  });
