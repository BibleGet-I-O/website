import type { Metadata } from "next";
import Link from "next/link";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { CappedNotice, noticeFor } from "@/components/CappedNotice";
import { SearchForm } from "@/components/SearchForm";
import { SearchResults, queryWords } from "@/components/SearchResults";
import { getAccess } from "@/lib/access";
import { getEditions, getIndex, slugFor } from "@/lib/api";
import { verseAnchor } from "@/lib/placement";
import { clientIp, semanticLimiter } from "@/lib/rate-limit";
import { PAGE_SIZE, SEARCH_MODES, searchEdition, type SearchHit, type SearchMode, type SearchOutcome } from "@/lib/search";
import { editionSlug } from "@/lib/slug";

type Params = { locale: string; edition: string };
type Search = { mode?: string | string[]; q?: string | string[]; match?: string | string[]; page?: string | string[]; from?: string | string[] };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const MAX_QUERY = 500;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, edition } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: "Search" });
  // Search pages are not worth indexing, whatever the deployment.
  return { title: t("metaTitle", { edition: edition.toUpperCase() }), robots: { index: false, follow: false } };
}

/** The search's own URL with some of its parameters changed (`page`, `mode`), for paging and for the cap's sign-in. */
function searchHref(locale: string, slug: string, p: { mode: SearchMode; q: string; exact: boolean; page?: number; from?: string }): string {
  const qs = new URLSearchParams({ mode: p.mode, q: p.q });
  if (p.exact && p.mode === "keyword") qs.set("match", "exact");
  if (p.page && p.page > 1) qs.set("page", String(p.page));
  else if (p.page === 1) qs.set("page", "1");
  if (p.from) qs.set("from", p.from);
  return `/${locale}/read/${slug}/search?${qs}`;
}

/**
 * The results of a search over one edition: `?mode=keyword|semantic|hybrid&q=…[&match=exact][&page=N][&from=…]`.
 * Keyword results come 50 to a page; semantic and hybrid at most 30. The API applies the copyright cap to the
 * reader's key; a capped search says so and offers to sign in, coming back to this search.
 */
export default async function SearchPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { locale, edition: editionParam } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const search = await searchParams;
  const t = await getTranslations("Search");

  const edition = (await getEditions()).find((e) => editionSlug(e.sigla) === editionParam.toLowerCase());
  if (!edition) notFound();
  const slug = editionSlug(edition.sigla);
  const rawMode = one(search.mode);
  const mode: SearchMode = SEARCH_MODES.includes(rawMode as SearchMode) ? (rawMode as SearchMode) : "keyword";
  const q = (one(search.q) ?? "").trim().slice(0, MAX_QUERY);
  const exact = mode === "keyword" && one(search.match) === "exact";
  const pageParam = Number(one(search.page) ?? "1");
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  // Back only to a page of this site's reader: the parameter is the reader's, never a way elsewhere.
  const from = one(search.from) ?? "";
  const back = from.startsWith(`/${locale}/read/`) && !from.includes("//") ? from : `/${locale}/read/${slug}`;

  let outcome: SearchOutcome | "tooMany" | null = null;
  if (q !== "") {
    const allowed = mode === "keyword" || semanticLimiter.hit(clientIp(await headers())).ok;
    outcome = allowed ? await searchEdition({ sigla: edition.sigla, mode, q, exact, page, access: (await getAccess()).access }) : "tooMany";
  }
  const index = outcome && outcome !== "tooMany" && outcome.kind === "ok" ? await getIndex(edition.sigla) : null;
  const bookOf = (h: SearchHit) => index?.books.find((b) => b.bookNum === h.bookNum);
  const hrefFor = (h: SearchHit) => {
    const b = bookOf(h);
    const bookSlug = b && index ? slugFor(b, index.books) : String(h.bookNum);
    return `/${locale}/read/${slug}/${bookSlug}/${h.printedChapter ?? h.chapter}#${verseAnchor(h)}`;
  };

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <p className="mb-4 text-sm">
        <Link href={back} className="hover:underline">{t("back")}</Link>
      </p>
      <h1 className="mb-2 text-2xl font-semibold">{t("heading", { edition: edition.fullname })}</h1>
      <div className="mb-6 rounded border border-slate-200 p-3 dark:border-slate-800">
        <SearchForm locale={locale} edition={edition.sigla} editionName={edition.fullname} from={back} initial={{ mode, q, exact }} />
      </div>
      {q === "" ? (
        <p>{t("empty")}</p>
      ) : (
        <>
          <p className="mb-6 text-slate-600 dark:text-slate-400">
            {t(`modes.${mode}`)}: <q>{q}</q>
          </p>
          {await body()}
        </>
      )}
    </main>
  );

  async function body() {
    if (outcome === "tooMany") return <p role="status">{t("tooMany")}</p>;
    if (!outcome) return null;
    if (outcome.kind === "refused") return <p role="status">{t("refused")}</p>;
    if (outcome.kind === "semanticUnavailable") {
      return (
        <p role="status">
          {t("semanticUnavailable")}{" "}
          <Link href={searchHref(locale, slug, { mode: "keyword", q, exact: false })} className="underline">{t("tryKeyword")}</Link>
        </p>
      );
    }
    const { hits, total, capped } = outcome;
    if (hits.length === 0) return <p role="status">{t("noResults", { q })}</p>;
    const start = mode === "keyword" ? (page - 1) * PAGE_SIZE + 1 : 1;
    const end = start + hits.length - 1;
    const pages = mode === "keyword" ? Math.ceil(total / PAGE_SIZE) : 1;
    const access = capped !== null ? await getAccess() : null;
    const notice = access ? noticeFor(true, access, edition!.copyright) : null;
    return (
      <>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          {capped !== null
            ? t("capped", { shown: total, total: capped })
            : pages > 1
              ? t("range", { from: start, to: end, total })
              : t("results", { count: total })}
        </p>
        <SearchResults hits={hits} start={start} hrefFor={hrefFor} bookName={(h) => bookOf(h)?.name ?? h.book} mark={mode === "keyword" ? queryWords(q) : []} />
        {pages > 1 && (
          <nav aria-label={t("pages")} className="mt-6 flex justify-between text-sm">
            {page > 1 ? <Link href={searchHref(locale, slug, { mode, q, exact, page: page - 1 })} className="hover:underline">{t("previous")}</Link> : <span />}
            {page < pages ? <Link href={searchHref(locale, slug, { mode, q, exact, page: page + 1 })} className="hover:underline">{t("next")}</Link> : <span />}
          </nav>
        )}
        {notice && await CappedNotice({ kind: notice, about: "search", redirectTo: searchHref(locale, slug, { mode, q, exact, page: page > 1 ? page : undefined }) })}
      </>
    );
  }
}
