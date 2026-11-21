"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ReaderSettings, type SettingsChange } from "@/components/ReaderSettings";
import { SearchLens } from "@/components/SearchForm";
import { compareQuery, type View } from "@/lib/compare";
import { editionSlug } from "@/lib/slug";
import { ESTHER, type Tradition } from "@/lib/esther";

export type ReaderBarProps = {
  locale: string;
  edition: string;
  editions: { sigla: string; fullname: string }[];
  books: { slug: string; name: string; chapters: number }[];
  book: string;
  /** The book's number, the same in every edition (its slug is not): another edition opens on it. */
  bookNum: number;
  chapter: number;
  /** The compared editions (`?with=`), in order; empty when reading one edition. */
  withSiglas: string[];
  view: View;
  /** Whether the edition has both Esther texts and this is Esther: then the Greek / Hebrew choice shows. */
  esther: boolean;
  tradition?: Tradition;
};

const selectClass = "rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900";

/** The reader's top bar: edition, book and chapter, and the ⚙ menu (comparison, its layout). */
export function ReaderBar(p: ReaderBarProps) {
  const t = useTranslations("Reader");
  const router = useRouter();
  const current = p.books.find((b) => b.slug === p.book);
  const routeKey = [p.edition, p.book, p.chapter, p.withSiglas.join(","), p.view, p.tradition ?? ""].join("|");
  // What a navigation still on its way asked for: a second change made before the new page's props arrive
  // builds on it (the Interlinear toggle, then a third edition, keeps the interlinear view). It applies only
  // while the props are those it was asked from.
  const pending = useRef<{ from: string; with?: string[]; view?: View; tradition?: Tradition }>({ from: "" });
  // New props mean the navigation arrived (or Back left it): a change asked from an earlier visit is dropped.
  useEffect(() => {
    pending.current = { from: routeKey };
  }, [routeKey]);

  const go = (o: SettingsChange & { book?: string; chapter?: number }) => {
    const was = pending.current.from === routeKey ? pending.current : { from: routeKey };
    const book = o.book ?? p.book;
    const chapter = o.chapter ?? p.chapter;
    // The tradition belongs to Esther: kept only while the book stays the same; Greek is the default.
    const tradition = book === p.book ? (was.tradition ?? p.tradition) : undefined;
    const w = o.with ?? was.with ?? p.withSiglas;
    const view = o.view ?? was.view ?? p.view;
    pending.current = { from: routeKey, with: w, view, tradition };
    // Esther's two texts read alone keep the view (side by side or interlinear) too.
    // Esther's text is kept while its edition, or a compared one, prints both (`p.tradition` is then set).
    const keepsText = p.esther || p.tradition !== undefined;
    const qs = compareQuery({ with: w, view, tradition: keepsText ? tradition : undefined, twoTexts: p.esther && book === p.book && w.length === 0 });
    router.push(`/${p.locale}/read/${editionSlug(p.edition)}/${book}/${chapter}${qs}`);
  };

  // The edition's books page opens this chapter when the edition has it, and lists the books when it does not.
  const switchEdition = (sigla: string) => {
    // Like go(): a change still on its way (the Interlinear toggle) is built on.
    const was = pending.current.from === routeKey ? pending.current : { from: routeKey };
    const remaining = (was.with ?? p.withSiglas).filter((s) => s !== sigla);
    const rest = compareQuery({
      with: remaining,
      view: was.view ?? p.view,
      tradition: p.tradition,
      // Esther read alone keeps the view: the chapter page drops it unless the new edition has both texts.
      twoTexts: p.bookNum === ESTHER && remaining.length === 0,
    });
    router.push(`/${p.locale}/read/${editionSlug(sigla)}?book=${p.bookNum}&chapter=${p.chapter}${rest.replace("?", "&")}`);
  };

  return (
    <div role="toolbar" aria-label={t("toolbar")} className="mb-6 flex flex-nowrap items-center gap-1.5 text-sm sm:flex-wrap sm:gap-2">
      <label className="sr-only" htmlFor="rb-edition">{t("edition")}</label>
      {/* Below sm the edition shows as its sigla, so book and chapter fit beside it: the select lies
          transparent over it and still opens the picker of full names. */}
      <span className="relative inline-flex shrink-0">
        <span data-testid="edition-sigla" aria-hidden="true" className={`${selectClass} inline-flex items-center gap-1 sm:hidden`}>
          {p.edition}
          <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4l4 4 4-4" /></svg>
        </span>
        <select
          id="rb-edition"
          className={`${selectClass} min-w-0 max-w-full max-sm:absolute max-sm:inset-0 max-sm:w-full max-sm:opacity-0`}
          value={p.edition}
          onChange={(e) => switchEdition(e.target.value)}
        >
          {p.editions.map((e) => (
            <option key={e.sigla} value={e.sigla}>{e.fullname}</option>
          ))}
        </select>
      </span>

      <label className="sr-only" htmlFor="rb-book">{t("book")}</label>
      <select id="rb-book" className={`${selectClass} min-w-0 max-sm:flex-1`} value={p.book} onChange={(e) => go({ book: e.target.value, chapter: 1 })}>
        {p.books.map((b) => (
          <option key={b.slug} value={b.slug}>{b.name}</option>
        ))}
      </select>

      <label className="sr-only" htmlFor="rb-chapter">{t("chapter")}</label>
      <select id="rb-chapter" className={`${selectClass} shrink-0`} value={p.chapter} onChange={(e) => go({ chapter: Number(e.target.value) })}>
        {Array.from({ length: current?.chapters ?? p.chapter }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>

      <span className="ml-auto flex shrink-0 items-center">
        {/* Search the edition on screen; comparing, the first one. */}
        <SearchLens
          locale={p.locale}
          edition={p.edition}
          editionName={p.editions.find((e) => e.sigla === p.edition)?.fullname ?? p.edition}
          from={`/${p.locale}/read/${editionSlug(p.edition)}/${p.book}/${p.chapter}`}
        />
        <ReaderSettings
          editions={p.editions}
          main={p.edition}
          withSiglas={p.withSiglas}
          view={p.view}
          esther={p.esther}
          routeKey={routeKey}
          onChange={go}
        />
      </span>
    </div>
  );
}
