/**
 * Minimal fetch wrapper. Always sends cookies (httpOnly session) and parses
 * the structured-JSON error envelope into a friendly Error.
 */

import { humanMessage, type ErrorCode } from "./messages";

export class ApiError extends Error {
  status: number;
  code: ErrorCode | "UNKNOWN";
  details?: unknown;
  constructor(status: number, code: ErrorCode | "UNKNOWN", message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function api<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(path.startsWith("http") ? path : path, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") ?? "";
  let json: any = null;
  try {
    if (contentType.includes("application/json")) {
      json = await res.json();
    } else {
      // Plain-text error body — treat the text as the message.
      const text = await res.text();
      if (!res.ok) {
        throw new ApiError(res.status, "UNKNOWN", text || `HTTP ${res.status}`);
      }
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    /* ignore parse failures */
  }
  if (!res.ok) {
    const code = (json?.error?.code as ErrorCode) ?? "UNKNOWN";
    // json?.error?.message  — our structured envelope
    // json?.message         — Elysia's raw validation format
    // json?.summary         — Elysia TypeBox summary field
    const message =
      json?.error?.message ??
      json?.message ??
      json?.summary ??
      humanMessage(code as any) ??
      `HTTP ${res.status}`;
    throw new ApiError(res.status, code, message, json?.error?.details);
  }
  return json as T;
}
