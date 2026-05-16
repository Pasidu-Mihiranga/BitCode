/** Elysia context headers are a record; `request.headers` is a Web `Headers`. */
export type HeaderSource = Headers | Record<string, string | undefined>;

export function getHeader(headers: HeaderSource, name: string): string | null {
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
