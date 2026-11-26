import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import editions from "./fixtures/editions.json";

const root = join(process.cwd(), "content", "docs");
const BOOKS: Record<string, number[]> = editions;

/** Every .mdx under content/docs, as [path, text]. */
function mdx(): [string, string][] {
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => [f, readFileSync(join(root, f), "utf8")]);
}

/** The problems of one <ReaderLink …> tag's attributes: an edition or a book the site lacks. */
export function readerLinkProblems(tag: string): string[] {
  const attr = (name: string) => new RegExp(`\\b${name}=(?:"([^"]*)"|\\{([^}]*)\\})`).exec(tag);
  const value = (name: string) => { const m = attr(name); return m ? (m[1] ?? m[2]) : undefined; };
  const edition = value("edition");
  const book = Number(value("book"));
  const out: string[] = [];
  for (const sigla of [edition, ...(value("with")?.match(/[A-Z0-9]+/g) ?? [])]) {
    if (!sigla || !BOOKS[sigla]) out.push(`${tag}: no edition ${sigla}`);
    else if (!BOOKS[sigla].includes(book)) out.push(`${tag}: ${sigla} has no book ${book}`);
  }
  return out;
}

describe("the docs' links into the reader", () => {
  it("findsAMissingEditionOrBook", () => {
    expect(readerLinkProblems('<ReaderLink edition="NABRE" book={17} chapter={1}>')).toEqual([]);
    expect(readerLinkProblems('<ReaderLink edition="LUZZI" book={17} chapter={1}>')).toHaveLength(1);
    expect(readerLinkProblems('<ReaderLink edition="NABRE" book={17} chapter={1} with={["XYZ"]}>')).toHaveLength(1);
  });

  it("everyReaderLinkIsInTheFixture", () => {
    const bad = mdx().flatMap(([f, text]) => [...text.matchAll(/<ReaderLink\b[^>]*>/g)].flatMap((m) => readerLinkProblems(m[0]).map((p) => `${f}: ${p}`)));
    expect(bad).toEqual([]);
  });
});
