"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { groupBySection, sectionOf, type SectionKey, type Testament } from "@/lib/sections";

export type PanelBook = { slug: string; name: string; chapters: number; bookNum: number };

export type GoToPanelProps = {
  open: boolean;
  onClose: () => void;
  editionName: string;
  /** Locale-prefixed path of the edition's index page (the "All chapters" link). */
  indexHref: string;
  books: PanelBook[];
  current: { slug: string; chapter: number };
  /** The full (locale-prefixed) URL a jump goes to, with the reader's kept query. */
  hrefFor: (slug: string, chapter: number) => string;
  /** A plain click: navigate (ReaderBar.go). The panel closes itself afterwards. */
  onPick: (slug: string, chapter: number) => void;
};

type Level =
  | { level: "chapters"; slug: string }
  | { level: "books"; testament: Testament; section?: SectionKey }
  | { level: "bible" };

/** A plain primary click, which the panel handles itself; any other (new tab, new window) is the browser's. */
const plain = (e: MouseEvent) => !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

const tile =
  "rounded-lg border border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600";
const currentTile = "border-red-700 bg-red-700 text-white hover:border-red-700 dark:border-red-500 dark:bg-red-600 dark:text-white";

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

/**
 * The reader's go-to panel: the current book's chapters, the books of a testament by section, and the whole Bible in
 * two columns. A back arrow climbs a level; the breadcrumb at the bottom shows the levels and links all but the last.
 */
