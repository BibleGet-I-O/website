import { apiBase, apiPublicUrl, withPublicServer } from "@/lib/api-docs";

/** The API's OpenAPI document, fetched server-side (no key: the document is public), with the public API as server. */
export async function GET() {
  const base = apiBase();
  const pub = apiPublicUrl();
  if (!base || !pub) return Response.json({ title: "The API is not configured" }, { status: 502 });
  let res: Response;
  try {
    res = await fetch(`${base}/openapi.json`, { cache: "no-store" });
  } catch {
    return Response.json({ title: "The API could not be reached" }, { status: 502 });
  }
  if (!res.ok) return Response.json({ title: "The API's document could not be loaded" }, { status: 502 });
  const doc = withPublicServer((await res.json()) as Record<string, unknown>, pub);
  return Response.json(doc, { headers: { "cache-control": "public, max-age=300" } });
}
