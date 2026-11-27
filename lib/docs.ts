import type { Locale } from "@/i18n/routing";

/**
 * The documentation section's single table of pages: their order, their part and the languages each is written in.
 * Titles, descriptions, part names and the index text are in the messages (Docs.index, Docs.parts.*, Docs.pages.<slug>);
 * content/docs/<lang>/<slug>.mdx holds each page's text. The sidebar, index, pager, <title>, sitemap and the routes'
 * static params all read this table. Design: docs/superpowers/specs/2026-11-26-documentation-section-design.md.
 */
export const DOC_PARTS = ["text", "manuscripts", "project"] as const;
export type DocPart = (typeof DOC_PARTS)[number];

const EN: readonly Locale[] = ["en"];

export const DOC_PAGES = [
  { slug: "how-the-bible-reached-us", part: "text", langs: EN },
  { slug: "canon", part: "text", langs: EN },
  { slug: "reformation", part: "text", langs: EN },
  { slug: "why-editions-differ", part: "text", langs: EN },
  { slug: "hebrew-text", part: "manuscripts", langs: EN },
  { slug: "codex-aleppo", part: "manuscripts", langs: EN },
  { slug: "codex-leningrad", part: "manuscripts", langs: EN },
  { slug: "qumran", part: "manuscripts", langs: EN },
  { slug: "septuagint", part: "manuscripts", langs: EN },
  { slug: "new-testament-text", part: "manuscripts", langs: EN },
  { slug: "codex-sinaiticus", part: "manuscripts", langs: EN },
  { slug: "codex-vaticanus", part: "manuscripts", langs: EN },
  { slug: "codex-alexandrinus", part: "manuscripts", langs: EN },
  { slug: "vulgate", part: "manuscripts", langs: EN },
  { slug: "textual-units", part: "project", langs: EN },
  { slug: "data-and-api", part: "project", langs: EN },
  { slug: "contributing", part: "project", langs: EN },
] as const satisfies readonly { slug: string; part: DocPart; langs: readonly Locale[] }[];
export type DocPage = (typeof DOC_PAGES)[number];
export type DocSlug = DocPage["slug"];

/** The languages the index (content/docs/<lang>/index.mdx) is written in. */
export const INDEX_LANGS: readonly Locale[] = EN;

/** The language a page renders in: the locale where the page is written in it, else English. */
export function docContentLang(langs: readonly Locale[], locale: Locale): Locale {
  return langs.includes(locale) ? locale : "en";
}

export function findPage(slug: string): DocPage | undefined {
  return DOC_PAGES.find((p) => p.slug === slug);
}

/** Locale-less, for the i18n Link: "/docs" for the index, "/docs/qumran" for a page. */
export function docHref(slug?: string): string {
  return slug ? `/docs/${slug}` : "/docs";
}

/** The pages before and after `slug` in reading order; empty for an unknown slug. */
export function neighbours(slug: string): { prev?: DocPage; next?: DocPage } {
  const i = DOC_PAGES.findIndex((p) => p.slug === slug);
  if (i < 0) return {};
  return { prev: DOC_PAGES[i - 1], next: DOC_PAGES[i + 1] };
}

/** The docs page of a locale-less pathname (from the i18n usePathname); null outside /docs. */
export function slugFromPath(pathname: string): { slug?: string } | null {
  const m = /^\/docs(?:\/([^/]+))?\/?$/.exec(pathname);
  return m ? { slug: m[1] } : null;
}

/** The letters NFKD leaves whole, spelled out so they aren't dropped: "Cœlum" → "coelum", not "c-lum". */
const LIGATURES: Record<string, string> = { æ: "ae", œ: "oe", ß: "ss" };

/** A heading's anchor: accents folded, ligatures and ß spelled out, apostrophes dropped, other runs of non-alphanumerics → "-". */
export function headingId(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[æœß]/g, (c) => LIGATURES[c])
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The reader's "why?" marks and the section of *Why editions differ* each opens. The ids are fixed in the English page
 * (<H2 id>, <H3 id>) and kept in every translation.
 */
export const WHY_TOPICS = ["esther", "missing-verses", "psalm-numbering", "printed-elsewhere"] as const;
export type WhyTopic = (typeof WHY_TOPICS)[number];

export function whyHref(topic: WhyTopic): string {
  return `/docs/why-editions-differ#${topic}`;
}
