import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { LOCALES } from "@/i18n/routing";
import { DOC_PAGES, INDEX_LANGS } from "@/lib/docs";

const root = join(process.cwd(), "content", "docs");
const files = (lang: string) =>
  existsSync(join(root, lang)) ? readdirSync(join(root, lang)).filter((f) => f.endsWith(".mdx")).map((f) => f.slice(0, -4)).sort() : [];

describe("the docs content", () => {
  it("englishHasTheIndexAndEveryPage", () => {
    expect(files("en")).toEqual(["index", ...DOC_PAGES.map((p) => p.slug)].sort());
  });

  it.each(LOCALES.filter((l) => l !== "en"))("%sHasExactlyThePagesItClaims", (lang) => {
    const claimed = [...(INDEX_LANGS.includes(lang) ? ["index"] : []), ...DOC_PAGES.filter((p) => (p.langs as readonly string[]).includes(lang)).map((p) => p.slug)];
    expect(files(lang)).toEqual(claimed.sort());
  });
});
