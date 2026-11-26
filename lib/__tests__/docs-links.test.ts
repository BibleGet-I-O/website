import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LOCALES } from "@/i18n/routing";
import { DOC_PAGES, headingId, WHY_TOPICS } from "@/lib/docs";
import { editionSlug } from "@/lib/slug";
import editions from "./fixtures/editions.json";

const root = join(process.cwd(), "content", "docs");
const slugs = new Set<string>(DOC_PAGES.map((p) => p.slug));
const langs = LOCALES.filter((l) => existsSync(join(root, l)));

/** The anchors of a docs file: each markdown ## / ### heading's headingId, each <H2 id> / <H3 id>, and #sources if it has <Sources>. */
function anchors(lang: string, file: string): Set<string> {
  const path = join(root, lang, `${file}.mdx`);
  if (!existsSync(path)) return anchors("en", file);
  const text = readFileSync(path, "utf8");
  return new Set([
    ...[...text.matchAll(/^#{2,3}\s+(.+?)\s*$/gm)].map((m) => headingId(m[1].replace(/[*_`]/g, ""))),
    ...[...text.matchAll(/<H[23]\s+id="([^"]+)"/g)].map((m) => m[1]),
    ...(text.includes("<Sources") ? ["sources"] : []),
  ]);
}

const READER_SLUGS = new Set(Object.keys(editions).map(editionSlug));

/** A Markdown link into the reader names an edition the site has: "/read/vgcl" yes, "/read/vgc" no. */
function readerPathProblem(path: string): string | null {
  const m = /^\/read\/([^/?#]+)/.exec(path);
  return m && !READER_SLUGS.has(m[1]) ? `${path}: no edition ${m[1]}` : null;
}

describe("the docs' internal links", () => {
  it("aReaderLinkToAMissingEditionIsFound", () => {
    expect(readerPathProblem("/read/vgcl")).toBeNull();
    expect(readerPathProblem("/read/vgc")).not.toBeNull();
    expect(readerPathProblem("/docs/qumran")).toBeNull();
  });

  it("whyAnchorsExist", () => {
    const here = anchors("en", "why-editions-differ");
    expect(WHY_TOPICS.filter((t) => !here.has(t))).toEqual([]);
  });

  for (const lang of langs) {
    for (const file of readdirSync(join(root, lang)).filter((f) => f.endsWith(".mdx")).map((f) => f.slice(0, -4))) {
      it(`everyDocsLinkResolves: ${lang}/${file}`, () => {
        const text = readFileSync(join(root, lang, `${file}.mdx`), "utf8");
        const bad: string[] = [];
        for (const [, path] of text.matchAll(/\]\((\/[^)\s]*)\)/g)) {
          if (/^\/(en|it|es|fr|de|pt)(\/|$)/.test(path)) bad.push(`${path}: carries a locale`);
          const reader = readerPathProblem(path);
          if (reader) bad.push(reader);
          if (!path.startsWith("/docs")) continue;
          const m = /^\/docs(?:\/([^/#]+))?(?:#(.+))?$/.exec(path);
          if (!m) { bad.push(`${path}: not a docs page`); continue; }
          const [, slug, hash] = m;
          if (slug && !slugs.has(slug)) { bad.push(`${path}: no such page`); continue; }
          if (hash && !anchors(lang, slug ?? "index").has(hash)) bad.push(`${path}: no such heading`);
        }
        for (const [, hash] of text.matchAll(/\]\(#([^)\s]+)\)/g)) if (!anchors(lang, file).has(hash)) bad.push(`#${hash}: no such heading`);
        if (file !== "index" && !text.includes("<Sources")) bad.push("no <Sources>");
        expect(bad).toEqual([]);
      });
    }
  }
});
