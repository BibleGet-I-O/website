import { describe, it, expect } from "vitest";
import { compareQuery, comparisonFor, MAX_COMPARED, parseView, parseWith } from "../compare";

const known = ["NABRE", "CEI2008", "VGCL", "DRB"];

describe("compare address", () => {
  it("parsesUpToTwoComparedEditionsCaseInsensitively", () => {
    expect(parseWith("cei2008,VGCL", "NABRE", known)).toEqual(["CEI2008", "VGCL"]);
    expect(parseWith("CEI2008", "NABRE", known)).toEqual(["CEI2008"]);
    expect(MAX_COMPARED).toBe(2);
  });

  it("dropsTheMainRepeatedAndUnknownSiglasAndAnythingAfterTwo", () => {
    expect(parseWith("NABRE,CEI2008,CEI2008,XX,VGCL,DRB", "NABRE", known)).toEqual(["CEI2008", "VGCL"]);
    expect(parseWith("nabre,NABRE,xx", "NABRE", known)).toEqual([]);
    expect(parseWith(undefined, "NABRE", known)).toEqual([]);
    expect(parseWith(" cei2008 , ", "NABRE", known)).toEqual(["CEI2008"]);
  });

  it("theViewIsSideBySideUnlessInterlinear", () => {
    expect(parseView("interlinear")).toBe("interlinear");
    expect(parseView("columns")).toBe("side-by-side");
    expect(parseView(undefined)).toBe("side-by-side");
  });

  it("buildsTheQueryWithLiteralCommas", () => {
    expect(compareQuery({ with: ["CEI2008", "VGCL"], view: "interlinear", tradition: "HEBREW" })).toBe(
      "?with=CEI2008,VGCL&view=interlinear&tradition=HEBREW",
    );
    expect(compareQuery({ with: ["CEI2008"], view: "side-by-side", tradition: "GREEK" })).toBe("?with=CEI2008");
  });

  it("theViewNeedsAComparedEdition", () => {
    expect(compareQuery({ with: [], view: "interlinear" })).toBe("");
    // Esther's text is chosen only while comparing: read alone, both texts are shown.
    expect(compareQuery({ with: [], view: "interlinear", tradition: "HEBREW" })).toBe("");
  });

  it("twoTextsKeepTheViewInTheQuery", () => {
    expect(compareQuery({ with: [], view: "interlinear", twoTexts: true })).toBe("?view=interlinear");
    expect(compareQuery({ with: [], view: "side-by-side", tradition: "HEBREW", twoTexts: true })).toBe("");
    expect(compareQuery({ with: ["DRB"], view: "side-by-side", tradition: "HEBREW" })).toBe("?with=DRB&tradition=HEBREW");
  });
});

describe("comparisonFor", () => {
  it("theCitedEditionLeadsAndTheNotesOwnComesFirstAmongTheRest", () => {
    // Reading CEI2008 with VGCL and DRB, a CEI note cites the Nova Vulgata: CEI2008 is kept, the last compared dropped.
    expect(comparisonFor("NVBSE", "CEI2008", ["CEI2008", "VGCL", "DRB"])).toEqual(["CEI2008", "VGCL"]);
    // A compared edition's note: that edition comes first.
    expect(comparisonFor("NVBSE", "DRB", ["CEI2008", "VGCL", "DRB"])).toEqual(["DRB", "CEI2008"]);
    // Into an edition already on the page: it leads, the others stay.
    expect(comparisonFor("VGCL", "CEI2008", ["CEI2008", "VGCL"])).toEqual(["CEI2008"]);
    expect(comparisonFor("NABRE", "NABRE", ["NABRE", "VGCL"])).toEqual(["VGCL"]);
  });
});
