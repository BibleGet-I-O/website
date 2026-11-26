import { describe, it, expect } from "vitest";
import { DOC_PAGES, docContentLang, docHref, findPage, headingId, neighbours, slugFromPath, whyHref, WHY_TOPICS } from "@/lib/docs";

const SLUGS = [
  "how-the-bible-reached-us", "why-editions-differ",
  "hebrew-text", "qumran", "septuagint", "new-testament-text", "codex-sinaiticus", "codex-vaticanus", "codex-alexandrinus", "vulgate",
];

describe("the docs registry", () => {
  it("pagesInOrder", () => {
    expect(DOC_PAGES.map((p) => p.slug)).toEqual(SLUGS);
    expect(DOC_PAGES.map((p) => p.part)).toEqual([...Array(2).fill("text"), ...Array(8).fill("manuscripts")]);
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
    expect([n.prev?.slug, n.next?.slug]).toEqual(["how-the-bible-reached-us", "hebrew-text"]);
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
