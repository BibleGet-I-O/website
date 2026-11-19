import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { renderFormatted, renderVerse } from "@/lib/formatted";

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
    const root = html(renderFormatted("<pof><speaker>W</speaker> Let him kiss me</pof>"));
    expect(root.querySelector(".bg-pof")).toHaveClass("bg-has-speaker");
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
