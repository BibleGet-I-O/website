"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export type IndexTitle = { level: number; title: string; chapter: number; verse: number; segment?: string | null; href: string };

const INDENT = ["pl-2 font-semibold", "pl-6", "pl-10", "pl-14"];

type Place = { chapter: number; verse: number; segment?: string | null };

/** Whether `x` is at `opening` or before it; of one verse's parts, only the opening one itself. */
function startsByThen(x: Place, opening: Place): boolean {
  if (x.chapter !== opening.chapter) return x.chapter < opening.chapter;
  if (x.verse !== opening.verse) return x.verse < opening.verse;
  return (x.segment ?? null) === (opening.segment ?? null);
}

/**
 * The tree icon on the chapter's title line: it opens the edition's titles in this book, indented by the levels the
 * book has, each a link to its verse. The title this chapter opens under is marked and in view. A plain pick closes it
 * (ReaderBar navigates `a[data-nav]`; one in this chapter is the browser's own jump).
 */
export function TitleIndex({ book, edition, opening, titles, lang }: {
  book: string;
  edition: string;
  /** The first verse on the page (a chapter may open with a neighbour's, or with a lettered one). */
  opening: { chapter: number; verse: number; segment?: string | null };
  titles: IndexTitle[];
  lang?: string;
}) {
  const t = useTranslations("Reader");
  const tg = useTranslations("GoTo");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const current = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      current.current?.scrollIntoView?.({ block: "center" });
    } else if (!open && d.open) d.close();
  }, [open]);

  if (titles.length === 0) return null;
  const levels = [...new Set(titles.map((x) => x.level))].sort((a, b) => a - b);
  const here = titles.reduce((at, x, i) => (startsByThen(x, opening) ? i : at), -1);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={t("titleIndex", { book })}
        title={t("titleIndex", { book })}
        onClick={() => setOpen(true)}
        className="grid size-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-red-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 4v13a2 2 0 0 0 2 2h3M4 9h5M12 4h8M13 9h7M13 14h7M4 14h5M13 19h7" />
        </svg>
      </button>
      <dialog
        ref={ref}
        aria-labelledby="title-index-title"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-white p-0 text-slate-900 backdrop:bg-slate-950/50 sm:m-auto sm:h-[min(44rem,90dvh)] sm:w-[640px] sm:rounded-xl sm:shadow-xl dark:bg-slate-950 dark:text-slate-100"
      >
        {open && (
          <div className="flex h-full flex-col font-sans">
            <header className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center border-b border-slate-200 px-2 py-2 dark:border-slate-800">
              <span />
              <div className="text-center">
                <h2 id="title-index-title" className="text-lg font-semibold">{book}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{edition}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="font-semibold">{tg("close")}</button>
            </header>
            <ul lang={lang} className="flex-1 overflow-y-auto p-3">
              {titles.map((x, i) => {
                const depth = levels.indexOf(x.level);
                return (
                  <li key={i}>
                    <a
                      ref={i === here ? current : undefined}
                      data-nav=""
                      data-depth={depth}
                      href={x.href}
                      aria-current={i === here ? "true" : undefined}
                      onClick={(e) => {
                        if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) setOpen(false);
                      }}
                      className={`flex items-baseline justify-between gap-3 rounded py-1.5 pr-2 hover:bg-slate-100 dark:hover:bg-slate-800 ${INDENT[Math.min(depth, INDENT.length - 1)]}${i === here ? " text-red-700 dark:text-red-400" : ""}`}
                    >
                      <span>{x.title}</span>
                      <span className="shrink-0 text-xs font-normal text-slate-500 dark:text-slate-400">{`${x.chapter}:${x.verse}${x.segment ?? ""}`}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </dialog>
    </>
  );
}
