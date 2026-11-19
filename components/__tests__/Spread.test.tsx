import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { Spread } from "@/components/Spread";
import { VerseLines } from "@/components/VerseLines";
import { buildRows, PSALMS } from "@/lib/parallel";
import type { VerseRow } from "@/lib/types";

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {ui}
  </NextIntlClientProvider>
);
const row = (chapter: number, verse: number, psalmHebrew?: string): VerseRow => ({
  chapter, verse, label: null, printedChapter: null, text: `Text ${chapter}:${verse}.`, titles: [],
  ...(psalmHebrew && { psalmHebrew }),
});
const A = { sigla: "NABRE", name: "New American Bible" };
const B = { sigla: "CEI2008", name: "Bibbia CEI 2008" };

describe("Spread", () => {
  it("missingVerseLeavesAGapNote", () => {
    // NABRE Ps 2 has 11 verses where CEI2008 has 12 (synthetic text).
    const a = Array.from({ length: 11 }, (_, i) => row(2, i + 1, `2:${i + 1}`));
    const b = Array.from({ length: 12 }, (_, i) => row(2, i + 1, `2:${i + 1}`));
    const rows = buildRows(a, b, PSALMS);
    expect(rows[11]).toMatchObject({ key: "2:12", b: { verse: 12 } });
    expect(rows[11].a).toBeUndefined();
    render(wrap(<Spread a={A} b={B} rows={rows} chapter={2} />));
    const cells = screen.getAllByTestId("cell-a");
    expect(within(cells[11]).getByText(/Not in New American Bible/)).toBeInTheDocument();
    expect(screen.getAllByText(/Not in/)).toHaveLength(1);
  });

  it("layoutIsSideBySideFromMdOrInLandscapeAndStackedInPortrait", () => {
    const rows = buildRows([row(5, 1)], [row(5, 1)], 47);
    render(wrap(<Spread a={A} b={B} rows={rows} chapter={5} />));
    const spread = screen.getByTestId("spread");
    for (const c of ["grid", "grid-cols-1", "md:grid-cols-2", "landscape:grid-cols-2"]) expect(spread).toHaveClass(c);
    // Each verse of the second edition follows its counterpart, so a single column stacks it under it.
    const order = Array.from(spread.querySelectorAll("[data-testid^=cell-]")).map((e) => e.getAttribute("data-testid"));
    expect(order).toEqual(["cell-a", "cell-b"]);
  });

  it("aCappedMainEditionLeavesTheRestOfTheSecondWithoutNotes", () => {
    const a = Array.from({ length: 2 }, (_, i) => row(5, i + 1));
    const b = Array.from({ length: 4 }, (_, i) => row(5, i + 1));
    render(wrap(<Spread a={A} b={B} rows={buildRows(a, b, 47)} chapter={5} aTruncated />));
    expect(screen.queryByText(/Not in/)).toBeNull();
    expect(screen.getByText("Text 5:4.")).toBeInTheDocument();
  });

  it("verseLinesPutOneVersePerLineWithItsNumber", () => {
    render(wrap(<VerseLines rows={[row(3, 1), row(3, 2)]} chapter={3} />));
    const lines = screen.getAllByTestId("verse-line");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toHaveTextContent("2Text 3:2.");
  });
});
