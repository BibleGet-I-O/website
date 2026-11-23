"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GoToPanel, type PanelBook } from "@/components/GoToPanel";
import { ReaderSettings, type SettingsChange } from "@/components/ReaderSettings";
import { SearchLens, SearchPanel, SearchPanelProvider } from "@/components/SearchForm";
import { compareQuery, type View } from "@/lib/compare";
import { editionSlug } from "@/lib/slug";
import { ESTHER, type Tradition } from "@/lib/esther";

export type ReaderBarProps = {
  locale: string;
  edition: string;
  editions: { sigla: string; fullname: string }[];
  books: PanelBook[];
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
  const tg = useTranslations("GoTo");
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

  const [goToOpen, setGoToOpen] = useState(false);

  // The URL a change leads to, and what it asks for: go() pushes it, the go-to panel renders it as each link's href.
  const plan = (o: SettingsChange & { book?: string; chapter?: number }) => {
    const was = pending.current.from === routeKey ? pending.current : { from: routeKey };
    const book = o.book ?? p.book;
    const chapter = o.chapter ?? p.chapter;
    // The tradition belongs to Esther: kept only while the book stays the same; Greek is the default.
    const tradition = book === p.book ? (was.tradition ?? p.tradition) : undefined;
    const w = o.with ?? was.with ?? p.withSiglas;
    const view = o.view ?? was.view ?? p.view;
    // Esther's two texts read alone keep the view (side by side or interlinear) too.
    // Esther's text is kept while its edition, or a compared one, prints both (`p.tradition` is then set).
    const keepsText = p.esther || p.tradition !== undefined;
    const qs = compareQuery({ with: w, view, tradition: keepsText ? tradition : undefined, twoTexts: p.esther && book === p.book && w.length === 0 });
    return { href: `/${p.locale}/read/${editionSlug(p.edition)}/${book}/${chapter}${qs}`, asked: { from: routeKey, with: w, view, tradition } };
  };
  const target = (o: SettingsChange & { book?: string; chapter?: number }) => plan(o).href;

  const go = (o: SettingsChange & { book?: string; chapter?: number }) => {
    const { href, asked } = plan(o);
    pending.current = asked;
    router.push(href);
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

  // Search the edition on screen; comparing, the first one. The lens sits in the toolbar, its panel opens below it.
  const searchForm = {
    locale: p.locale,
    edition: p.edition,
    editionName: p.editions.find((e) => e.sigla === p.edition)?.fullname ?? p.edition,
    from: `/${p.locale}/read/${editionSlug(p.edition)}/${p.book}/${p.chapter}${compareQuery({
      with: p.withSiglas,
      view: p.view,
      tradition: p.esther || p.tradition !== undefined ? p.tradition : undefined,
      twoTexts: p.esther && p.withSiglas.length === 0,
    })}`,
  };

  return (
    <SearchPanelProvider {...searchForm}>
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

        {/* One button for book and chapter: it opens the go-to panel on this book's chapters. */}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={goToOpen}
          aria-label={`${tg("button")}: ${current?.name ?? p.book} ${p.chapter}`}
          onClick={() => setGoToOpen(true)}
          className={`${selectClass} inline-flex min-w-0 items-center justify-between gap-2 font-semibold max-sm:flex-1`}
        >
          <span className="truncate">{`${current?.name ?? p.book} ${p.chapter}`}</span>
          <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="shrink-0"><path d="M2 4l4 4 4-4" /></svg>
        </button>
        <GoToPanel
          open={goToOpen}
          onClose={() => setGoToOpen(false)}
          editionName={p.editions.find((e) => e.sigla === p.edition)?.fullname ?? p.edition}
          indexHref={`/${p.locale}/read/${editionSlug(p.edition)}`}
          books={p.books}
          current={{ slug: p.book, chapter: p.chapter }}
          hrefFor={(slug, chapter) => target({ book: slug, chapter })}
          onPick={(slug, chapter) => go({ book: slug, chapter })}
        />

        <span className="ml-auto flex shrink-0 items-center">
          <SearchLens />
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
      {/* Open, it sits between the toolbar and the text: closed, the toolbar keeps its spacing. */}
      <SearchPanel className="-mt-3 mb-6" />
    </SearchPanelProvider>
  );
}
