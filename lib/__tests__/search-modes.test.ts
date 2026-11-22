import { describe, expect, it } from "vitest";
import { parseMode, SEARCH_MODES } from "../search-modes";

describe("search modes", () => {
  it("listsKeywordSemanticAndReference", () => {
    expect(SEARCH_MODES).toEqual(["keyword", "semantic", "reference"]);
  });

  it("parsesTheModes", () => {
    expect(parseMode("reference")).toBe("reference");
    expect(parseMode("semantic")).toBe("semantic");
    // An old link to the hybrid tab: the same search, now called semantic.
    expect(parseMode("hybrid")).toBe("semantic");
    expect(parseMode("nope")).toBe("keyword");
    expect(parseMode(undefined)).toBe("keyword");
  });
});
