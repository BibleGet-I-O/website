import { describe, it, expect } from "vitest";
import { speakerOf } from "@/lib/speakers";

describe("speakers", () => {
  it("readsNabreTagsAndTheirQuestionMark", () => {
    expect(speakerOf("W")).toEqual({ who: "woman", uncertain: false });
    expect(speakerOf("M?")).toEqual({ who: "man", uncertain: true });
    expect(speakerOf("D?")).toEqual({ who: "daughters", uncertain: true });
  });

  it("readsTheVulgatesLatinTags", () => {
    expect(speakerOf("Sponsa")).toEqual({ who: "bride", uncertain: false });
    expect(speakerOf("Sponsus")).toEqual({ who: "bridegroom", uncertain: false });
    expect(speakerOf("Chorus")).toEqual({ who: "chorus", uncertain: false });
    expect(speakerOf("Chorus Fratrum")).toEqual({ who: "brothers", uncertain: false });
    expect(speakerOf("Chorus Adolescentularum")).toEqual({ who: "maidens", uncertain: false });
  });

  it("knowsNothingElse", () => {
    expect(speakerOf("X")).toBeNull();
    expect(speakerOf("?")).toBeNull();
    expect(speakerOf("")).toBeNull();
  });
});
