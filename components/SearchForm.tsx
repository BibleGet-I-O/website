"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { editionSlug } from "@/lib/slug";

export type SearchMode = "keyword" | "semantic" | "hybrid";
const MODES: SearchMode[] = ["keyword", "semantic", "hybrid"];
const DEBOUNCE_MS = 200;
/** The word being typed: the letters at the end of the input. */
const LAST_WORD = /\p{L}+$/u;

const fieldClass = "w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900";

type FormProps = {
  locale: string;
  edition: string;
  editionName: string;
  /** The reader page the search starts from, for the results page's way back. */
  from: string;
  initial?: { mode: SearchMode; q: string; exact: boolean };
};

/**
 * Words of the edition that complete the word being typed, from the site's suggestion route (none on failure).
 * The list shown is derived from the prefix it was fetched for, so a stale answer never shows; `dismiss` hides it
 * until the prefix changes.
 */
function useSuggestions(edition: string, value: string, enabled: boolean): [string[], () => void] {
  const prefix = enabled ? (value.match(LAST_WORD)?.[0] ?? "") : "";
  const [got, setGot] = useState<{ prefix: string; words: string[] }>({ prefix: "", words: [] });
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    if (prefix.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search/suggest?${new URLSearchParams({ edition, prefix })}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { suggestions: [] }))
        .then((b: { suggestions?: unknown }) => {
          const words = Array.isArray(b.suggestions) ? b.suggestions.filter((w): w is string => typeof w === "string") : [];
          setGot({ prefix, words });
        })
        .catch(() => undefined);
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [edition, prefix]);
  const words = prefix.length >= 2 && got.prefix === prefix && dismissed !== prefix ? got.words : [];
  return [words, () => setDismissed(prefix)];
}

/**
 * The search over one edition: Keyword (one line, with suggestions for the word being typed), Semantic or Hybrid
 * (a text area for a question; Enter searches, Shift+Enter adds a line). A plain GET form to the results page, so
 * it also works without JavaScript (without suggestions).
 */
export function SearchForm({ locale, edition, editionName, from, initial }: FormProps) {
  const t = useTranslations("Search");
  const [mode, setMode] = useState<SearchMode>(initial?.mode ?? "keyword");
  const [q, setQ] = useState(initial?.q ?? "");
  const [active, setActive] = useState(-1);
  // A search already shown (the results page) suggests nothing until the reader types.
  const [picked, setPicked] = useState(initial !== undefined);
  const [words, clear] = useSuggestions(edition, q, mode === "keyword" && !picked);
  const listId = useId();
  const optionId = (i: number) => `${listId}-o${i}`;
  const open = mode === "keyword" && words.length > 0;

  const pick = (w: string) => {
    setQ(q.replace(LAST_WORD, w));
    setPicked(true);
    setActive(-1);
    clear();
  };

  const onKeywordKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      // -1 is the input itself: down from the last suggestion, or up from the first, goes back to it.
      const last = words.length - 1;
      setActive((a) => (e.key === "ArrowDown" ? (a >= last ? -1 : a + 1) : a <= -1 ? last : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(words[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setActive(-1);
      clear();
    }
  };

  const onQuestionKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter confirming an input method's candidate (Chinese, Japanese) is not a search.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (q.trim() !== "") e.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <form role="search" action={`/${locale}/read/${editionSlug(edition)}/search`} method="get" className="flex flex-col gap-2 text-sm">
      <p className="font-semibold">{t("searching", { edition: editionName })}</p>
      <fieldset className="flex flex-wrap gap-3">
        <legend className="sr-only">{t("kind")}</legend>
        {MODES.map((m) => (
          <label key={m} className="flex items-center gap-1">
            <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
            {t(`modes.${m}`)}
          </label>
        ))}
      </fieldset>
      {mode === "keyword" ? (
        <div>
          <div className="relative">
            <input
              type="search"
              name="q"
              role="combobox"
              aria-label={t("keywordLabel")}
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listId}
              aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
              autoComplete="off"
              maxLength={200}
              className={fieldClass}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPicked(false);
                setActive(-1);
              }}
              onKeyDown={onKeywordKey}
            />
            <ul id={listId} role="listbox" aria-label={t("suggestions")} hidden={!open}
              className="absolute left-0 right-0 top-full z-50 mt-1 rounded border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
              {open && words.map((w, i) => (
                <li key={w} id={optionId(i)} role="option" aria-selected={i === active}
                  className={`cursor-pointer px-2 py-1 ${i === active ? "bg-slate-100 dark:bg-slate-800" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(w);
                  }}>
                  {w}
                </li>
              ))}
            </ul>
          </div>
          <label className="mt-2 flex items-center gap-1">
            <input type="checkbox" name="match" value="exact" defaultChecked={initial?.exact ?? false} />
            {t("exact")}
          </label>
        </div>
      ) : (
        <textarea name="q" aria-label={t("questionLabel")} maxLength={500} rows={3} className={fieldClass}
          value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onQuestionKey} />
      )}
      <input type="hidden" name="from" value={from} />
      <button type="submit" className="self-end rounded bg-red-700 px-3 py-1 text-white hover:bg-red-800 dark:bg-red-600">
        {t("submit")}
      </button>
    </form>
  );
}

const noSubscribe = () => () => {};

/**
 * The reader bar's magnifying glass: opens the search form; Escape or a click outside closes it. Until the script
 * runs (or without JavaScript), it is a link to the results page, which holds the same form.
 */
export function SearchLens(props: FormProps) {
  const t = useTranslations("Search");
  const scripted = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // Opened, the form's field takes the focus, so typing starts at once.
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>("input[name=q], textarea[name=q]")?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const lensIcon = (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
  if (!scripted) {
    return (
      <a href={`/${props.locale}/read/${editionSlug(props.edition)}/search?${new URLSearchParams({ from: props.from })}`} aria-label={t("open")}
        className="inline-block rounded p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
        {lensIcon}
      </a>
    );
  }
  return (
    <div ref={rootRef} className="relative">
      <button ref={buttonRef} type="button" aria-label={t("open")} aria-expanded={open} aria-controls={open ? panelId : undefined}
        className="rounded p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        onClick={() => setOpen((o) => !o)}>
        {lensIcon}
      </button>
      {open && (
        <div ref={panelRef} id={panelId} className="absolute right-0 top-full z-50 mt-2 w-72 rounded border border-slate-200 bg-white p-3 shadow-lg sm:w-80 dark:border-slate-800 dark:bg-slate-950">
          <SearchForm {...props} />
        </div>
      )}
    </div>
  );
}
