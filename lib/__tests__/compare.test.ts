import { describe, it, expect } from "vitest";
import { compareQuery, MAX_COMPARED, parseView, parseWith } from "../compare";

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
    expect(compareQuery({ with: [], view: "interlinear", tradition: "HEBREW" })).toBe("?tradition=HEBREW");
  });
});
