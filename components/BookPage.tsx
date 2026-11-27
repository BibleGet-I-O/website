import { Fragment, type ReactNode } from "react";
import { StickyHead } from "@/components/StickyHead";
import { renderTitle, renderVerse } from "@/lib/formatted";
import { printedLabel, verseAnchor } from "@/lib/placement";
import { omittedAfter, omittedRuns, printedElsewhere } from "@/lib/why";
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
  const sections: { titles: string[]; rows: VerseRow[]; at: number[] }[] = [];
  rows.forEach((r, i) => {
    const before = r.titlePosition == null ? r.titles : [];
    if (sections.length === 0 || before.length > 0) sections.push({ titles: before, rows: [], at: [] });
    sections[sections.length - 1].rows.push(r);
    sections[sections.length - 1].at.push(i);
  });
  // Numbers the edition prints without text (the Nova Vulgata's bracketed verses) get the rubric: rows the API marks
  // omitted, one rubric per run of consecutive numbers; numbers missing from the rows, after the verse before them.
  const omitted = omittedAfter(rows, chapter);
  const runs = omittedRuns(rows, chapter);
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
              <Fragment key={j}>
                {r.omitted && r.chapter === chapter ? (
                  runs.has(s.at[j]) ? (
                    <Omitted chapter={chapter} span={runs.get(s.at[j])!} anchor={verseAnchor(r)}>
                      {markersOf(r)}
                    </Omitted>
                  ) : (
                    <span id={verseAnchor(r)} className="verse-target">
                      {markersOf(r)}
                    </span>
                  )
                ) : (
                  <span id={verseAnchor(r)} className="verse-target">
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
                )}
                {omitted.has(s.at[j]) && <Omitted chapter={chapter} span={omitted.get(s.at[j])!} />}
              </Fragment>
            ))}
          </p>
        </section>
      ))}
    </article>
  );
}

/** An omitted row's note markers (no number, no text): the notes list links back to them. */
function markersOf(r: VerseRow): ReactNode {
  return r.notes?.length ? renderVerse({ label: null, text: "", notes: r.notes, at: r }) : null;
}

/**
 * A number the edition keeps without text: the number, a red rubric `[omissis]` and the ⓘ that explains it. An omitted
 * row passes its own anchor (with its segment) and its note markers; a number absent from the rows gets the bare one.
 */
function Omitted({ chapter, span: [from, to], anchor, children }: { chapter: number; span: [number, number]; anchor?: string; children?: ReactNode }) {
  return (
    <span id={anchor ?? verseAnchor({ chapter, verse: from })} className="verse-target">
      <sup className="mr-0.5 font-sans text-xs text-red-700 dark:text-red-400">{from === to ? from : `${from}–${to}`}</sup>
      <span lang="la" className="italic text-red-700 dark:text-red-400">[omissis]</span>
      {children}
      <WhyLink topic="missing-verses" />{" "}
    </span>
  );
}
