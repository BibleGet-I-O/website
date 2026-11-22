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
  // An empty value (a blank line copied from .env.example) counts as unset.
  const url = process.env.BIBLEGET_API_PUBLIC_URL || process.env.BIBLEGET_API_URL;
  return url ? trim(url) : null;
}

/**
 * The OpenAPI document with the public API as its only server: a `servers` list on a path or an operation would
 * override the document's (OpenAPI 3.0), so those are dropped.
 */
export function withPublicServer(doc: Record<string, unknown>, publicUrl: string): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  const source = doc.paths && typeof doc.paths === "object" ? (doc.paths as Record<string, unknown>) : {};
  for (const [path, item] of Object.entries(source)) {
    if (!item || typeof item !== "object") {
      paths[path] = item;
      continue;
    }
    const { servers: _pathServers, ...rest } = item as Record<string, unknown>;
    const ops: Record<string, unknown> = {};
    for (const [key, op] of Object.entries(rest)) {
      if (op && typeof op === "object" && !Array.isArray(op) && "servers" in op) {
        const { servers: _opServers, ...opRest } = op as Record<string, unknown>;
        ops[key] = opRest;
      } else {
        ops[key] = op;
      }
    }
    paths[path] = ops;
  }
  return { ...doc, ...(doc.paths !== undefined && { paths }), servers: [{ url: publicUrl, description: "BibleGet I/O API" }] };
}
