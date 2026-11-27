import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { renderFormatted, renderTitle, renderVerse } from "@/lib/formatted";
import type { Mention, Note, NoteMarker } from "@/lib/types";

// Synthetic or public-domain (KJV, Douay-Rheims) text only.
const html = (node: React.ReactNode) => render(<div>{node}</div>).container.firstElementChild as HTMLElement;

describe("renderFormatted", () => {
  it("turnsLineTagsIntoLineSpans", () => {
    const root = html(renderFormatted("<pof>First line;</pof> <po>middle line,</po> <pol>last line.</pol>"));
    const lines = Array.from(root.querySelectorAll(".bg-line"));
    expect(lines.map((l) => l.className)).toEqual(["bg-line bg-pof", "bg-line bg-po", "bg-line bg-pol"]);
    expect(lines.map((l) => l.textContent)).toEqual(["First line;", "middle line,", "last line."]);
    expect(root.textContent).not.toContain("<");
  });

  it("keepsEveryLineTagAndInlineTag", () => {
    for (const t of ["po", "pof", "pol", "poi", "poil", "poif", "pos", "po3", "po3l", "pr", "bq", "bqf", "bql"]) {
      const root = html(renderFormatted(`<${t}>x</${t}>`));
      expect(root.querySelector(`span.bg-line.bg-${t}`)?.textContent).toBe("x");
    }
    const root = html(renderFormatted("a <i>b</i> c<sup>d</sup> <sm>e</sm> <speaker>f</speaker>"));
    expect(root.querySelector("i")?.textContent).toBe("b");
    expect(root.querySelector("sup")?.textContent).toBe("d");
    expect(root.querySelector("span.bg-sm")?.textContent).toBe("e");
    expect(root.querySelector("span.bg-speaker")?.textContent).toBe("f");
    expect(root.querySelector(".bg-line")).toBeNull();
  });

  it("nestsInlineTagsInsideLineTags", () => {
    const root = html(renderFormatted("<po>The L<sm>ORD</sm> is my shepherd</po>"));
    const sm = root.querySelector("span.bg-po > span.bg-sm");
    expect(sm?.textContent).toBe("ORD");
    expect(root.textContent).toBe("The LORD is my shepherd");
  });

  it("leavesUnknownUnmatchedAndAttributedTagsAsLiteralText", () => {
    expect(html(renderFormatted("<foo>x</foo>")).textContent).toBe("<foo>x</foo>");
    expect(html(renderFormatted("<po>x")).textContent).toBe("<po>x");
    expect(html(renderFormatted("x</po>")).textContent).toBe("x</po>");
    expect(html(renderFormatted("a < b and c > d")).textContent).toBe("a < b and c > d");
    const attr = html(renderFormatted('<po class="x">a</po>'));
    expect(attr.textContent).toBe('<po class="x">a</po>');
    expect(attr.querySelector("span")).toBeNull();
    const mismatched = html(renderFormatted("<po>a</sm>b</po>"));
    expect(mismatched.querySelector("span")).toBeNull();
    expect(mismatched.textContent).toBe("<po>a</sm>b</po>");
  });

  it("neverRunsScript", () => {
    const root = html(renderFormatted("<script>alert(1)</script><po><img src=x onerror=alert(1)></po>"));
    expect(root.querySelector("script")).toBeNull();
    expect(root.querySelector("img")).toBeNull();
    expect(root.textContent).toBe("<script>alert(1)</script><img src=x onerror=alert(1)>");
  });

  it("addsNothingForALineBreakBetweenTaggedLines", () => {
    const root = html(renderFormatted("<pof>one</pof>\n<pol>two</pol>"));
    expect(Array.from(root.childNodes).map((n) => (n as Element).className)).toEqual(["bg-line bg-pof", "bg-line bg-pol"]);
    expect(root.querySelector("br")).toBeNull();
  });

  it("makesAnUntaggedLineBeforeTaggedLinesItsOwnLine", () => {
    const root = html(renderFormatted("A psalm of David.\n<pof>The L<sm>ORD</sm> is my shepherd;</pof>\n<poi>I shall not want.</poi>"));
    const lines = Array.from(root.querySelectorAll(".bg-line"));
    expect(lines.map((l) => l.textContent)).toEqual(["A psalm of David.", "The LORD is my shepherd;", "I shall not want."]);
    expect(lines[0]).toHaveClass("bg-plain");
  });

  it("keepsSpacesBetweenInlineTagsOnATaggedLine", () => {
    const root = html(renderFormatted("<i>a</i> <sm>b</sm> <pof>c</pof>"));
    expect(root.textContent).toBe("a bc");
    expect(root.querySelector(".bg-pof")?.textContent).toBe("c");
  });

  it("marksALineThatOpensWithASpeaker", () => {
    const root = render(<NextIntlClientProvider locale="en" messages={en}><div>{renderFormatted("<pof><speaker>W</speaker> Let him kiss me</pof>")}</div></NextIntlClientProvider>).container;
    expect(root.querySelector(".bg-pof")).toHaveClass("bg-has-speaker");
    expect(screen.getByRole("button", { name: "W: the woman" })).toHaveTextContent("W");
  });
});

