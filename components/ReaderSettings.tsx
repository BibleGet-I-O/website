"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MAX_COMPARED, type View } from "@/lib/compare";

export type SettingsChange = { with?: string[]; view?: View };

export type ReaderSettingsProps = {
  /** Every edition, the main one included. */
  editions: { sigla: string; fullname: string }[];
  main: string;
  /** The compared editions, in order (at most MAX_COMPARED). */
  withSiglas: string[];
  view: View;
  /** This is Esther in an edition with both texts: read alone, its two texts can be read interlinear. */
  esther: boolean;
  /** Changes whenever the page shows something else (edition, book, chapter, query): the menu then closes. */
  routeKey: string;
  onChange: (o: SettingsChange) => void;
};

const itemClass = "w-full rounded px-3 py-2 text-left hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent dark:hover:bg-slate-800";
const selectClass = "rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900";

/**
 * The reader's ⚙ menu: compare with another edition, then change it, add, change or remove a third, switch
 * between side by side and interlinear (also for Esther's two texts read alone), stop comparing. An edition is chosen in a popup
 * whose dropdown offers neither the main edition nor the one in the other slot; picking one applies it.
 * The popup takes the menu items' place, so nothing behind it can be reached; Escape or Cancel close it and
 * return focus to the item that opened it, a second Escape closes the menu. A click outside, Back/Forward
 * and any change of page (`routeKey`) close both.
 */
export function ReaderSettings(p: ReaderSettingsProps) {
  const t = useTranslations("Reader");
  const [open, setOpen] = useState(false);
  /** The slot the popup chooses for (0 second, 1 third), or null when closed. */
  const [slot, setSlot] = useState<number | null>(null);
  /** The slot whose popup was just cancelled: its item gets the focus back. */
  const refocus = useRef<number | null>(null);
  // Another page closes the menu: reset while rendering when the route changes (as NavMenu does).
  const [shownFor, setShownFor] = useState(p.routeKey);
  if (p.routeKey !== shownFor) {
    setShownFor(p.routeKey);
    setOpen(false);
    setSlot(null);
  }
  const openers = useRef<(HTMLButtonElement | null)[]>([null, null]);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const panelId = useId();
  const titleId = useId();

  const close = () => {
    setSlot(null);
    setOpen(false);
  };
  const cancel = () => {
    refocus.current = slot;
    setSlot(null);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (slot !== null) {
        refocus.current = slot;
        setSlot(null);
        return;
      }
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onPopState = () => close();
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("popstate", onPopState);
    };
  }, [open, slot]);

  useEffect(() => {
    if (slot !== null) {
      selectRef.current?.focus();
    } else if (refocus.current !== null) {
      openers.current[refocus.current]?.focus();
      refocus.current = null;
    }
  }, [slot]);

  const n = p.withSiglas.length;
  const choices = (s: number) => p.editions.filter((e) => e.sigla !== p.main && e.sigla !== p.withSiglas[1 - s]);
  const choose = (s: number, sigla: string) => {
    const next = [...p.withSiglas];
    next[s] = sigla;
    close();
    p.onChange({ with: next });
  };
  const apply = (o: SettingsChange) => {
    close();
    p.onChange(o);
  };

  // Comparing, or reading Esther's two texts: side by side or one under the other.
  const interlinearToggle = (
    <label className="flex items-center gap-2 px-3 py-2">
      <input
        type="checkbox"
        checked={p.view === "interlinear"}
        onChange={(e) => p.onChange({ view: e.target.checked ? "interlinear" : "side-by-side" })}
      />
      {t("interlinear")}
    </label>
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="rounded p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={t("settings")}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 top-full z-50 mt-2 flex w-64 flex-col gap-1 rounded border border-slate-200 bg-white p-2 text-sm shadow-lg dark:border-slate-800 dark:bg-slate-950"
        >
          {slot === null && (n === 0 ? (
            <>
              <button ref={(e) => { openers.current[0] = e; }} type="button" className={itemClass} disabled={choices(0).length === 0} onClick={() => setSlot(0)}>
                {t("compare")}
              </button>
              {p.esther && interlinearToggle}
            </>
          ) : (
            <>
              <button ref={(e) => { openers.current[0] = e; }} type="button" className={itemClass} onClick={() => setSlot(0)}>{t("changeSecond")}</button>
              {n < MAX_COMPARED ? (
                choices(1).length > 0 && (
                  <button ref={(e) => { openers.current[1] = e; }} type="button" className={itemClass} onClick={() => setSlot(1)}>{t("addThird")}</button>
                )
              ) : (
                <>
                  <button ref={(e) => { openers.current[1] = e; }} type="button" className={itemClass} onClick={() => setSlot(1)}>{t("changeThird")}</button>
                  <button type="button" className={itemClass} onClick={() => apply({ with: p.withSiglas.slice(0, 1) })}>
                    {t("removeThird")}
                  </button>
                </>
              )}
              {interlinearToggle}
              <button type="button" className={itemClass} onClick={() => apply({ with: [] })}>{t("stopComparing")}</button>
            </>
          ))}

          {slot !== null && (
            <div
              role="dialog"
              aria-labelledby={titleId}
              className="flex flex-col gap-3 p-2"
            >
              <h2 id={titleId} className="font-semibold">{slot === 0 ? t("secondEdition") : t("thirdEdition")}</h2>
              <select
                ref={selectRef}
                aria-labelledby={titleId}
                className={selectClass}
                value={p.withSiglas[slot] ?? ""}
                onChange={(e) => e.target.value && choose(slot, e.target.value)}
              >
                {!p.withSiglas[slot] && <option value="">—</option>}
                {choices(slot).map((e) => (
                  <option key={e.sigla} value={e.sigla}>{e.fullname}</option>
                ))}
              </select>
              <button type="button" className="self-end rounded px-3 py-1 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={cancel}>
                {t("cancel")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
