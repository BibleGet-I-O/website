import { describe, it, expect } from "vitest";
import { editionSlug } from "../slug";

describe("editionSlug", () => {
  it("isTheLowercaseSigla", () => {
    expect(editionSlug("CEI2008")).toBe("cei2008");
  });
});