describe("renderVerse", () => {
  it("putsThePoeticVerseNumberInsideItsFirstLine", () => {
    const root = html(renderVerse({ label: "2", text: "<pof>Why have the Gentiles raged,</pof> <pol>and the people devised vain things?</pol>" }));
    const first = root.querySelector(".bg-line");
    const num = first?.firstElementChild;
    expect(num?.tagName).toBe("SUP");
    expect(num).toHaveClass("bg-vnum-hang");
    expect(num?.textContent).toBe("2");
    expect(root.firstElementChild).toBe(first);
  });

  it("putsTheWhyMarkAfterTheNumber", () => {
    const root = html(renderVerse({ label: "12:1", text: "For your spirit is in all things.", why: <i data-testid="why">?</i> }));
    expect(root.querySelector("sup")?.textContent).toBe("12:1?");
    expect(root.textContent).toBe("12:1?For your spirit is in all things.");
  });

  it("keepsAProseVerseNumberInlineBeforeTheText", () => {
    const root = html(renderVerse({ label: "1", text: "In the beginning God created heaven, and earth." }));
    const sup = root.querySelector("sup");
    expect(sup?.textContent).toBe("1");
    expect(sup).not.toHaveClass("bg-vnum-hang");
    expect(root.textContent).toBe("1In the beginning God created heaven, and earth.");
  });

  it("trimsLeadingWhitespace", () => {
    expect(html(renderVerse({ label: "4", text: "  And God saw." })).textContent).toBe("4And God saw.");
    const poetic = html(renderVerse({ label: "5", text: " <po>x</po>" }));
    expect(poetic.firstChild).toBe(poetic.querySelector(".bg-po"));
  });

  it("printsNothingForAnEmptyLabel", () => {
    const root = html(renderVerse({ label: "", text: "<po>rest</po>" }));
    expect(root.querySelector("sup")).toBeNull();
  });

  it("placesMidVerseHeadingsAtTitlePosition", () => {
    const text = "And the evening and morning were the first day. And God said: Let there be a firmament.";
    const pos = "And the evening and morning were the first day. ".length;
    const root = html(renderVerse({ label: "5", text, titles: ["Second Day", "Waters"], titlePosition: pos }));
    const headings = Array.from(root.querySelectorAll("[role=heading]"));
    expect(headings.map((h) => h.textContent)).toEqual(["Second Day", "Waters"]);
    expect(root.textContent).toBe(`5And the evening and morning were the first day. Second DayWatersAnd God said: Let there be a firmament.`);
  });

  it("placesMidVerseHeadingsBetweenPoeticLines", () => {
    const text = "<pol>end of a stanza.</pol>\n<pof>Start of the next</pof>";
    const root = html(renderVerse({ label: "8", text, titles: ["Aleph"], titlePosition: "<pol>end of a stanza.</pol>".length }));
    const kids = Array.from(root.children).map((e) => e.textContent);
    expect(kids).toEqual(["8end of a stanza.", "Aleph", "Start of the next"]);
  });

  it("placesAHeadingAfterASuperscriptionLine", () => {
    // VGCL Ps 118:1 (public domain): the offset falls after the line break, as in every poetic mid-verse row.
    const text = "Alleluja.\n<pof>Beati immaculati in via,</pof>\n<po>qui ambulant in lege Domini.</po>";
    const root = html(renderVerse({ label: "1", text, titles: ["Aleph"], titlePosition: 10 }));
    const kids = Array.from(root.children);
    expect(kids.map((e) => e.textContent)).toEqual(["1Alleluja.", "Aleph", "Beati immaculati in via,", "qui ambulant in lege Domini."]);
    expect(kids[0]).toHaveClass("bg-plain");
    expect(kids[0].firstElementChild).not.toHaveClass("bg-vnum-hang");
    expect(kids[1]).toHaveAttribute("role", "heading");
    expect(kids[2]).toHaveClass("bg-pof");
    expect(kids[3]).toHaveClass("bg-po");
  });

  it("givesTheHangingNumberNoExtraMargin", () => {
    const root = html(renderVerse({ label: "12:1", text: "<pof>x</pof>" }));
    const num = root.querySelector(".bg-vnum-hang");
    expect(num?.textContent).toBe("12:1");
    expect(num?.className).not.toMatch(/\bmr-/);
  });

  it("countsTitlePositionInCodePoints", () => {
    const text = "𝔄 first. second.";
    const root = html(renderVerse({ label: null, text, titles: ["H"], titlePosition: Array.from("𝔄 first. ").length }));
    expect(root.textContent).toBe("𝔄 first. Hsecond.");
  });

  it("ignoresTitlesWithoutTitlePosition", () => {
    const root = html(renderVerse({ label: "1", text: "x", titles: ["Before"], titlePosition: null }));
    expect(root.querySelector("[role=heading]")).toBeNull();
  });
});

