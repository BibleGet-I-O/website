import { describe, it, expect } from "vitest";
import { groupBySection, sectionOf } from "@/lib/sections";

describe("sections", () => {
  it("mapsBookNumbersToSections", () => {
    expect(sectionOf(1)).toEqual({ key: "pentateuch", testament: "ot" });
    expect(sectionOf(21)).toEqual({ key: "historical", testament: "ot" });
    expect(sectionOf(28)).toEqual({ key: "wisdom", testament: "ot" });
    expect(sectionOf(46)).toEqual({ key: "prophets", testament: "ot" });
    expect(sectionOf(51)).toEqual({ key: "acts", testament: "nt" });
    expect(sectionOf(64)).toEqual({ key: "paul", testament: "nt" });
    expect(sectionOf(65)).toEqual({ key: "catholic", testament: "nt" });
    expect(sectionOf(73)).toEqual({ key: "revelation", testament: "nt" });
    expect(() => sectionOf(74)).toThrow(RangeError);
    expect(() => sectionOf(0)).toThrow(RangeError);
  });

  it("dropsEmptySectionsForAProtestantCanon", () => {
    const books = [1, 22, 23, 24, 25, 26, 47].map((bookNum) => ({ bookNum }));
    expect(groupBySection(books).map((s) => [s.key, s.testament, s.books.length])).toEqual([
      ["pentateuch", "ot", 1],
      ["wisdom", "ot", 5],
      ["gospels", "nt", 1],
    ]);
  });
});