export function GoToPanel(p: GoToPanelProps) {
  const t = useTranslations("GoTo");
  const tb = useTranslations("Books");
  const ref = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<Level>({ level: "chapters", slug: p.current.slug });
  const sectionRefs = useRef(new Map<SectionKey, HTMLElement>());
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Set by a move between levels (not by opening): the title then takes focus, as the control pressed may be gone.
  const moved = useRef(false);
  const [highlighted, setHighlighted] = useState<SectionKey | null>(null);
  const move = (v: Level) => {
    moved.current = true;
    setView(v);
  };

  // Each opening starts on the current book's chapters (state adjusted while rendering, not in an effect).
  const [wasOpen, setWasOpen] = useState(p.open);
  if (p.open !== wasOpen) {
    setWasOpen(p.open);
    if (p.open) setView({ level: "chapters", slug: p.current.slug });
  }

  // The dialog follows `open`: shown modal when it turns true, closed when the parent closes it.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (p.open && !d.open) d.showModal();
    else if (!p.open && d.open) d.close();
  }, [p.open]);

  // Esc and the system back gesture close the dialog: the parent learns it here.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const closed = () => p.onClose();
    d.addEventListener("close", closed);
    return () => d.removeEventListener("close", closed);
  }, [p]);

  // Each level opens at its top, or at the section it was asked for; after a move the title takes focus.
  useEffect(() => {
    const section = view.level === "books" && view.section ? sectionRefs.current.get(view.section) : undefined;
    if (section?.scrollIntoView) section.scrollIntoView({ block: "start" });
    else if (bodyRef.current) bodyRef.current.scrollTop = 0;
    if (moved.current) {
      moved.current = false;
      titleRef.current?.focus();
    }
  }, [view]);

  // A section opened from The Bible is highlighted for a moment.
  useEffect(() => {
    if (!highlighted) return;
    const id = setTimeout(() => setHighlighted(null), 1200);
    return () => clearTimeout(id);
  }, [highlighted]);

  const book = view.level === "chapters" ? p.books.find((b) => b.slug === view.slug) : undefined;
  const testament: Testament | undefined =
    view.level === "books" ? view.testament : book ? sectionOf(book.bookNum).testament : undefined;
  const currentBook = p.books.find((b) => b.slug === p.current.slug);
  const currentSection = currentBook ? sectionOf(currentBook.bookNum).key : undefined;
  const testamentName = (x: Testament) => tb(x);

  const goBack = () => {
    if (view.level === "chapters" && book) {
      const s = sectionOf(book.bookNum);
      move({ level: "books", testament: s.testament, section: s.key });
    } else move({ level: "bible" });
  };

  const title = view.level === "chapters" ? (book?.name ?? "") : view.level === "books" ? testamentName(view.testament) : t("bible");
  const groups = groupBySection(p.books);

  return (
    <dialog
      ref={ref}
      aria-labelledby="goto-title"
      // A click on the backdrop (the dialog itself, outside its content) closes it, as people expect of a centred box.
      onClick={(e) => {
        if (e.target === e.currentTarget) p.onClose();
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-white p-0 text-slate-900 backdrop:bg-slate-950/50 sm:m-auto sm:h-[min(44rem,90dvh)] sm:w-[640px] sm:rounded-xl sm:shadow-xl dark:bg-slate-950 dark:text-slate-100"
    >
      {p.open && (
        <div className="flex h-full flex-col">
          <header className="grid grid-cols-[3rem_1fr_4.5rem] items-center border-b border-slate-200 px-2 py-2 dark:border-slate-800">
            {view.level !== "bible" ? (
              <button type="button" onClick={goBack} aria-label={t("back")} className="grid size-10 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
            ) : (
              <span />
            )}
            <div className="text-center">
              <h2 id="goto-title" ref={titleRef} tabIndex={-1} className="text-lg font-semibold outline-none">{title}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{p.editionName}</p>
            </div>
            <button type="button" onClick={() => p.onClose()} className="font-semibold">
              {t("close")}
            </button>
          </header>

          <div ref={bodyRef} data-goto-body className="flex-1 overflow-y-auto p-3">
            {view.level === "chapters" && book && (
              <ul className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                {Array.from({ length: book.chapters }, (_, i) => i + 1).map((n) => {
                  const here = book.slug === p.current.slug && n === p.current.chapter;
                  return (
                    <li key={n}>
                      <a
                        href={p.hrefFor(book.slug, n)}
                        aria-current={here ? "true" : undefined}
                        onClick={(e) => {
                          if (!plain(e)) return;
                          e.preventDefault();
                          p.onPick(book.slug, n);
                          p.onClose();
                        }}
                        className={`grid aspect-square place-items-center font-semibold ${tile} ${here ? currentTile : ""}`}
                      >
                        {n}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}

            {view.level === "books" &&
              groups
                .filter((g) => g.testament === view.testament)
                .map((g) => (
                  <section
                    key={g.key}
                    ref={(el) => { if (el) sectionRefs.current.set(g.key, el); }}
                    data-highlighted={highlighted === g.key ? "true" : undefined}
                    className="-mx-1 mb-4 scroll-mt-2 rounded-lg px-1 transition-colors duration-700 data-[highlighted=true]:bg-red-50 dark:data-[highlighted=true]:bg-red-950/40"
                  >
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400">{t(`sections.${g.key}`)}</h3>
                    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {g.books.map((b) => {
                        const here = b.slug === p.current.slug;
                        return (
                          <li key={b.slug}>
                            <a
                              href={p.hrefFor(b.slug, 1)}
                              aria-current={here ? "true" : undefined}
                              onClick={(e) => {
                                if (!plain(e)) return;
                                e.preventDefault();
                                move({ level: "chapters", slug: b.slug });
                              }}
                              className={`flex min-h-12 items-center justify-center px-1 py-2 text-center text-sm ${tile} ${here ? currentTile : ""}`}
                            >
                              {b.name}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}

            {view.level === "bible" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {(["ot", "nt"] as const).map((x) => (
                    <div key={x}>
                      <button
                        type="button"
                        onClick={() => move({ level: "books", testament: x })}
                        className="mb-2 text-left text-sm font-bold uppercase tracking-wide text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                      >
                        {testamentName(x)}
                      </button>
                      {groups
                        .filter((g) => g.testament === x)
                        .map((g) => (
                          <button
                            key={g.key}
                            type="button"
                            onClick={() => {
                              setHighlighted(g.key);
                              move({ level: "books", testament: x, section: g.key });
                            }}
                            className={`mb-2 block w-full p-3 text-left ${tile} ${g.key === currentSection ? "border-red-700 dark:border-red-500" : ""}`}
                          >
                            <span className="block font-semibold">{t(`sections.${g.key}`)}</span>
                            <span className="text-sm text-slate-500 dark:text-slate-400">{t("bookCount", { count: g.books.length })}</span>
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-center">
                  <a href={p.indexHref} className="text-sm text-red-700 underline dark:text-red-400">
                    {t("allChapters")}
                  </a>
                </p>
              </>
            )}
          </div>

          <nav aria-label={t("whereYouAre")} className="flex items-center justify-center gap-1 overflow-x-auto border-t border-slate-200 px-3 pb-5 pt-3 whitespace-nowrap dark:border-slate-800">
            {view.level === "bible" ? (
              <span aria-current="page" aria-label={t("home")} role="img" className="p-1">
                <HomeIcon />
              </span>
            ) : (
              <button type="button" aria-label={t("home")} onClick={() => move({ level: "bible" })} className="rounded p-1 text-red-700 dark:text-red-400">
                <HomeIcon />
              </button>
            )}
            {testament && (
              <>
                <span aria-hidden="true" className="text-slate-400">›</span>
                {view.level === "books" ? (
                  <span aria-current="page" className="px-1 font-bold">{testamentName(testament)}</span>
                ) : (
                  <button type="button" onClick={() => move({ level: "books", testament })} className="rounded px-1 text-red-700 dark:text-red-400">
                    {testamentName(testament)}
                  </button>
                )}
              </>
            )}
            {book && (
              <>
                <span aria-hidden="true" className="text-slate-400">›</span>
                <span aria-current="page" className="px-1 font-bold">{book.name}</span>
              </>
            )}
          </nav>
        </div>
      )}
    </dialog>
  );
}