describe("notes in a verse", () => {
  const note = (id: string, kind: "footnote" | "crossref", marker: string | null): Note => ({
    id: `DRB:${id}`, edition: "DRB", kind, marker, label: "1:1", title: null, body: "A note.", refs: [],
  });
  const at = { chapter: 1, verse: 1 };
  const verse = (text: string, notes: NoteMarker[], label = "1") =>
    render(<NextIntlClientProvider locale="en" messages={en}><div>{renderVerse({ label, text, notes, at })}</div></NextIntlClientProvider>)
      .container.firstElementChild as HTMLElement;
  /** The text as read: a cross-reference's popover (closed) is left out. */
  const read = (root: HTMLElement) => {
    const copy = root.cloneNode(true) as HTMLElement;
    copy.querySelectorAll("[popover]").forEach((p) => p.remove());
    return copy.textContent;
  };

  it("putsEachMarkerWhereItIsPrinted", () => {
    const text = "In the beginning God created heaven, and earth.";
    const root = verse(text, [
      { note: note("1", "footnote", "*"), field: "text", position: 16 },
      { note: note("2", "crossref", "a"), field: "text", position: text.length },
    ]);
    expect(read(root)).toBe("1In the beginning* God created heaven, and earth.a");
    expect(root.querySelector(".bg-note-foot")).toHaveTextContent("*");
    expect(root.querySelector(".bg-note-cross")).toHaveTextContent("a");
  });

  it("twoMarkersAtOnePlace", () => {
    const root = verse("Word.", [
      { note: note("2", "crossref", "b"), field: "text", position: 5 },
      { note: note("1", "footnote", "*"), field: "text", position: 5 },
    ]);
    expect(read(root)).toBe("1Word.b*");
  });

  it("markerAfterTheLineTag", () => {
    const root = verse("<pof>Who is this</pof>", [{ note: note("1", "footnote", "*"), field: "text", position: 0 }]);
    const line = root.querySelector(".bg-pof")!;
    expect(line.querySelector(".bg-note-foot")).not.toBeNull();
    expect(root.firstElementChild).toBe(line);
  });

  it("aMarkerAtTheStartOfARowThatOpensWithALineBreak", () => {
    // A psalm's chapter-heading note goes at position 0; many stored rows open with "\n" before the first line.
    const root = verse("\n<pof>Happy</pof>", [{ note: note("1", "footnote", "*"), field: "text", position: 0 }]);
    const line = root.querySelector(".bg-pof")!;
    expect(root.firstElementChild).toBe(line);
    expect(line.querySelector(".bg-note-foot")).not.toBeNull();
    expect(line.querySelector(".bg-vnum-hang")).not.toBeNull();
  });

  it("countsPositionsInCodePointsWithTags", () => {
    // "L<sm>ORD</sm>" is 13 code points; the marker goes after it, before the space.
    const root = verse("the L<sm>ORD</sm> 𝔊od", [{ note: note("1", "footnote", "*"), field: "text", position: 17 }]);
    expect(root.textContent).toBe("1the LORD* 𝔊od");
  });

  it("aWholeVerseNoteMarksTheVerseNumber", () => {
    const root = verse("Text.", [{ note: note("1", "footnote", null), field: "text", position: null }], "3");
    const num = root.querySelector("a.bg-note-num")!;
    expect(num).toHaveTextContent("3");
    expect(num).toHaveAttribute("href", "#note-DRB-1");
    expect(root.textContent).toBe("3Text.");
  });

  it("aSecondWholeVerseNoteGetsAChipOfItsOwn", () => {
    // CEI 2008 prints no markers: a verse with two notes marks the number for the first, a dot for the second.
    const root = verse("Text.", [
      { note: note("1", "footnote", null), field: "text", position: null },
      { note: note("2", "footnote", null), field: "text", position: null },
    ], "3");
    expect(root.querySelector("a.bg-note-num")).toHaveAttribute("href", "#note-DRB-1");
    const chip = root.querySelector("a.bg-note-foot")!;
    expect(chip).toHaveAttribute("href", "#note-DRB-2");
    expect(chip).toHaveTextContent("•");
    expect(chip).toHaveAttribute("aria-label", "Note on verse 3");
  });

  it("aMarkerInAHeading", () => {
    const root = verse("Text.", [{ note: note("1", "footnote", "*"), field: "title", titleIndex: 0, position: 3 }]);
    expect(root.querySelector(".bg-note-foot")).toBeNull();
    const h = render(<NextIntlClientProvider locale="en" messages={en}><h2>{renderTitle("The Fall", [{ note: note("1", "footnote", "*"), field: "title", titleIndex: 0, position: 3 }], 0, at)}</h2></NextIntlClientProvider>).container;
    expect(h.textContent).toBe("The* Fall");
  });
});

