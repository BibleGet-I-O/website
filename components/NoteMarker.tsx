"use client";

import { useId, type MouseEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { OtherEditionLink } from "@/components/OtherEdition";
import { noteDomId, noteRuns } from "@/lib/notes";
import type { Note } from "@/lib/types";

/** Asks the mobile notes panel to show a note (detail: the note's id). */
export const NOTE_EVENT = "bibleget:note";

/** Below Tailwind's `sm`: the notes are in the fixed panel, not under the chapter. */
const PANEL_MEDIA = "(max-width: 39.99rem)";

function inPanel(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.(PANEL_MEDIA).matches === true && document.querySelector("[data-notes-panel]") !== null;
}

/**
 * A note's marker as printed. A footnote's is a link to the note under the chapter; on a phone a tap scrolls the
 * notes panel to it instead, and the page stays where it is. A cross-reference's opens a popover listing the
 * passages, each a link. With `children` (the verse number), the verse as a whole is marked: CEI 2008 prints
 * no marker in the line.
 */
export function NoteMarker({ note, id, children, verse }: {
  note: Note;
  id: string;
  children?: ReactNode;
  /** The verse number, for a note with no printed marker shown beside it (a verse's second CEI note): a dot. */
  verse?: string;
}) {
  const t = useTranslations("Notes");
  if (note.kind === "crossref") return <CrossReference note={note} id={id}>{children}</CrossReference>;
  const onClick = (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !inPanel()) return;
    e.preventDefault();
    window.dispatchEvent(new CustomEvent(NOTE_EVENT, { detail: note.id }));
  };
  const whole = children !== undefined;
  return (
    <a
      id={id}
      href={`#${noteDomId(note.id)}`}
      onClick={onClick}
      aria-label={whole ? t("verse", { verse: String(children) }) : note.marker ? t("footnote", { marker: note.marker }) : t("verse", { verse: verse ?? "" })}
      className={whole ? "bg-note-num" : "bg-note bg-note-foot"}
    >
      {whole ? children : (note.marker ?? "•")}
    </a>
  );
}

/** A cross-reference's marker (or, for one on the verse as a whole, its number) and its popover of passages. */
function CrossReference({ note, id, children }: { note: Note; id: string; children?: ReactNode }) {
  const t = useTranslations("Notes");
  const pop = useId();
  const runs = noteRuns(note.body, note.refs);
  const label = (i: number) => runs.filter((r) => r.ref === i).map((r) => r.text).join("").trim();
  return (
    <>
      <button
        type="button"
        id={id}
        className={children === undefined ? "bg-note bg-note-cross" : "bg-note-num"}
        popoverTarget={pop}
        aria-label={children === undefined ? t("crossref", { marker: note.marker ?? "" }) : t("crossrefVerse", { verse: String(children) })}
      >
        {children ?? note.marker}
      </button>
      <span popover="auto" id={pop} className="bg-note-pop">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t("crossrefTitle", { label: note.label ?? "" })}
        </span>
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          {note.refs.map((r, i) =>
            r.href && r.editionName ? (
              <OtherEditionLink key={i} href={r.href} name={r.editionName} className="text-red-700 underline-offset-2 hover:underline dark:text-red-400">{label(i)}</OtherEditionLink>
            ) : r.href ? (
              <a key={i} href={r.href} className="text-red-700 underline-offset-2 hover:underline dark:text-red-400">{label(i)}</a>
            ) : (
              <span key={i}>{label(i)}</span>
            ),
          )}
        </span>
      </span>
    </>
  );
}
