import { verseAnchor } from "@/lib/placement";
import type { Note, VerseRow } from "@/lib/types";

/** An id usable in a URL fragment and a CSS selector: a note id's ":" and anything else odd become "-". */
const slug = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, "-");

/** The id of a note in the list (and the mobile panel). */
export function noteDomId(noteId: string): string {
  return `note-${slug(noteId)}`;
}

/** The id of a note's marker on a verse: a note printed on two verses has one per verse. */
export function markerDomId(noteId: string, row: { chapter: number; verse: number; segment?: string | null }): string {
  return `m-${slug(noteId)}-${verseAnchor(row)}`;
}

/** The notes marked on these rows, once each, in page order, with their first marker (the list's link back up). */
export function chapterNotes(rows: VerseRow[]): { note: Note; first: string }[] {
  const seen = new Map<string, { note: Note; first: string }>();
  for (const r of rows) {
    for (const m of r.notes ?? []) {
      if (!seen.has(m.note.id)) seen.set(m.note.id, { note: m.note, first: markerDomId(m.note.id, r) });
    }
  }
  return [...seen.values()];
}

/** A stretch of a note's body with one formatting, inside citation `ref` (an index into the note's refs) or none. */
export type NoteRun = { text: string; i: boolean; b: boolean; sm: boolean; ref?: number };

const TAG = /^<(\/?)(i|b|sm)>/;

/**
 * A note's body as runs: `<i>`, `<b>` and `<sm>` become flags (any other tag stays literal text), and the body is
 * cut where a citation begins and ends. Spans count code points of the body as stored, tags included.
 */
export function noteRuns(body: string, refs: { span: [number, number] }[]): NoteRun[] {
  const cps = Array.from(body);
  const depth = { i: 0, b: 0, sm: 0 };
  const runs: NoteRun[] = [];
  for (let at = 0; at < cps.length; ) {
    const tag = cps[at] === "<" ? TAG.exec(cps.slice(at, at + 5).join("")) : null;
    if (tag) {
      const name = tag[2] as keyof typeof depth;
      depth[name] = Math.max(0, depth[name] + (tag[1] ? -1 : 1));
      at += tag[0].length;
      continue;
    }
    const ref = refs.findIndex((r) => r.span[0] <= at && at < r.span[1]);
    const run: NoteRun = { text: cps[at], i: depth.i > 0, b: depth.b > 0, sm: depth.sm > 0, ...(ref >= 0 && { ref }) };
    const last = runs[runs.length - 1];
    if (last && last.i === run.i && last.b === run.b && last.sm === run.sm && last.ref === run.ref) last.text += run.text;
    else runs.push(run);
    at++;
  }
  return runs;
}

/**
 * Editions whose notes the API serves (endpoint migration 064's private data halves): a visitor reading one is
 * told that signed-in readers see them.
 */
export const NOTE_EDITIONS: ReadonlySet<string> = new Set(["NABRE", "CEI2008"]);

/** The footnotes marked on these rows, for the list under the chapter (cross-references open in place). */
export function chapterFootnotes(rows: VerseRow[]): { note: Note; first: string }[] {
  return chapterNotes(rows).filter((x) => x.note.kind === "footnote");
}
