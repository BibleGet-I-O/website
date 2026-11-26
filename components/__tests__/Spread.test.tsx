import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...p }: { href: string; children?: React.ReactNode }) => <a href={href} {...p}>{children}</a>,
}));

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
const C = { sigla: "VGCL", name: "Vulgata Clementina" };

describe("Spread", () => {
  it("missingVerseLeavesAGapNote", () => {
    // NABRE Ps 2 has 11 verses where CEI2008 has 12 (synthetic text).
    const a = Array.from({ length: 11 }, (_, i) => row(2, i + 1, `2:${i + 1}`));
    const b = Array.from({ length: 12 }, (_, i) => row(2, i + 1, `2:${i + 1}`));
    const rows = buildRows(a, [b], PSALMS);
    expect(rows[11]).toMatchObject({ key: "2:12", others: [{ verse: 12 }] });
    expect(rows[11].a).toBeUndefined();
    render(wrap(<Spread sides={[A, B]} rows={rows} chapter={2} />));
    const cells = screen.getAllByTestId("cell-a");
    expect(within(cells[11]).getByText(/Not in New American Bible/)).toBeInTheDocument();
    expect(screen.getAllByText(/Not in/)).toHaveLength(1);
  });

  it("twoEditionsSideBySideHaveTwoColumnsAtEveryWidth", () => {
    const rows = buildRows([row(5, 1)], [[row(5, 1)]], 47);
    render(wrap(<Spread sides={[A, B]} rows={rows} chapter={5} />));
    const spread = screen.getByTestId("spread");
    expect(spread).toHaveClass("grid", "grid-cols-2");
    expect(spread.className).not.toMatch(/(md|landscape):grid-cols/);
    expect(screen.getAllByTestId("column-name").map((e) => e.textContent)).toEqual([A.name, B.name]);
    for (const e of screen.getAllByTestId("column-name")) expect(e.className).not.toMatch(/hidden/);
    expect(screen.queryByTestId("sigla")).toBeNull();
  });

  it("threeEditionsSideBySideHaveThreeColumnsAtEveryWidth", () => {
    const rows = buildRows([row(5, 1)], [[row(5, 1)], [row(5, 1)]], 47);
    render(wrap(<Spread sides={[A, B, C]} rows={rows} chapter={5} />));
    const spread = screen.getByTestId("spread");
    expect(spread).toHaveClass("grid", "grid-cols-3");
    expect(screen.getAllByTestId("column-name").map((e) => e.textContent)).toEqual([A.name, B.name, C.name]);
    const order = Array.from(spread.querySelectorAll("[data-testid^=cell-]")).map((e) => e.getAttribute("data-testid"));
    expect(order).toEqual(["cell-a", "cell-b", "cell-c"]);
    // No number margin at all: the number runs inline, so three columns keep their width for the text.
    expect(screen.getAllByTestId("verse-line")[0].querySelector("sup")).toHaveTextContent("1");
  });

  it("interlinearStacksEachComparedVerseUnderTheMainOneWithItsSigla", () => {
    const rows = buildRows([row(5, 1), row(5, 2)], [[row(5, 1), row(5, 2)], [row(5, 1), row(5, 2)]], 47);
    render(wrap(<Spread sides={[A, B, C]} rows={rows} chapter={5} view="interlinear" />));
    const spread = screen.getByTestId("spread");
    expect(spread).toHaveClass("grid", "grid-cols-1");
    expect(spread.className).not.toMatch(/grid-cols-[23]/);
    expect(screen.queryByTestId("column-name")).toBeNull();
    const order = Array.from(spread.querySelectorAll("[data-testid^=cell-]")).map((e) => e.getAttribute("data-testid"));
    expect(order).toEqual(["cell-a", "cell-b", "cell-c", "cell-a", "cell-b", "cell-c"]);
    expect(screen.getAllByTestId("sigla").map((e) => e.textContent)).toEqual(["CEI2008", "VGCL", "CEI2008", "VGCL"]);
    expect(within(screen.getAllByTestId("cell-a")[0]).queryByTestId("sigla")).toBeNull();
  });

  it("aThirdEditionLackingAVerseGetsItsOwnGapNote", () => {
    const rows = buildRows([row(5, 1), row(5, 2)], [[row(5, 1), row(5, 2)], [row(5, 1)]], 47);
    render(wrap(<Spread sides={[A, B, C]} rows={rows} chapter={5} />));
    expect(within(screen.getAllByTestId("cell-c")[1]).getByText(/Not in Vulgata Clementina/)).toBeInTheDocument();
    expect(screen.getAllByText(/Not in/)).toHaveLength(1);
  });

  it("aCappedThirdEditionLeavesTheRestWithoutNotes", () => {
    const four = Array.from({ length: 4 }, (_, i) => row(5, i + 1));
    const rows = buildRows(four, [four, four.slice(0, 2)], 47);
    render(wrap(<Spread sides={[A, B, C]} rows={rows} chapter={5} truncated={[false, false, true]} />));
    expect(screen.queryByText(/Not in/)).toBeNull();
  });

  it("aCappedMainEditionLeavesTheRestOfTheSecondWithoutNotes", () => {
    const a = Array.from({ length: 2 }, (_, i) => row(5, i + 1));
    const b = Array.from({ length: 4 }, (_, i) => row(5, i + 1));
    render(wrap(<Spread sides={[A, B]} rows={buildRows(a, [b], 47)} chapter={5} truncated={[true, false]} />));
    expect(screen.queryByText(/Not in/)).toBeNull();
    expect(screen.getByText("Text 5:4.")).toBeInTheDocument();
  });

  it("aCappedSecondEditionLeavesTheRestOfTheMainWithoutNotes", () => {
    const a = Array.from({ length: 4 }, (_, i) => row(5, i + 1));
    const b = Array.from({ length: 2 }, (_, i) => row(5, i + 1));
    render(wrap(<Spread sides={[A, B]} rows={buildRows(a, [b], 47)} chapter={5} truncated={[false, true]} />));
    expect(screen.queryByText(/Not in/)).toBeNull();
    expect(screen.getByText("Text 5:4.")).toBeInTheDocument();
  });

  it("verseLinesPutOneVersePerLineWithItsNumber", () => {
    render(wrap(<VerseLines rows={[row(3, 1), row(3, 2)]} chapter={3} />));
    const lines = screen.getAllByTestId("verse-line");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toHaveTextContent("2Text 3:2.");
  });

  it("versesRenderTheirFormattingInBothColumns", () => {
    const poetic = (chapter: number, verse: number): VerseRow => ({
      ...row(chapter, verse), text: " <pof>The L<sm>ORD</sm> is my light,</pof>\n<pol>whom shall I fear?</pol>",
    });
    render(wrap(<VerseLines rows={[poetic(27, 1)]} chapter={27} />));
    const line = screen.getByTestId("verse-line");
    expect(line.textContent).not.toMatch(/<\/?(pof|pol|sm)>/);
    expect(line.querySelector(".bg-pof .bg-sm")?.textContent).toBe("ORD");
    expect(line.querySelector(".bg-pol")).not.toBeNull();

    const rows = buildRows([poetic(27, 1)], [[poetic(27, 1)]], PSALMS);
    const { container } = render(wrap(<Spread sides={[A, B]} rows={rows} chapter={27} />));
    for (const id of ["cell-a", "cell-b"]) {
      const cell = within(container).getByTestId(id);
      expect(cell.textContent).not.toContain("<pof>");
      expect(cell.querySelector(".bg-pof")).not.toBeNull();
    }
  });

  it("verseLinePlacesAMidVerseHeadingInsideTheVerse", () => {
    const r: VerseRow = { ...row(5, 1), titles: ["Mid"], titlePosition: 7, text: "First. Second." };
    render(wrap(<VerseLines rows={[r]} chapter={5} />));
    expect(screen.getByTestId("verse-line")).toHaveTextContent("1First. MidSecond.");
  });

  it("aMidVerseHeadingInAComparedColumnFeedsThatColumnsRunningHead", () => {
    const b: VerseRow = { ...row(5, 1), titles: ["Mid"], titlePosition: 7, text: "First. Second." };
    render(wrap(<Spread sides={[A, B]} rows={buildRows([row(5, 1)], [[b]], 47)} chapter={5} />));
    expect(screen.getByRole("heading", { level: 2, name: "Mid" })).toHaveAttribute("data-head-col", "1");
  });

  it("headingsGetTheirOwnRowSoTheVersesStayLevel", () => {
    // CEI2008 Gn 1 opens with two headings; the Nova Vulgata has none (synthetic text).
    const a = [row(1, 1), row(1, 2)];
    const b = [{ ...row(1, 1), titles: ["Creazione", "La creazione"] }, row(1, 2)];
    render(wrap(<Spread sides={[A, B]} rows={buildRows(a, [b], 1)} chapter={1} />));
    const order = Array.from(screen.getByTestId("spread").querySelectorAll("[data-testid^=cell-],[data-testid^=heading-]"))
      .map((e) => e.getAttribute("data-testid"));
    // The headings row comes first, then verse 1 of both editions side by side.
    expect(order).toEqual(["heading-a", "heading-b", "cell-a", "cell-b", "cell-a", "cell-b"]);
    const [ha, hb] = [screen.getByTestId("heading-a"), screen.getByTestId("heading-b")];
    expect(ha.querySelectorAll("h2")).toHaveLength(0);
    expect(within(hb).getAllByRole("heading").map((h) => h.textContent)).toEqual(["Creazione", "La creazione"]);
    for (const c of screen.getAllByTestId("cell-b")) expect(c.querySelector("h2")).toBeNull();
  });

  it("rowsWithoutHeadingsGetNoHeadingRow", () => {
    render(wrap(<Spread sides={[A, B]} rows={buildRows([row(5, 1)], [[row(5, 1)]], 47)} chapter={5} />));
    expect(screen.queryByTestId("heading-a")).toBeNull();
  });

  it("interlinearPutsEachEditionsHeadingsWithItsOwnVerseTagged", () => {
    // Only the compared edition has a heading at 1:1 (synthetic text).
    const rows = buildRows([row(1, 1)], [[{ ...row(1, 1), titles: ["Titolo"] }]], 1);
    render(wrap(<Spread sides={[A, B]} rows={rows} chapter={1} view="interlinear" />));
    expect(screen.queryByTestId("heading-a")).toBeNull();
    const cellB = screen.getByTestId("cell-b");
    const kids = Array.from(cellB.querySelectorAll("[data-testid=sigla], h2, [data-testid=verse-line]")).map((e) => e.tagName === "H2" ? "h2" : e.getAttribute("data-testid"));
    expect(kids).toEqual(["sigla", "h2", "verse-line"]);
    expect(within(screen.getByTestId("cell-a")).queryByRole("heading")).toBeNull();
  });

  describe("Esther's two texts", () => {
    const LXX = { sigla: "NABRE", name: "NABRE", rubric: { full: "Septuagint", short: "LXX" } };
    const MT = { sigla: "NABRE-MT", name: "NABRE", rubric: { full: "Masoretic text", short: "MT" } };
    const lettered = (verse: number, segment: string | null): VerseRow => ({ ...row(1, verse), segment });

    it("rubricSidesAreHeadedInRedWithTheShortNameOnPhones", () => {
      render(wrap(<Spread sides={[LXX, MT]} rows={buildRows([row(1, 1)], [[row(1, 1)]], 19)} chapter={1} />));
      const [lxx, mt] = screen.getAllByTestId("column-name");
      expect(lxx).toHaveClass("text-red-700");
      // On phones the short name shows; screen readers always get the full one.
      expect(within(lxx).getByText("Septuagint")).toHaveClass("sr-only", "sm:not-sr-only");
      expect(within(lxx).getByText("LXX")).toHaveClass("sm:hidden");
      expect(within(lxx).getByText("LXX")).toHaveAttribute("aria-hidden", "true");
      expect(within(mt).getByText("Masoretic text")).toHaveClass("sr-only", "sm:not-sr-only");
      expect(within(mt).getByText("MT")).toHaveAttribute("aria-hidden", "true");
    });

    it("withoutGapNotesAnEmptyCellStaysEmpty", () => {
      const rows = buildRows([lettered(1, "a"), lettered(1, null)], [[lettered(1, null)]], 19);
      const { unmount } = render(wrap(<Spread sides={[LXX, MT]} rows={rows} chapter={1} gapNotes={false} />));
      expect(screen.queryByText(/Not in/)).toBeNull();
      expect(screen.getAllByTestId("cell-b")[0]).toBeEmptyDOMElement();
      unmount();
      render(wrap(<Spread sides={[LXX, MT]} rows={rows} chapter={1} />));
      expect(screen.getAllByText(/Not in/)).toHaveLength(1);
    });

    it("twoTextsOfOneEditionAreEqualNeitherGreyed", () => {
      render(wrap(<Spread sides={[LXX, MT]} rows={buildRows([row(1, 1)], [[row(1, 1)]], 19)} chapter={1} />));
      expect(screen.getByTestId("cell-b").className).not.toMatch(/text-slate-700/);
    });

    it("interlinearTagsARubricSideWithItsShortName", () => {
      render(wrap(<Spread sides={[LXX, MT]} rows={buildRows([row(1, 1)], [[row(1, 1)]], 19)} chapter={1} view="interlinear" />));
      // Both texts are tagged, each named in full for screen readers.
      const tags = screen.getAllByTestId("sigla");
      expect(tags.map((e) => e.textContent)).toEqual(["LXX", "MT"]);
      expect(tags.map((e) => e.getAttribute("title"))).toEqual(["Septuagint", "Masoretic text"]);
    });
  });
  it("theMainSidesVersesCanBeLinkedToAndNoOtherSideRepeatsTheirIds", () => {
    // Esther's two texts are a Spread of one edition: a search result links to the main side's verse.
    const rows = buildRows([row(5, 1), row(5, 2)], [[row(5, 1), row(5, 2)]], 47);
    const { container } = render(wrap(<Spread sides={[A, B]} rows={rows} chapter={5} />));
    expect(container.querySelectorAll("#v5\\.1")).toHaveLength(1);
    expect(screen.getAllByTestId("cell-a")[0].querySelector("#v5\\.1")).not.toBeNull();
  });
  it("aVerseOnlyTheSecondSidePrintsCarriesItsOwnId", () => {
    // Esther: a verse only the Hebrew text prints has no Greek cell; its Hebrew line is where a link lands.
    const rows = buildRows([row(5, 1)], [[row(5, 1), row(5, 2)]], 47);
    const { container } = render(wrap(<Spread sides={[A, B]} rows={rows} chapter={5} />));
    expect(container.querySelectorAll("#v5\\.1")).toHaveLength(1);
    expect(container.querySelectorAll("#v5\\.2")).toHaveLength(1);
    expect(screen.getAllByTestId("cell-b")[1].querySelector("#v5\\.2")).not.toBeNull();
  });
  it("theVerseNumberRunsInlineWithItsTextNoGutter", () => {
    render(wrap(<Spread sides={[A, B]} rows={buildRows([row(5, 1)], [[row(5, 1)]], 47)} chapter={5} />));
    const line = screen.getAllByTestId("verse-line")[0];
    expect(line).not.toHaveClass("flex");
    expect(line.querySelector("sup")).toHaveTextContent("1");
    expect(line.querySelector("sup")).toHaveClass("text-red-700");
  });

  it("withATitleTheEditionsAndEachColumnsHeadingsFeedTheStickyStrip", () => {
    const a = [{ ...row(4, 1), titles: ["Cain and Abel"] }];
    const b = [{ ...row(4, 1), titles: ["Desde Adán", "Caín y Abel"] }];
    const { container } = render(wrap(<Spread title="Genesis 4" sides={[A, B]} rows={buildRows(a, [b], 1)} chapter={4} />));
    const head = container.querySelector("[data-sticky-head]")!;
    expect(head).toContainElement(screen.getByRole("heading", { level: 1, name: "Genesis 4" }));
    expect(Array.from(head.querySelectorAll("[data-testid=column-name]")).map((e) => e.textContent)).toEqual([A.name, B.name]);
    expect(screen.getByRole("heading", { level: 2, name: "Cain and Abel" })).toHaveAttribute("data-head-col", "0");
    expect(screen.getByRole("heading", { level: 2, name: "Caín y Abel" })).toHaveAttribute("data-head-col", "1");
  });

  it("esthersTwoTextsExplainTheirDifference", () => {
    const rubric = (full: string) => ({ full, short: full.slice(0, 3) });
    const sides = [{ ...A, rubric: rubric("Septuagint") }, { ...A, sigla: "NABRE-MT", rubric: rubric("Masoretic text") }];
    render(wrap(<Spread sides={sides} rows={buildRows([row(1, 1)], [[row(1, 1)]], 19)} chapter={1} gapNotes={false} />));
    expect(screen.getAllByRole("link", { name: "Why do the Greek and Hebrew texts differ?" })).toHaveLength(2);
  });

  it("theInterlinearViewExplainsEstherOnceForEachText", () => {
    const rubric = (full: string) => ({ full, short: full.slice(0, 3) });
    const sides = [{ ...A, rubric: rubric("Septuagint") }, { ...A, sigla: "NABRE-MT", rubric: rubric("Masoretic text") }];
    const rows = buildRows([row(1, 1), row(1, 2)], [[row(1, 1), row(1, 2)]], 19);
    render(wrap(<Spread sides={sides} rows={rows} chapter={1} gapNotes={false} view="interlinear" />));
    expect(screen.getAllByRole("link", { name: "Why do the Greek and Hebrew texts differ?" })).toHaveLength(2);
  });

  it("theInterlinearViewExplainsAPsalmNumberedOtherwiseOnce", () => {
    const a = [row(10, 1, "10:1"), row(10, 2, "10:2")];
    const c = [row(9, 22, "10:1"), row(9, 23, "10:2")];
    render(wrap(<Spread sides={[A, C]} rows={buildRows(a, [c], PSALMS)} chapter={10} psalms view="interlinear" />));
    expect(screen.getAllByRole("link", { name: "Why are the Psalms numbered two ways?" })).toHaveLength(1);
  });

  it("editionsWithoutARubricHaveNoMark", () => {
    render(wrap(<Spread sides={[A, B]} rows={buildRows([row(5, 1)], [[row(5, 1)]], 47)} chapter={5} />));
    expect(screen.queryByRole("link", { name: /Why/ })).toBeNull();
  });

  it("aComparedPsalmNumberedOtherwiseIsExplained", () => {
    // NABRE Psalm 10 beside VGCL, whose verses are 9:22-39 (synthetic text).
    const a = [row(10, 1, "10:1"), row(10, 2, "10:2")];
    const c = [row(9, 22, "10:1"), row(9, 23, "10:2")];
    render(wrap(<Spread sides={[A, C]} rows={buildRows(a, [c], PSALMS)} chapter={10} psalms />));
    expect(screen.getAllByRole("link", { name: "Why are the Psalms numbered two ways?" })).toHaveLength(1);
  });

  it("aComparedPsalmNumberedAlikeHasNoMark", () => {
    const a = [row(2, 1, "2:1")];
    render(wrap(<Spread sides={[A, B]} rows={buildRows(a, [[row(2, 1, "2:1")]], PSALMS)} chapter={2} psalms />));
    expect(screen.queryByRole("link", { name: /Why/ })).toBeNull();
  });
});
