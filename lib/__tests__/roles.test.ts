import { describe, it, expect } from "vitest";
import { isAdmin, isReviewer } from "@/lib/roles";

describe("isAdmin", () => {
  it("accepts Zitadel's roles object holding bibleget_admin", () => {
    expect(isAdmin({ bibleget_admin: { "1": "bibleget.localhost" } })).toBe(true);
    expect(isAdmin({ bibleget_admin: {}, developer: {} })).toBe(true);
  });

  it("rejects other roles and missing or malformed claims", () => {
    for (const claim of [undefined, null, "bibleget_admin", ["bibleget_admin"], 42, {}, { admin: {} }]) {
      expect(isAdmin(claim)).toBe(false);
    }
  });
});

describe("isReviewer", () => {
  it("isReviewerReadsTheRolesClaim", () => {
    expect(isReviewer({ bibleget_reviewer: { "1": "x" } })).toBe(true);
    expect(isReviewer({ bibleget_admin: {} })).toBe(false);
    for (const claim of [undefined, null, "bibleget_reviewer", ["bibleget_reviewer"], {}]) expect(isReviewer(claim)).toBe(false);
  });
});
