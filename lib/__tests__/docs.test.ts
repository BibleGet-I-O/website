import { describe, it, expect } from "vitest";
import { DOC_PAGES, docContentLang, docHref, findPage, headingId, neighbours, slugFromPath, whyHref, WHY_TOPICS } from "@/lib/docs";

const SLUGS = [
  "how-the-bible-reached-us", "canon", "reformation", "why-editions-differ",
  "hebrew-text", "codex-aleppo", "codex-leningrad", "qumran", "septuagint", "new-testament-text", "codex-sinaiticus", "codex-vaticanus", "codex-alexandrinus", "vulgate",
  "textual-units", "persons-places-events", "data-and-api", "contributing",
];

describe("the docs registry", () => {
  it("pagesInOrder", () => {
    expect(DOC_PAGES.map((p) => p.slug)).toEqual(SLUGS);
    expect(DOC_PAGES.map((p) => p.part)).toEqual([...Array(4).fill("text"), ...Array(10).fill("manuscripts"), ...Array(4).fill("project")]);
  });

  it("slugsUnique", () => {
    expect(new Set(DOC_PAGES.map((p) => p.slug)).size).toBe(DOC_PAGES.length);
  });

  it("unknownSlugIsNotRegistered", () => {
    expect(findPage("editions")).toBeUndefined();
    expect(findPage("qumran")?.part).toBe("manuscripts");
  });

  it("neighboursAtBothEnds", () => {
    expect(neighbours(SLUGS[0]).prev).toBeUndefined();
    expect(neighbours(SLUGS.at(-1)!).next).toBeUndefined();
    const n = neighbours("why-editions-differ");
    expect([n.prev?.slug, n.next?.slug]).toEqual(["reformation", "hebrew-text"]);
    expect(neighbours("nope")).toEqual({});
  });

  it("contentLangFallsBackToEnglish", () => {
    expect(docContentLang(["en"], "it")).toBe("en");
    expect(docContentLang(["en", "it"], "it")).toBe("it");
  });

  it("hrefs", () => {
    expect(docHref()).toBe("/docs");
    expect(docHref("qumran")).toBe("/docs/qumran");
    expect(whyHref("esther")).toBe("/docs/why-editions-differ#esther");
    expect(WHY_TOPICS).toEqual(["esther", "missing-verses", "psalm-numbering", "printed-elsewhere"]);
  });

  it("slugFromPath", () => {
    expect(slugFromPath("/docs")).toEqual({ slug: undefined });
    expect(slugFromPath("/docs/qumran")).toEqual({ slug: "qumran" });
    expect(slugFromPath("/read/nabre")).toBeNull();
  });

  it("headingId", () => {
    expect(headingId("Cœlum’s Text")).toBe("coelums-text");
    expect(headingId("Il testo ebraico")).toBe("il-testo-ebraico");
  });
});

describe("the persons, places and events page", () => {
  it("describesTheMarksAsTheReaderDrawsThem", async () => {
    const { readFileSync } = await import("node:fs");
    const page = readFileSync("content/docs/en/persons-places-events.mdx", "utf8").replace(/\s+/g, " ");
    // app/globals.css: a dotted underline, tinted on hover; components/MentionCard: the Italian or English name beside the Latin.
    expect(page).toContain("A marked name has a dotted underline");
    expect(page).not.toContain("A marked name is tinted");
    expect(page).toContain("in Italian or English, where it differs");
    expect(page).not.toContain("in the reader's language");
  });
});
