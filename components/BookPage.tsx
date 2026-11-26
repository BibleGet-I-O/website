import type { ReactNode } from "react";
import { StickyHead } from "@/components/StickyHead";
import { renderTitle, renderVerse } from "@/lib/formatted";
import { printedLabel, verseAnchor } from "@/lib/placement";
import { printedElsewhere } from "@/lib/why";
import { WhyLink } from "@/components/WhyLink";
import type { VerseRow } from "@/lib/types";

/**
 * The book view: one column of running text as in a printed Bible, the edition's section headings where
 * they fall and the printed verse numbers as superscripts. Text is the edition's, in its own language, with
 * its layout tags rendered (poetic lines, small capitals, speakers: see lib/formatted.tsx and the `.bg-`
 * rules in app/globals.css).
 */
export function BookPage({ heading, chapter, rows, lang, tools }: { heading: string; chapter: number; rows: VerseRow[]; lang?: string; tools?: ReactNode }) {
  // A heading closes the running paragraph: group the verses into sections, each opened by its headings.
  // A mid-verse heading (`titlePosition` set) is printed inside its verse instead.
  const sections: { titles: string[]; rows: VerseRow[] }[] = [];
  for (const r of rows) {
    const before = r.titlePosition == null ? r.titles : [];
    if (sections.length === 0 || before.length > 0) sections.push({ titles: before, rows: [] });
    sections[sections.length - 1].rows.push(r);
  }
  return (
    <article lang={lang} className="font-serif text-lg leading-relaxed">
      {/* The title and the current section stay at the top while the chapter scrolls. */}
      <StickyHead title={heading} columns={[]} gridClass="" running={1} tools={tools} />
      {sections.map((s, i) => (
        <section key={i}>
          {s.titles.map((t, j) => (
            <h2 key={j} data-head-col={0} data-head-text={s.titles.at(-1)} className={j === 0 ? "mt-6 mb-2 text-xl font-semibold" : "mb-2 text-base font-semibold italic"}>
              {renderTitle(t, s.rows[0]?.notes, j, s.rows[0])}
            </h2>
          ))}
          <p className="bg-text mb-4">
            {s.rows.map((r, j) => (
              <span key={j} id={verseAnchor(r)} className="verse-target">
                {renderVerse({
                  label: printedLabel(r, chapter),
                  text: r.text,
                  titles: r.titlePosition == null ? [] : r.titles,
                  titlePosition: r.titlePosition,
                  headCol: 0,
                  notes: r.notes,
                  at: r,
                  why: printedElsewhere(r, chapter) ? <WhyLink topic="printed-elsewhere" /> : undefined,
                })}{" "}
              </span>
            ))}
          </p>
        </section>
      ))}
    </article>
  );
}
