import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { renderVerse } from "@/lib/formatted";
import { mentionMarks } from "@/lib/mentions";
import type { VerseRow } from "@/lib/types";

const row = (verse: number, text: string, extra: Partial<VerseRow> = {}): VerseRow => ({
  chapter: 2, verse, label: String(verse), printedChapter: null, text, titles: [], ...extra,
});

describe("mention marks", () => {
  it("keysEachMarkAsItsPiecesAre", () => {
    const rows = [
      row(1, "Et dixit Petrus ad Paulum.", { mentions: [{ start: 9, end: 15, entry: "bpers:petrus" }, { start: 19, end: 25, candidates: ["a", "b"] }] }),
      row(3, "Venit Iacobus.", { segment: "a", tradition: "HEBREW", mentions: [{ start: 6, end: 13, entry: "bpers:iacobus" }] }),
      row(4, "Nemo."),
    ];
    const marks = mentionMarks(rows);
    expect(marks).toEqual({
      "2.1|0": { entry: "bpers:petrus" },
      "2.1|1": { candidates: ["a", "b"] },
      "2.3a-hebrew|0": { entry: "bpers:iacobus" },
    });
    const { container } = render(<p>{rows.map((r, i) => <span key={i}>{renderVerse({ label: r.label, text: r.text, at: r, mentions: r.mentions })}</span>)}</p>);
    const keys = new Set(Array.from(container.querySelectorAll("[data-mention]"), (el) => el.getAttribute("data-mention")));
    expect([...keys].sort()).toEqual(Object.keys(marks).sort());
  });
});
