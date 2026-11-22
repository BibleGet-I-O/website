import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { getPassage } from "../api";
import { groupPassage } from "../passage";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const rawRow = (book: number, chapter: number, verse: number) => ({
  univbooknum: book, chapter, verse, text: `v${verse}`, verse_segment: null, printed_chapter: null,
});

function stub(res: () => Response) {
  const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => res());
  vi.stubGlobal("fetch", fn);
  return fn;
}
const url = (fn: ReturnType<typeof stub>) => new URL(String(fn.mock.calls[0][0]));

beforeEach(() => {
  process.env.BIBLEGET_API_URL = "https://api.test/dev";
  process.env.BIBLEGET_READ_KEY = "read-key";
  process.env.BIBLEGET_READER_KEY = "reader-key";
});
afterEach(() => vi.unstubAllGlobals());

describe("getPassage", () => {
  it("sendsTheReferenceAsTyped", async () => {
    const fn = stub(() => json({ results: [rawRow(39, 1, 1)] }));
    await getPassage({ sigla: "DRB", query: "Giona 1:1-2:2;3:2", access: "visitor" });
    expect(url(fn).pathname).toBe("/dev/quote");
    expect(Object.fromEntries(url(fn).searchParams)).toEqual({ query: "Giona 1:1-2:2;3:2", version: "DRB", numbering: "edition", return: "json" });
  });

  it("readsTheRowsAndTheCap", async () => {
    stub(() => json({ results: [rawRow(39, 1, 1), rawRow(39, 1, 2)], notices: [{ code: "VERSES_CAPPED", version: "DRB" }] }));
    const out = await getPassage({ sigla: "DRB", query: "Jonah 1", access: "visitor" });
    expect(out).toMatchObject({ readable: true, capped: true, partial: false });
    expect(out.rows.map((r) => [r.bookNum, r.chapter, r.verse])).toEqual([[39, 1, 1], [39, 1, 2]]);
  });

  it("aPartlyReadableReferenceSaysSo", async () => {
    stub(() => json({ results: [rawRow(39, 1, 1)], errors: ["unknown book Xyz"] }));
    expect(await getPassage({ sigla: "DRB", query: "Jonah 1:1; Xyz 3:4", access: "visitor" })).toMatchObject({ readable: true, partial: true });
  });

  it("aCapOnAnotherEditionIsNotThisOnes", async () => {
    stub(() => json({ results: [rawRow(39, 1, 1)], notices: [{ code: "VERSES_CAPPED", version: "NABRE" }] }));
    expect((await getPassage({ sigla: "DRB", query: "Jonah 1", access: "visitor" })).capped).toBe(false);
  });

  it("anUnreadableReferenceIsNotAnError", async () => {
    for (const res of [json({ errors: ["unknown book"] }), json({ results: [] }), json({ detail: "bad" }, 422), json({ detail: "bad" }, 400)]) {
      stub(() => res);
      expect(await getPassage({ sigla: "DRB", query: "Xyz 1", access: "visitor" })).toEqual({ rows: [], capped: false, readable: false, partial: false });
      vi.unstubAllGlobals();
    }
  });
});

describe("groupPassage", () => {
  it("groupsByBookAndPrintedChapter", () => {
    const r = (bookNum: number, chapter: number, verse: number, printedChapter: number | null = null) =>
      ({ bookNum, chapter, verse, printedChapter, segment: null, label: null, text: "", titles: [] });
    const groups = groupPassage([r(39, 4, 10), r(39, 4, 11), r(40, 1, 1), r(40, 1, 2), r(27, 12, 1, 11)]);
    expect(groups.map((g) => [g.bookNum, g.chapter, g.rows.length])).toEqual([[39, 4, 2], [40, 1, 2], [27, 11, 1]]);
  });
});
