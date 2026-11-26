import { describe, it, expect, vi, afterEach } from "vitest";
import { canonicalOrigin, docsSitemapXml, editionSitemapXml, sitemapIndexXml } from "@/lib/sitemap";

describe("sitemap", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("noOriginOnStagingOrWhenUnset", () => {
    vi.stubEnv("SITE_CANONICAL_ORIGIN", "https://www.bibleget.io/");
    vi.stubEnv("SITE_NOINDEX", "1");
    expect(canonicalOrigin()).toBeNull();
    vi.stubEnv("SITE_NOINDEX", "");
    expect(canonicalOrigin()).toBe("https://www.bibleget.io");
    vi.stubEnv("SITE_CANONICAL_ORIGIN", "");
    expect(canonicalOrigin()).toBeNull();
    vi.stubEnv("SITE_CANONICAL_ORIGIN", "www.bibleget.io");
    expect(canonicalOrigin()).toBeNull();
  });

  it("editionSitemapListsTheIndexAndEveryChapterPerLocale", () => {
    const xml = editionSitemapXml("https://www.bibleget.io", "nvbse", [{ slug: "genesis", chapters: 2 }]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.match(/<loc>/g)).toHaveLength(18);
    expect(xml).toContain("<loc>https://www.bibleget.io/en/read/nvbse</loc>");
    expect(xml).toContain("<loc>https://www.bibleget.io/it/read/nvbse/genesis/2</loc>");
  });

  it("listsThePrologueAsChapterZero", () => {
    const xml = editionSitemapXml("https://www.bibleget.io", "nabre", [{ slug: "sirach", chapters: 1, prologue: 1 }]);
    expect(xml).toContain("<loc>https://www.bibleget.io/en/read/nabre/sirach/0</loc>");
    expect(xml.match(/<loc>/g)).toHaveLength(18);
  });

  it("escapesWhatXmlReserves", () => {
    expect(editionSitemapXml("https://x.org", "a&b", [])).toContain("<loc>https://x.org/en/read/a&amp;b</loc>");
  });

  it("indexListsOneSitemapPerEdition", () => {
    const xml = sitemapIndexXml("https://www.bibleget.io", ["nvbse", "drb"]);
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<loc>https://www.bibleget.io/sitemaps/nvbse.xml</loc>");
    expect(xml).toContain("<loc>https://www.bibleget.io/sitemaps/drb.xml</loc>");
  });

  it("theIndexNamesTheDocsSitemap", () => {
    expect(sitemapIndexXml("https://www.bibleget.io", ["nvbse"])).toContain("<loc>https://www.bibleget.io/sitemaps/docs.xml</loc>");
  });

  it("theDocsSitemapHasEveryPageInEveryLanguage", () => {
    const xml = docsSitemapXml("https://www.bibleget.io");
    expect(xml.match(/<loc>/g)).toHaveLength(108);
    expect(xml).toContain("<loc>https://www.bibleget.io/it/docs</loc>");
    expect(xml).toContain("<loc>https://www.bibleget.io/pt/docs/codex-vaticanus</loc>");
  });
});
