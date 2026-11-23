import { getEditions, getIndex, slugFor } from "@/lib/api";
import { canonicalOrigin, editionSitemapXml } from "@/lib/sitemap";
import { editionSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

const notFound = () => new Response("Not Found", { status: 404 });

/** `/sitemaps/{edition}.xml`: the edition's index page and every chapter (404 on staging or without an origin). */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }): Promise<Response> {
  const origin = canonicalOrigin();
  if (!origin) return notFound();
  const m = /^([a-z0-9-]+)\.xml$/.exec((await params).file);
  if (!m) return notFound();
  const edition = (await getEditions()).find((e) => editionSlug(e.sigla) === m[1]);
  if (!edition) return notFound();
  const { books } = await getIndex(edition.sigla);
  const xml = editionSitemapXml(origin, m[1], books.map((b) => ({ slug: slugFor(b, books), chapters: b.chapters })));
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
