import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { getBookOutline, getGeneralIntroduction, getIntroduction, NotFound } from "../api";
import { withIntroLinks } from "../note-links";
import type { EditionIndex } from "../types";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const start = { book: 1, chapter: 36, verse: 43, segment: null, printed_chapter: null };
const piece = { text: "Gn 25:19–35:43.", refs: [{ start: { ...start, chapter: 25, verse: 19 }, end: null, span: [0, 8] }], sic: [{ span: [9, 14], intended: "36:43", ref: { start, end: null } }] };
const intro = { id: "1", title: "THE BOOK OF GENESIS", books: [1], blocks: [{ type: "heading", level: 1, text: "Outline", refs: [] }, { type: "paragraph", ...piece }, { type: "row", cells: [{ text: "One", refs: [] }] }] };

beforeEach(() => {
  process.env.BIBLEGET_API_URL = "https://api.test/dev";
  process.env.BIBLEGET_READ_KEY = "read-key";
  process.env.BIBLEGET_READER_KEY = "reader-key";
});
afterEach(() => vi.unstubAllGlobals());

describe("getIntroduction", () => {
  it("readsABooksIntroductionAndTheGeneralOnesWithTheReaderKey", async () => {
    const fn = vi.fn(async (_u: string | URL | Request, _i?: RequestInit) => json({ version: "NABRE", book: 1, introduction: intro, general: [{ id: "pentateuch", title: "THE PENTATEUCH", books: [1, 2, 3, 4, 5] }] }));
    vi.stubGlobal("fetch", fn);
    const got = await getIntroduction("NABRE", 1);
    expect(String(fn.mock.calls[0][0])).toContain("/metadata/introduction?version=NABRE&book=1");
    expect(fn.mock.calls[0][1]).toMatchObject({ cache: "no-store", headers: { "X-Api-Key": "reader-key" } });
    expect(got.general).toEqual([{ id: "pentateuch", title: "THE PENTATEUCH", books: [1, 2, 3, 4, 5] }]);
    expect(got.introduction?.blocks[1]).toEqual({
      type: "paragraph", text: "Gn 25:19–35:43.",
      refs: [{ start: { book: 1, chapter: 25, verse: 19, segment: null, printedChapter: null }, end: null, span: [0, 8] }],
      sic: [{ span: [9, 14], intended: "36:43", ref: { start: { book: 1, chapter: 36, verse: 43, segment: null, printedChapter: null }, end: null } }],
    });
    expect(got.introduction?.blocks[2]).toEqual({ type: "row", cells: [{ text: "One", refs: [] }] });
  });

  it("leavesOutMalformedBlocksAndCitations", async () => {
    const bad = [null, { type: "weird", text: "x", refs: [] }, { type: "paragraph", text: 3, refs: [] }, { type: "heading", text: "h", refs: [] }, { type: "row", cells: "x" }];
    const refs = [{ start: null, end: null, span: [0, 1] }, { start, end: null, span: [2] }, { start, end: null, span: [0, 2] }];
    vi.stubGlobal("fetch", vi.fn(async () => json({ introduction: { ...intro, blocks: [...bad, { type: "paragraph", text: "ab", refs, sic: [{ span: [0, 1] }] }] }, general: "x" })));
    const got = await getIntroduction("NABRE", 1);
    expect(got.general).toEqual([]);
    expect(got.introduction?.blocks).toEqual([{ type: "paragraph", text: "ab", refs: [{ start: { book: 1, chapter: 36, verse: 43, segment: null, printedChapter: null }, end: null, span: [0, 2] }] }]);
  });

  it("isNullWithoutOne", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ introduction: null, general: [] })));
    expect(await getIntroduction("NABRE", 10)).toEqual({ introduction: null, general: [] });
  });
});

describe("getGeneralIntroduction", () => {
  it("readsOneById", async () => {
    const fn = vi.fn(async (_u: string | URL | Request, _i?: RequestInit) => json({ introduction: { ...intro, id: "pentateuch", books: [1, 2] } }));
    vi.stubGlobal("fetch", fn);
    expect((await getGeneralIntroduction("NABRE", "pentateuch"))?.books).toEqual([1, 2]);
    expect(String(fn.mock.calls[0][0])).toContain("/metadata/introduction?version=NABRE&id=pentateuch");
  });

  it("isNullForAnUnknownOrMalformedId", async () => {
    const fn = vi.fn(async () => json({ status: 404 }, 404));
    vi.stubGlobal("fetch", fn);
    expect(await getGeneralIntroduction("NABRE", "nope")).toBeNull();
    expect(await getGeneralIntroduction("NABRE", "../x")).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("getBookOutline", () => {
  it("namesTheIntroductionForReaders", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ titles: [], introduction: { id: "9", title: "THE BOOKS OF SAMUEL" } })));
    expect(await getBookOutline("NABRE", 10, "reader")).toEqual({ titles: [], introduction: { id: "9", title: "THE BOOKS OF SAMUEL" } });
    vi.stubGlobal("fetch", vi.fn(async () => json({ titles: [] })));
    expect((await getBookOutline("NABRE", 10, "visitor")).introduction).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 503)));
    expect(await getBookOutline("NABRE", 10, "reader")).toEqual({ titles: [], introduction: null });
  });
});

describe("withIntroLinks", () => {
  const index = { sigla: "NABRE", books: [{ bookNum: 1, name: "Genesis", abbrev: "Gn", chapters: 50, versesPerChapter: [] }] } as unknown as EditionIndex;
  it("linksCitationsAndTheIntendedPassageOfAMisprint", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ introduction: intro, general: [] })));
    const { introduction } = await getIntroduction("NABRE", 1);
    const linked = withIntroLinks(introduction!, { index, base: "/en/read/nabre", query: "?with=CEI2008" });
    const p = linked.blocks[1];
    if (p.type !== "paragraph") throw new Error("paragraph expected");
    expect(p.refs[0].href).toBe("/en/read/nabre/genesis/25?with=CEI2008#v25.19");
    expect(p.sic?.[0].ref?.href).toBe("/en/read/nabre/genesis/36?with=CEI2008#v36.43");
  });
});
