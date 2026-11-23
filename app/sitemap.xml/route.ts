import { getEditions } from "@/lib/api";
import { canonicalOrigin, sitemapIndexXml } from "@/lib/sitemap";
import { editionSlug } from "@/lib/slug";

// Read per request: SITE_NOINDEX and SITE_CANONICAL_ORIGIN set on the running app apply (proxy.ts never sees .xml).
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const origin = canonicalOrigin();
  if (!origin) return new Response("Not Found", { status: 404 });
  const editions = await getEditions();
  return new Response(sitemapIndexXml(origin, editions.map((e) => editionSlug(e.sigla))), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
