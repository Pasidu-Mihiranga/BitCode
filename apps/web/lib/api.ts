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

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const code = (json?.error?.code as ErrorCode) ?? "UNKNOWN";
    const message = json?.error?.message ?? humanMessage(code as any) ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, code, message, json?.error?.details);
  }
  return json as T;
}
