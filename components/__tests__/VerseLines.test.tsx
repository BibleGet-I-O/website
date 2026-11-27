import { describe, it, expect } from "vitest";
import { render } from "@/test/intl";
import { VerseLine } from "@/components/VerseLines";
import type { VerseRow } from "@/lib/types";

const poetic: VerseRow = {
  chapter: 10, verse: 10, label: null, printedChapter: null, titles: [],
  text: "<po>The helpless are crushed, laid low;</po> <poi>they fall into the power of the wicked,</poi>",
};

describe("VerseLine", () => {
  // Compared editions have no gutter: a hanging number ("10:10") would spill into the column on its left.
  it("keepsAPoeticVerseNumberInsideItsFirstLine", () => {
    const { container } = render(<VerseLine row={poetic} chapter={9} />);
    const first = container.querySelector(".bg-line");
    const num = first?.firstElementChild;
    expect(num?.tagName).toBe("SUP");
    expect(num?.textContent).toBe("10:10");
    expect(num).not.toHaveClass("bg-vnum-hang");
    expect(first?.textContent).toBe("10:10The helpless are crushed, laid low;");
  });
});

describe("VerseLine marks", () => {
  it("marksTheRowsMentions", () => {
    const row: VerseRow = { chapter: 3, verse: 4, label: null, printedChapter: null, titles: [], text: "Et dixit Petrus.", mentions: [{ start: 9, end: 15, entry: "petrus" }] };
    const { container } = render(<VerseLine row={row} chapter={3} />);
    expect(container.querySelector(".bg-mention")).toHaveAttribute("data-mention", "3.4|0");
  });
});
