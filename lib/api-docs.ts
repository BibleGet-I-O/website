/**
 * The API reference at /scalar (Scalar): the endpoint's OpenAPI document, served from this site. "Test request"
 * goes from the browser straight to the API, which answers CORS for X-Api-Key, with the reader's own key: the site's
 * keys never reach the reference.
 */

const trim = (url: string) => url.replace(/\/+$/, "");

/** Where this site reaches the API (server-side; may be an internal address), or null when unset. */
export function apiBase(): string | null {
  const url = process.env.BIBLEGET_API_URL;
  return url ? trim(url) : null;
}

/** The API's public address, shown to readers of the reference as the server to call. */
export function apiPublicUrl(): string | null {
  const url = process.env.BIBLEGET_API_PUBLIC_URL ?? process.env.BIBLEGET_API_URL;
  return url ? trim(url) : null;
}

/** The OpenAPI document with the public API as its only server. */
export function withPublicServer(doc: Record<string, unknown>, publicUrl: string): Record<string, unknown> {
  return { ...doc, servers: [{ url: publicUrl, description: "BibleGet I/O API" }] };
}
