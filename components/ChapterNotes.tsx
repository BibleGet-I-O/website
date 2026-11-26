"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { NOTE_EVENT } from "@/components/NoteMarker";
import { PrintedText } from "@/components/PrintedText";
import { DEFAULT_SIZE, loadPanelSize, nextSize, savePanelSize, snapSize, subscribePanelSize, type PanelSize } from "@/lib/note-panel";
import { noteDomId } from "@/lib/notes";
import type { Note } from "@/lib/types";

export type NoteGroup = { edition: string; name: string; notes: { note: Note; first: string }[] };

/** The panel's height below `sm`, per size; at `sm` and up the list is static under the chapter. */
const HEIGHT: Record<PanelSize, string> = { bar: "2.75rem", quarter: "25dvh", half: "50dvh" };
const HIGHLIGHT_MS = 2000;
/** A drag shorter than this is a tap on the handle. */
const DRAG_PX = 8;

function Body({ note }: { note: Note }): ReactNode {
  return <PrintedText text={note.body} refs={note.refs} />;
}

/**
 * The chapter's footnotes. At `sm` and up, a list under the chapter; each note's marker (or verse) links back up
 * to its marker in the text. Below `sm`, the same list in a panel fixed at the bottom of the screen, a quarter
 * of it tall by default: its handle drags it down to a bar or up to half the screen (a tap cycles), the choice
 * remembered; a tap on a marker in the text scrolls the panel to its note and highlights it, and the page stays put.
 * In a comparison, the notes are grouped by edition. Nothing is shown without notes.
 */
export function ChapterNotes({ groups }: { groups: NoteGroup[] }) {
  const t = useTranslations("Notes");
  const size = useSyncExternalStore(subscribePanelSize, loadPanelSize, () => DEFAULT_SIZE);
  const [lit, setLit] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  const count = groups.reduce((n, g) => n + g.notes.length, 0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const el = document.getElementById(noteDomId(id));
      const list = listRef.current;
      if (!el || !list) return;
      if (loadPanelSize() === "bar") savePanelSize("quarter");
      // The list is the notes' offset parent (it is `relative`): their offsetTop is already from its top.
      list.scrollTop = el.offsetTop;
      setLit(id);
      clearTimeout(timer);
      timer = setTimeout(() => setLit(null), HIGHLIGHT_MS);
    };
    window.addEventListener(NOTE_EVENT, show);
    return () => {
      window.removeEventListener(NOTE_EVENT, show);
      clearTimeout(timer);
    };
  }, []);

  if (count === 0) return null;

  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    const panel = e.currentTarget.closest("[data-notes-panel]") as HTMLElement | null;
    drag.current = { y: e.clientY, h: panel?.getBoundingClientRect().height ?? 0, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (Math.abs(dy) < DRAG_PX && !d.moved) return;
    d.moved = true;
    const panel = e.currentTarget.closest("[data-notes-panel]") as HTMLElement | null;
    panel?.style.setProperty("--notes-h", `${Math.max(44, d.h + dy)}px`);
  };
  const onUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d?.moved) return;
    const panel = e.currentTarget.closest("[data-notes-panel]") as HTMLElement | null;
    const h = panel?.getBoundingClientRect().height ?? 0;
    const snapped = snapSize(h / window.innerHeight);
    // Set back, not removed: a drag that snaps to the size it had re-renders nothing, and React would not restore it.
    panel?.style.setProperty("--notes-h", HEIGHT[snapped]);
    savePanelSize(snapped);
  };
  // The system took the touch away (a call, a gesture): back to the size it had.
  const onCancel = (e: PointerEvent<HTMLButtonElement>) => {
    drag.current = null;
    (e.currentTarget.closest("[data-notes-panel]") as HTMLElement | null)?.style.setProperty("--notes-h", HEIGHT[size]);
  };
  const onClick = () => {
    // A drag already chose the size; a tap cycles it.
    if (drag.current?.moved) {
      drag.current = null;
      return;
    }
    drag.current = null;
    savePanelSize(nextSize(loadPanelSize()));
  };

  return (
    <>
      {/* Below sm, room under the chapter for the fixed panel, so the last verses can be read above it. */}
      <div aria-hidden="true" className="sm:hidden" style={{ height: HEIGHT[size] }} />
      <section
        data-notes-panel=""
        data-size={size}
        aria-labelledby="chapter-notes-title"
        style={{ "--notes-h": HEIGHT[size] } as React.CSSProperties}
        className="mt-10 border-t border-slate-200 pt-4 font-sans text-sm dark:border-slate-800 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-30 max-sm:mt-0 max-sm:flex max-sm:h-[var(--notes-h)] max-sm:flex-col max-sm:border-t max-sm:bg-white max-sm:pt-0 max-sm:shadow-[0_-6px_20px_rgb(0_0_0/0.12)] max-sm:dark:bg-slate-950"
      >
        <button
          type="button"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onCancel}
          onClick={onClick}
          aria-label={`${t("resize")}: ${t("count", { count })}`}
          className="flex w-full shrink-0 touch-none flex-col items-center gap-1 py-1.5 text-xs text-slate-500 sm:hidden dark:text-slate-400"
        >
          <span aria-hidden="true" className="block h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
          <span>{t("count", { count })}</span>
        </button>
        <h2 id="chapter-notes-title" className="mb-3 text-base font-semibold max-sm:sr-only">{t("heading")}</h2>
        <div ref={listRef} className="relative max-sm:flex-1 max-sm:overflow-y-auto max-sm:overscroll-contain max-sm:px-4 max-sm:pb-4">
          {groups.filter((g) => g.notes.length > 0).map((g) => (
            <div key={g.edition} className="mb-4">
              {groups.length > 1 && <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400">{g.name}</h3>}
              <ol className="space-y-2">
                {g.notes.map(({ note, first }) => {
                  const mark = note.marker ?? note.label ?? "";
                  return (
                    <li
                      key={note.id}
                      id={noteDomId(note.id)}
                      data-highlight={lit === note.id ? "true" : undefined}
                      className="scroll-mt-24 rounded px-1 leading-relaxed transition-colors data-[highlight=true]:bg-red-50 target:bg-red-50 dark:data-[highlight=true]:bg-red-950/40 dark:target:bg-red-950/40"
                    >
                      <a href={`#${first}`} aria-label={`${t("backToText")}: ${mark}`} className="mr-1.5 font-semibold text-red-700 hover:underline dark:text-red-400">
                        {note.marker ? `${note.marker} ${note.label ?? ""}`.trim() : mark}
                      </a>
                      {note.title && <b className="mr-1">{note.title}</b>}
                      <Body note={note} />
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
