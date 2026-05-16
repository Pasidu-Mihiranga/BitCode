/** Elysia context headers are a record; `request.headers` is a Web `Headers`. */
export type HeaderBag = Headers | Record<string, string | undefined>;
/** @deprecated kept for legacy import compatibility — prefer HeaderBag */
export type HeaderSource = HeaderBag;

export function getHeader(headers: HeaderBag, name: string): string | null {
  if (headers instanceof Headers) {
    return headers.get(name);
  }
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target && value != null && value !== "") {
      return value;
    }
  }
  return null;
}

/** Alias used by middleware imports. */
export const headerGet = getHeader;
