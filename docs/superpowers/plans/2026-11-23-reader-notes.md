# Notes in the reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signed-in readers see an edition's footnotes and cross-references: markers in the text, the notes under the chapter (desktop) or in a bottom panel (mobile), and cross-references in a popup of links.

**Architecture:** With the `reader` key the site asks `/v3/quote` for `footnotes=full`. `toRow` copies each marker onto its row, with its note's body inline, so every row carries its own notes through printed placement, comparison and neighbour verses. The page turns each citation into a link (`withNoteLinks`); then `renderVerse` puts the chips in the text, and one `ChapterNotes` list is static under the chapter at `sm` and up and a fixed, draggable panel below it.

**Tech Stack:** Next.js 16, React 19, next-intl, Tailwind 4, Vitest with jsdom; native `popover` for the cross-reference popup.

**Spec:** endpoint `docs/superpowers/specs/2026-11-23-footnotes-design.md`, Part 4. API: endpoint PR #266 (`footnotes=full`: rows' `notes: [{id, kind, marker, field, position}]`; top-level `notes: {id: {kind, marker, label, title, body, refs: [{start, end, span}]}}`).

## Global Constraints

- Only the `reader` access asks for notes. Visitors' requests and responses don't change (no `footnotes` parameter; with it a visitor would get 403).
- Positions are code points into the tagged field, as `titlePosition`.
- Footnotes and cross-references get two different tints, both distinct from speaker tags, in light and dark.
- A whole-verse anchor (position null, CEI's notes) marks the verse number instead (a pale disc).
- On mobile, tapping a marker scrolls the panel to the note and highlights it, and the page doesn't move. The panel is open by default where the chapter has notes and absent where it has none. It has three sizes: a bar ("12 notes"), a quarter of the screen, half the screen. The size is remembered (localStorage, wrapped in try/catch).
- A citation links to `/read/{edition}/{book}/{printedChapter ?? chapter}#v{chapter}.{verse}{segment}` in the same edition, keeping `with` and `view`.
- Comparison: each edition's markers on its own text; the list and panel group notes by edition.
- Visitors on an edition with notes (`NOTE_EDITIONS`, NABRE for now) get a one-line hint under the chapter.
- Six languages for every new string.

## Rulings within the spec

- Note body inline on each marker (no separate map threaded through the page): the rows stay self-contained.
- `field: "chapter"` markers are shown at the start of the verse's text (position 0); the site prints no chapter heading.
- `title1..3` map to the row's `titles` index (non-empty titles only, as `toRow` builds them).
- DOM ids: note `note-{slug(id)}`, marker `m-{slug(id)}-{verseAnchor}`; a note's backlink goes to its first marker.

## Review Focus

- A marker at a position inside a line-tag boundary (`<pof>` at 0, after `<speaker>…</speaker>`) renders after the tag. (Test `markerAfterTheLineTag`.)
- Two notes at the same position keep their API order. (Test `twoMarkersAtOnePlace`.)
- A visitor's page has no markers, list or panel, and the request has no `footnotes`. (Test `visitorsAskForNoNotes`.)
- A note anchored twice on the page is listed once. (Test `aNoteMarkedTwiceIsListedOnce`.)
- A citation into a verse printed in another chapter (Wis 12:1 in 11) links to the printed chapter. (Test `citationLinksToThePrintedChapter`.)

---

### Task 1: Notes from the API

**Files:** `lib/types.ts` (`NoteMarker`, `Note`, `VerseRow.notes?`), `lib/api.ts` (`quoteRequest` adds `footnotes=full` for `reader`; `toRow` maps markers, joining bodies from the response's `notes`). Test: `lib/__tests__/api.test.ts`.

### Task 2: Note helpers

**Files:** `lib/notes.ts`: `noteDomId(id)`, `markerDomId(id, row)`, `chapterNotes(rows): {note, first}[]` (unique, page order), `withNoteLinks(rows, index, base, query)`, `bodyPieces(body, refs)`. Test: `lib/__tests__/notes.test.ts`.

### Task 3: Markers in the text

**Files:** `lib/formatted.tsx` (`renderVerse({..., notes})`: several insertion points, titles too), `components/NoteMarker.tsx` (client: a footnote is a link to its note, which on mobile scrolls the panel instead; a cross-reference is a popover of links), `app/globals.css` (tints). Test: `lib/__tests__/formatted.test.tsx`, `components/__tests__/NoteMarker.test.tsx`.

### Task 4: The notes list and panel

**Files:** `components/ChapterNotes.tsx` (client; list under the chapter at `sm` and up, fixed panel with a drag handle below, sizes `bar|quarter|half` remembered; listens for the markers' event), `lib/note-panel.ts` (size storage). Test: `components/__tests__/ChapterNotes.test.tsx`.

### Task 5: The chapter page

**Files:** `app/[locale]/read/[edition]/[book]/[chapter]/page.tsx`, `components/BookPage.tsx`, `components/VerseLines.tsx`, `components/Spread.tsx`, `messages/*.json`. The visitor hint. Run the suite, lint and build, push, PR.
