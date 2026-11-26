import { LOCALES } from "@/i18n/routing";
import { chapterNumbers } from "@/lib/chapters";
import { DOC_PAGES, docHref } from "@/lib/docs";

/**
 * The production origin sitemaps are built from (`SITE_CANONICAL_ORIGIN`), read per request. Null on staging
 * (`SITE_NOINDEX=1`) and when unset or not an http(s) URL: then no sitemap is served or named. Never the request's host.
 */
export function canonicalOrigin(): string | null {
  if (process.env.SITE_NOINDEX === "1") return null;
  const o = (process.env.SITE_CANONICAL_ORIGIN ?? "").trim().replace(/\/+$/, "");
  return /^https?:\/\/[^/\s]+$/.test(o) ? o : null;
}

/** The docs sitemap's name, /sitemaps/docs.xml (no edition has this slug). */
export const DOCS_SITEMAP = "docs";

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>';
const NS = "http://www.sitemaps.org/schemas/sitemap/0.9";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** The sitemap index: one sitemap per edition (each stays under the 50,000-URL limit), and the docs'. */
export function sitemapIndexXml(origin: string, editionSlugs: string[]): string {
  const items = [...editionSlugs, DOCS_SITEMAP].map((s) => `<sitemap><loc>${esc(`${origin}/sitemaps/${s}.xml`)}</loc></sitemap>`);
  return `${XML_HEAD}\n<sitemapindex xmlns="${NS}">\n${items.join("\n")}\n</sitemapindex>\n`;
}

/** An edition's sitemap: its index page and every chapter, in every interface language. */
export function editionSitemapXml(origin: string, editionSlug: string, books: { slug: string; chapters: number; prologue?: number }[]): string {
  const urls: string[] = [];
  for (const locale of LOCALES) {
    const base = `${origin}/${locale}/read/${editionSlug}`;
    urls.push(base);
    for (const b of books) for (const n of chapterNumbers(b)) urls.push(`${base}/${b.slug}/${n}`);
  }
  return `${XML_HEAD}\n<urlset xmlns="${NS}">\n${urls.map((u) => `<url><loc>${esc(u)}</loc></url>`).join("\n")}\n</urlset>\n`;
}

/** The docs' sitemap: the index and every page, in every interface language. */
export function docsSitemapXml(origin: string): string {
  const urls = LOCALES.flatMap((locale) => [undefined, ...DOC_PAGES.map((p) => p.slug)].map((slug) => `${origin}/${locale}${docHref(slug)}`));
  return `${XML_HEAD}\n<urlset xmlns="${NS}">\n${urls.map((u) => `<url><loc>${esc(u)}</loc></url>`).join("\n")}\n</urlset>\n`;
}