describe("marks in a verse", () => {
  // Invented Latin sentences only.
  const at = { chapter: 2, verse: 5 };
  const note: Note = { id: "NVBSE:1", edition: "NVBSE", kind: "footnote", marker: "*", label: "2:5", title: null, body: "Nota.", refs: [] };
  const verse = (text: string, mentions: Mention[] | undefined, notes: NoteMarker[] = [], extra: { titles?: string[]; titlePosition?: number } = {}) =>
    render(<NextIntlClientProvider locale="en" messages={en}><div>{renderVerse({ label: "5", text, notes, at, mentions, ...extra })}</div></NextIntlClientProvider>)
      .container.firstElementChild as HTMLElement;
  const pieces = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>(".bg-mention"));

  it("marksASettledName", () => {
    const root = verse("Et dixit Petrus ad eos.", [{ start: 9, end: 15, entry: "petrus" }]);
    const [p, ...rest] = pieces(root);
    expect(rest).toHaveLength(0);
    expect(p.tagName).toBe("SPAN");
    expect(p).toHaveTextContent(/^Petrus$/);
    expect(p).toHaveAttribute("data-mention", "2.5|0");
    expect(p).toHaveAttribute("data-mention-first", "");
    expect(p).not.toHaveAttribute("tabindex");
    expect(p).not.toHaveAttribute("role");
    expect(p).not.toHaveAttribute("aria-haspopup");
    expect(p).not.toHaveAttribute("data-review");
    expect(root.querySelector(".bg-mention-review")).toBeNull();
    expect(root.textContent).toBe("5Et dixit Petrus ad eos.");
  });

  it("marksAReviewNameWithAQuestionMark", () => {
    const root = verse("Venit Iacobus in urbem.", [{ start: 6, end: 13, candidates: ["iacobus-a", "iacobus-b"] }]);
    const [p] = pieces(root);
    expect(p).toHaveTextContent(/^Iacobus$/);
    expect(p).toHaveAttribute("data-review", "");
    const sup = root.querySelector("sup.bg-mention-review")!;
    expect(sup).toHaveTextContent("?");
    expect(sup).toHaveAttribute("aria-label", "under review");
    expect(p.nextSibling).toBe(sup);
    expect(root.textContent).toBe("5Venit Iacobus? in urbem.");
  });

  it("splitsAMarkAcrossALineAndANoteMarker", () => {
    // The mark runs from "Simon" (after "<po>", 4 code points) over the line break and a note after "Iona" (37) to "Barionas".
    const text = "<po>Simon Petrus</po>\n<po>filius Iona Barionas</po>";
    const start = 4;
    const end = Array.from(text).length - 5;
    const root = verse(text, [{ start, end, entry: "petrus" }], [{ note, field: "text", position: 37 }]);
    const ps = pieces(root);
    expect(ps.map((p) => p.textContent)).toEqual(["Simon Petrus", "filius Iona", " Barionas"]);
    expect(ps.every((p) => p.closest(".bg-line") !== null && p.querySelector(".bg-line, .bg-note-foot") === null)).toBe(true);
    expect(ps[0]).toHaveAttribute("data-mention-first", "");
    expect(ps.slice(1).every((p) => !p.hasAttribute("data-mention-first"))).toBe(true);
    expect(root.querySelectorAll(".bg-line")).toHaveLength(2);
    expect(root.querySelector(".bg-note-foot")?.closest(".bg-mention")).toBeNull();
  });

  it("nestsALabelAroundAName", () => {
    // "Ioannes Baptista" (a label) holds "Ioannes" (a name): the inner span lies within the outer piece.
    const root = verse("Venit Ioannes Baptista.", [
      { start: 6, end: 22, entry: "ioannes-baptista" },
      { start: 6, end: 13, entry: "ioannes" },
    ]);
    const outer = root.querySelector('[data-mention="2.5|0"]')!;
    const inner = outer.querySelector('[data-mention="2.5|1"]')!;
    expect(outer).toHaveTextContent(/^Ioannes Baptista$/);
    expect(inner).toHaveTextContent(/^Ioannes$/);
    expect(outer).toHaveAttribute("data-mention-first", "");
    expect(inner).toHaveAttribute("data-mention-first", "");
    expect(pieces(root)).toHaveLength(2);
  });

  it("nestsALabelAroundANameListedInnerFirst", () => {
    const outerFirst = verse("Venit Ioannes Baptista.", [
      { start: 6, end: 22, entry: "ioannes-baptista" },
      { start: 6, end: 13, entry: "ioannes" },
    ]);
    const root = verse("Venit Ioannes Baptista.", [
      { start: 6, end: 13, entry: "ioannes" },
      { start: 6, end: 22, entry: "ioannes-baptista" },
    ]);
    // The same marks, the ids following the array: the label is mention 1 here.
    const outer = root.querySelector('[data-mention="2.5|1"]')!;
    const inner = outer.querySelector('[data-mention="2.5|0"]')!;
    expect(pieces(root)).toHaveLength(2);
    expect(outer).toHaveTextContent(/^Ioannes Baptista$/);
    expect(outer).toHaveAttribute("data-mention-first", "");
    expect(inner).toHaveTextContent(/^Ioannes$/);
    expect(inner).toHaveAttribute("data-mention-first", "");
    const swap = (h: string) => h.replace(/2\.5\|0/g, "X").replace(/2\.5\|1/g, "2.5|0").replace(/X/g, "2.5|1");
    expect(swap(root.innerHTML)).toBe(outerFirst.innerHTML);
  });

  it("reviewMarkOfAnInnerMentionWithEqualEnds", () => {
    // "Ioannes Baptista" (settled) holds "Baptista" (under review), listed first; both end at 22.
    const root = verse("Venit Ioannes Baptista.", [
      { start: 14, end: 22, candidates: ["a", "b"] },
      { start: 6, end: 22, entry: "ioannes-baptista" },
    ]);
    const outer = root.querySelector('[data-mention="2.5|1"]')!;
    const inner = outer.querySelector('[data-mention="2.5|0"]')!;
    expect(pieces(root)).toHaveLength(2);
    expect(inner).toHaveTextContent(/^Baptista$/);
    const sup = root.querySelector("sup.bg-mention-review")!;
    expect(inner.nextSibling).toBe(sup);
    expect(sup.parentElement).toBe(outer);
    expect(outer).toHaveTextContent(/^Ioannes Baptista\?$/);
    expect(root.textContent).toBe("5Venit Ioannes Baptista?.");
  });

  it("marksASpanThatOpensAnInlineTagItDoesNotClose", () => {
    // The span opens before "<i>" and ends inside it: "<i>Petrus" (9 code points from 0).
    const root = verse("<i>Petrus dixit</i> ad eos.", [{ start: 0, end: 9, entry: "petrus" }]);
    const ps = pieces(root);
    expect(ps.map((p) => p.textContent)).toEqual(["Petrus"]);
    expect(ps[0].closest("i")).not.toBeNull();
    expect(root.querySelector("i")).toHaveTextContent(/^Petrus dixit$/);
    expect(root.textContent).toBe("5Petrus dixit ad eos.");
  });

  it("marksASpanThatClosesOutsideTheInlineTagItOpens", () => {
    // Opens inside "<i>" and ends after "</i>": two pieces, one inside the italics, one after.
    const root = verse("Dixit <i>Simon</i> Petrus.", [{ start: 9, end: 25, entry: "petrus" }]);
    const ps = pieces(root);
    expect(ps.map((p) => p.textContent)).toEqual(["Simon", " Petrus"]);
    expect(ps[0].closest("i")).not.toBeNull();
    expect(ps[1].closest("i")).toBeNull();
    expect(root.querySelector("i")).toHaveTextContent(/^Simon$/);
  });

  it("aMarkAcrossANoteMarkerLeavesTheMarkerOutside", () => {
    const root = verse("Et Simon Petrus ait.", [{ start: 3, end: 15, entry: "petrus" }], [{ note, field: "text", position: 8 }]);
    const ps = pieces(root);
    expect(ps.map((p) => p.textContent)).toEqual(["Simon", " Petrus"]);
    expect(root.querySelector(".bg-note-foot")?.closest(".bg-mention")).toBeNull();
    expect(root.textContent).toBe("5Et Simon* Petrus ait.");
  });

  it("putsTheReviewMarkAfterTheLastPieceOnly", () => {
    const root = verse("Et Simon Petrus ait.", [{ start: 3, end: 15, candidates: ["a", "b"] }], [{ note, field: "text", position: 8 }]);
    const ps = pieces(root);
    expect(ps).toHaveLength(2);
    expect(ps.every((p) => p.hasAttribute("data-review"))).toBe(true);
    const sups = root.querySelectorAll("sup.bg-mention-review");
    expect(sups).toHaveLength(1);
    expect(ps[1].nextSibling).toBe(sups[0]);
    expect(root.textContent).toBe("5Et Simon* Petrus? ait.");
  });

  it("namesAMarkByItsSegmentAndTradition", () => {
    const root = render(<div>{renderVerse({ label: "5", text: "Petrus ait.", at: { chapter: 2, verse: 5, segment: "a", tradition: "LXX" }, mentions: [{ start: 0, end: 6, entry: "petrus" }] })}</div>).container;
    expect(root.querySelector(".bg-mention")).toHaveAttribute("data-mention", "2.5a-lxx|0");
  });

  it("noMentionsRendersAsBefore", () => {
    const text = "\n<pof>Beatus vir, <i>qui</i> ambulat</pof>\n<pol>in lege <sm>Domini</sm>.</pol>";
    const notes: NoteMarker[] = [{ note, field: "text", position: 17 }];
    const extra = { titles: ["Titulus"], titlePosition: 42 };
    const before = verse(text, undefined, notes, extra).innerHTML;
    expect(verse(text, [], notes, extra).innerHTML).toBe(before);
    expect(before).toMatchInlineSnapshot(`"<span class="bg-line bg-pof"><sup class="font-sans text-xs text-red-700 dark:text-red-400 bg-vnum-hang">5</sup>Beatus vir,<a id="m-NVBSE-1-v2.5" href="#note-NVBSE-1" aria-label="Footnote *" class="bg-note bg-note-foot">*</a> <i>qui</i> ambulat</span><span role="heading" aria-level="2" class="mt-6 mb-2 block text-xl font-semibold">Titulus</span><span class="bg-line bg-pol">in lege <span class="bg-sm">Domini</span>.</span>"`);
  });
});
