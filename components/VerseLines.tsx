import { renderTitle, renderVerse } from "@/lib/formatted";
import { printedLabel, verseAnchor } from "@/lib/placement";
import type { VerseRow } from "@/lib/types";

const midHeadingClass = (j: number) =>
  j === 0 ? "mt-4 mb-1 block font-semibold" : "mb-1 block text-base font-semibold italic";

/** The section headings printed before a verse (none when they fall inside it, at `titlePosition`). */
export function headingsBefore(row: VerseRow | undefined): string[] {
  return row && row.titlePosition == null ? row.titles : [];
}

/**
 * Section headings, level with the verse text. `col` makes them feed that column's running head at the top of
 * the page (StickyHead); headings printed together give it their last, the most specific.
 */
export function Headings({ titles, col, row }: { titles: string[]; col?: number; row?: VerseRow }) {
  return titles.map((t, j) => (
    <h2 key={j} data-head-col={col} data-head-text={col == null ? undefined : titles.at(-1)} className={j === 0 ? "mt-4 mb-1 font-semibold" : "mb-1 text-base font-semibold italic"}>
      {renderTitle(t, row?.notes, j, row)}
    </h2>
  ));
}

/**
 * One verse on its own line, its printed number (in rubric red) at the start of the text, and its section headings
 * above it (or inside it, at `titlePosition`): no gutter, so narrow columns keep their width for the text. Poetic
 * lines keep their relative indents.
 * `headings={false}` leaves the headings before the verse to the caller (the interlinear gives them a row);
 * `anchor` makes this line the one a link to the verse (#v3.16) lands on (one side of a page only); `headCol`
 * makes its headings feed that column's running head.
 */
export function VerseLine({ row, chapter, headings = true, anchor = false, headCol }: { row: VerseRow; chapter: number; headings?: boolean; anchor?: boolean; headCol?: number }) {
  const mid = row.titlePosition != null;
  return (
    <>
      {headings && <Headings titles={headingsBefore(row)} col={headCol} row={row} />}
      <p data-testid="verse-line" id={anchor ? verseAnchor(row) : undefined} className={`bg-text bg-compact${anchor ? " verse-target" : ""}`}>
        {renderVerse({ label: printedLabel(row, chapter), text: row.text, titles: mid ? row.titles : [], titlePosition: row.titlePosition, headingClass: midHeadingClass, headCol, notes: row.notes, at: row })}
      </p>
    </>
  );
}

/** An edition's chapter one verse per line, as the interlinear sets it; `headCol` feeds a running head. */
export function VerseLines({ rows, chapter, lang, headCol }: { rows: VerseRow[]; chapter: number; lang?: string; headCol?: number }) {
  return (
    <div lang={lang} className="space-y-1 font-serif text-lg leading-relaxed">
      {rows.map((r, i) => (
        <VerseLine key={i} row={r} chapter={chapter} headCol={headCol} />
      ))}
    </div>
  );
}
