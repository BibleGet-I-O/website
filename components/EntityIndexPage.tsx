import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { EntityIndex } from "@/components/EntityIndex";
import { getEditions, getIndex, NotFound } from "@/lib/api";
import { getEntityIndex, type EntityType } from "@/lib/entities";
import { editionSlug } from "@/lib/slug";

export type IndexParams = { locale: string; edition: string };
export type IndexSearch = { letter?: string | string[]; back?: string | string[] };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const HEADING = { person: "personsIn", place: "placesIn", event: "eventsIn" } as const;

/** Any fixed origin: a back path is resolved against it only to see where the browser would take it. */
const ORIGIN = "https://bibleget.invalid";

/**
 * The reader page an index was opened from: only a path of this edition's reader on this site, checked once resolved
 * (so "/en/read/nvbse/../nabre/…", plain or percent-encoded, does not pass), with its query and fragment; else none.
 */
export function backTo(back: string | undefined, locale: string, sigla: string): string | null {
  if (!back || !back.startsWith("/") || back.includes("//") || back.includes("\\")) return null;
  let url: URL;
  try {
    url = new URL(back, ORIGIN);
  } catch {
    return null;
  }
  const prefix = `/${locale}/read/${editionSlug(sigla)}/`;
  return url.origin === ORIGIN && url.pathname.startsWith(prefix) ? `${url.pathname}${url.search}${url.hash}` : null;
}

/** The tab's title: "Places in Nova Vulgata", as the page's heading; none for an edition that does not exist. */
export async function indexMetadata(params: Promise<IndexParams>, type: EntityType): Promise<Metadata> {
  const { locale, edition: slug } = await params;
  const edition = (await getEditions()).find((e) => editionSlug(e.sigla) === slug.toLowerCase());
  if (!edition) return {};
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: "Reader.indices" });
  return { title: t(HEADING[type], { edition: edition.fullname }) };
}

/** /read/[edition]/persons, /places, /events: the edition's index of one type (components/EntityIndex). */
export async function EntityIndexPage({ params, searchParams, type }: { params: Promise<IndexParams>; searchParams?: Promise<IndexSearch>; type: EntityType }) {
  const { locale, edition: editionParam } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const edition = (await getEditions()).find((e) => editionSlug(e.sigla) === editionParam.toLowerCase());
  if (!edition) notFound();
  let books;
  try {
    books = (await getIndex(edition.sigla)).books;
  } catch (err) {
    if (err instanceof NotFound) notFound();
    throw err;
  }
  const search = (await searchParams) ?? {};
  const entities = await getEntityIndex(edition.sigla, type);
  const letter = one(search.letter)?.toUpperCase() ?? null;
  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <EntityIndex
        editionName={edition.fullname}
        sigla={edition.sigla}
        editionLang={edition.language}
        type={type}
        entities={entities}
        books={books}
        letter={letter}
        locale={locale}
        back={backTo(one(search.back), locale, edition.sigla)}
      />
    </main>
  );
}
