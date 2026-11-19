import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

vi.mock("server-only", () => ({}));
const getEditions = vi.fn();
const getIndex = vi.fn();
const getChapter = vi.fn();
const getVerses = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getEditions: () => getEditions(),
    getIndex: (s: string) => getIndex(s),
    getChapter: (p: unknown) => getChapter(p),
    getVerses: (p: unknown) => getVerses(p),
  };
});
const getAccess = vi.fn();
vi.mock("@/lib/access", () => ({ getAccess: () => getAccess() }));
vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<object>("next/navigation")),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ push: vi.fn() }),
  unstable_rethrow: (e: unknown) => {
    throw e;
  },
}));

const { ApiUnavailable, NotFound } = await import("@/lib/api");
const { default: HomePage } = await import("@/app/[locale]/page");
const { default: BooksPage } = await import("@/app/[locale]/read/[edition]/page");
const { default: ChapterPage } = await import("@/app/[locale]/read/[edition]/[book]/[chapter]/page");

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {ui}
  </NextIntlClientProvider>
);

const ed = (sigla: string, language: string, fullname = sigla, year = "2000", copyrightHolder = "Holder") => ({
  sigla,
  fullname,
  year,
  language,
  copyrightHolder,
});
const book = (bookNum: number, name: string, abbrev: string, chapters: number) => ({
  bookNum,
  name,
  abbrev,
  chapters,
  versesPerChapter: Array(chapters).fill(10),
});

beforeEach(() => {
  getEditions.mockReset();
  getIndex.mockReset();
  getChapter.mockReset();
  getVerses.mockReset();
  getAccess.mockReset();
  getAccess.mockResolvedValue({ access: "visitor", signedIn: false, emailVerified: false });
});

describe("home", () => {
  it("homeListsTheSevenEditionsByLanguage", async () => {
    getEditions.mockResolvedValue([
      ed("BLPD", "es", "Libro del Pueblo de Dios", "2015", "Fundación Palabra de Vida"),
      ed("CEI2008", "it"),
      ed("DRB", "en", "Douay-Rheims"),
      ed("LUZZI", "it"),
      ed("NABRE", "en"),
      ed("NVBSE", "es"),
      ed("VGCL", "la"),
    ]);
    render(wrap(await HomePage({ params: Promise.resolve({ locale: "en" }) })));
    expect(screen.getAllByRole("link")).toHaveLength(7);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["English", "Italian", "Latin", "Spanish"]);
    const spanish = screen.getByRole("heading", { name: "Spanish" }).closest("section")!;
    expect(within(spanish).getByText(/Fundación Palabra de Vida/)).toBeInTheDocument();
    expect(within(spanish).getByText(/2015/)).toBeInTheDocument();
    expect(within(spanish).getByRole("link", { name: /Libro del Pueblo de Dios/ })).toHaveAttribute("href", "/en/read/blpd");
  });
});

describe("books", () => {
  const params = (edition: string) => ({ params: Promise.resolve({ locale: "en", edition }) });

  it("booksPageUsesTheEditionsOwnNames", async () => {
    getEditions.mockResolvedValue([ed("DRB", "en", "Douay-Rheims")]);
    getIndex.mockResolvedValue({ sigla: "DRB", books: [book(1, "Genesis", "Gen", 50), book(46, "Malachi", "Mal", 4), book(47, "Matthew", "Matt", 28), book(73, "Apocalypse", "Rev", 22)] });
    render(wrap(await BooksPage(params("drb"))));
    expect(getIndex).toHaveBeenCalledWith("DRB");
    const nt = screen.getByRole("heading", { name: "New Testament" }).closest("section")!;
    expect(within(nt).getByText("Apocalypse")).toBeInTheDocument();
    expect(within(within(nt).getByRole("list", { name: "Chapters of Apocalypse" })).getByRole("link", { name: "22" })).toHaveAttribute("href", "/en/read/drb/apocalypse/22");
    const ot = screen.getByRole("heading", { name: "Old Testament" }).closest("section")!;
    expect(within(ot).getByText("Malachi")).toBeInTheDocument();
    expect(within(ot).queryByText("Matthew")).toBeNull();
  });

  it("unknownEditionIs404", async () => {
    getEditions.mockResolvedValue([ed("DRB", "en")]);
    await expect(BooksPage(params("nope"))).rejects.toThrow("NEXT_NOT_FOUND");
    getEditions.mockResolvedValue([ed("DRB", "en")]);
    getIndex.mockRejectedValue(new NotFound());
    await expect(BooksPage(params("drb"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("booksPageHidesABookTheEditionLacks", async () => {
    getEditions.mockResolvedValue([ed("LUZZI", "it")]);
    getIndex.mockResolvedValue({ sigla: "LUZZI", books: [book(1, "Genesi", "Gen", 50)] });
    render(wrap(await BooksPage(params("luzzi"))));
    expect(screen.queryByText(/Tobi/)).toBeNull();
  });
});

describe("chapter", () => {
  const params = (edition: string, bookSlug: string, chapter: string, search: Record<string, string> = {}) => ({
    params: Promise.resolve({ locale: "en", edition, book: bookSlug, chapter }),
    searchParams: Promise.resolve(search),
  });
  const verse = (chapter: number, v: number, extra: object = {}) => ({
    chapter, verse: v, label: null, printedChapter: null, text: `Verse ${chapter}:${v}.`, titles: [], ...extra,
  });
  const drbIndex = { sigla: "DRB", books: [book(17, "Tobias", "Tob", 14), book(19, "Esther", "Esth", 16), book(27, "Wisdom", "Wis", 19)] };

  beforeEach(() => {
    getEditions.mockResolvedValue([ed("DRB", "en", "Douay-Rheims"), ed("NABRE", "en"), ed("LUZZI", "it")]);
  });

  it("bookTheEditionLacksIs404", async () => {
    getIndex.mockResolvedValue({ sigla: "LUZZI", books: [book(1, "Genesi", "Gen", 50)] });
    await expect(ChapterPage(params("luzzi", "tobia", "1"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getChapter).not.toHaveBeenCalled();
  });

  it("chapterOutsideTheBookOrUnknownEditionIs404", async () => {
    getIndex.mockResolvedValue(drbIndex);
    for (const c of ["0", "01", "20", "x", "1.5"]) {
      await expect(ChapterPage(params("drb", "wisdom", c))).rejects.toThrow("NEXT_NOT_FOUND");
    }
    await expect(ChapterPage(params("nope", "wisdom", "1"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getChapter).not.toHaveBeenCalled();
  });

  it("aChapterTheEndpointRejectsIs404", async () => {
    getIndex.mockResolvedValue(drbIndex);
    getChapter.mockRejectedValue(new NotFound());
    getVerses.mockResolvedValue([]);
    await expect(ChapterPage(params("drb", "wisdom", "11"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("rendersTheChapterWithTheNextChaptersVersePrintedInIt", async () => {
    getIndex.mockResolvedValue(drbIndex);
    getChapter.mockResolvedValue({ rows: [verse(11, 1), verse(11, 2)], truncated: false, expectedVerses: 2 });
    getVerses.mockImplementation(async (p: { chapter: number }) => (p.chapter === 12 ? [verse(12, 1, { printedChapter: 11 })] : [verse(10, 10)]));
    render(wrap(await ChapterPage(params("drb", "wisdom", "11", { with: "NABRE" }))));
    expect(getChapter).toHaveBeenCalledWith(expect.objectContaining({ sigla: "DRB", bookAbbrev: "Wis", chapter: 11, access: "visitor" }));
    expect(getVerses).toHaveBeenCalledWith(expect.objectContaining({ sigla: "DRB", bookAbbrev: "Wis", chapter: 12, verse: 1 }));
    expect(screen.getByRole("heading", { level: 1, name: "Wisdom 11" })).toBeInTheDocument();
    expect(screen.getByText("12:1")).toBeInTheDocument();
    expect(screen.queryByText(/Sign in to read/)).toBeNull();
    expect(screen.getByRole("link", { name: /Next chapter/ })).toHaveAttribute("href", "/en/read/drb/wisdom/12?with=NABRE");
  });

  it("aCappedChapterGetsTheNoticeForTheUser", async () => {
    getIndex.mockResolvedValue(drbIndex);
    getChapter.mockResolvedValue({ rows: [verse(11, 1)], truncated: true, expectedVerses: 48 });
    getVerses.mockImplementation(async (p: { chapter: number }) => (p.chapter === 12 ? [verse(12, 1, { printedChapter: 11 })] : []));
    render(wrap(await ChapterPage(params("drb", "wisdom", "11"))));
    expect(screen.getByText(/Sign in to read the whole chapter/)).toBeInTheDocument();
    // A capped chapter does not end with the next chapter's first verse, and it is not fetched.
    expect(screen.queryByText("12:1")).toBeNull();
    expect(getVerses).not.toHaveBeenCalledWith(expect.objectContaining({ chapter: 12 }));
  });

  it("startsAChapterWithThePreviousChaptersVersePrintedInIt", async () => {
    // NABRE John 7:53 is printed at the start of John 8.
    const john = { sigla: "NABRE", books: [{ ...book(50, "John", "Jn", 21), versesPerChapter: [51, 25, 36, 54, 47, 71, 53, 59] }] };
    getIndex.mockResolvedValue(john);
    getChapter.mockImplementation(async (p: { chapter: number }) =>
      p.chapter === 8
        ? { rows: [verse(8, 1, { printedChapter: 8 })], truncated: false, expectedVerses: 59 }
        : { rows: [verse(7, 52, { printedChapter: 7 }), verse(7, 53, { printedChapter: 8, label: "7:53" })], truncated: false, expectedVerses: 53 });
    getVerses.mockImplementation(async (p: { chapter: number; verse: number }) =>
      p.chapter === 7 && p.verse === 53 ? [verse(7, 53, { printedChapter: 8, label: "7:53" })] : []);
    const { container, unmount } = render(wrap(await ChapterPage(params("nabre", "john", "8"))));
    expect(getVerses).toHaveBeenCalledWith(expect.objectContaining({ chapter: 7, verse: 53, access: "visitor" }));
    expect(Array.from(container.querySelectorAll("sup")).map((e) => e.textContent)).toEqual(["7:53", "1"]);
    unmount();

    const seven = render(wrap(await ChapterPage(params("nabre", "john", "7"))));
    expect(Array.from(seven.container.querySelectorAll("sup")).map((e) => e.textContent)).toEqual(["52"]);
  });

  it("aFailedNeighbourVerseFetchStillShowsTheChapter", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    getIndex.mockResolvedValue(drbIndex);
    getChapter.mockResolvedValue({ rows: [verse(11, 1)], truncated: false, expectedVerses: 1 });
    getVerses.mockRejectedValue(new ApiUnavailable("endpoint answered 503"));
    render(wrap(await ChapterPage(params("drb", "wisdom", "11"))));
    expect(screen.getByText(/Verse 11:1/)).toBeInTheDocument();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("estherWithBothTextsHasTenChaptersAndCrossesToFirstMaccabees", async () => {
    // getIndex has already folded NABRE's 20 reported Esther chapters into 10 with both verse counts.
    const est = { ...book(19, "Esther", "Est", 10), greekVersesPerChapter: Array(10).fill(12) };
    getIndex.mockResolvedValue({ sigla: "NABRE", books: [est, book(20, "1 Maccabees", "1Mc", 16)] });
    getChapter.mockResolvedValue({ rows: [verse(10, 1)], truncated: false, expectedVerses: 1 });
    getVerses.mockResolvedValue([]);
    await expect(ChapterPage(params("nabre", "esther", "11"))).rejects.toThrow("NEXT_NOT_FOUND");
    render(wrap(await ChapterPage(params("nabre", "esther", "10"))));
    const chapters = screen.getByLabelText("Chapter") as HTMLSelectElement;
    expect(Array.from(chapters.options).map((o) => o.value)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(screen.getByRole("link", { name: /Next chapter/ })).toHaveAttribute("href", "/en/read/nabre/1-maccabees/1");
    expect(screen.getByLabelText("Esther text")).toHaveValue("GREEK");
    // The previous chapter's last verse is counted in the Greek text.
    expect(getVerses).toHaveBeenCalledWith(expect.objectContaining({ chapter: 9, verse: 12, tradition: "GREEK" }));
  });

  it("passesTheEstherTraditionOnlyWhereTheEditionHasBoth", async () => {
    getIndex.mockResolvedValue({ sigla: "NABRE", books: [{ ...book(19, "Esther", "Est", 10), greekVersesPerChapter: Array(10).fill(12) }] });
    getChapter.mockResolvedValue({ rows: [verse(1, 1)], truncated: false, expectedVerses: 1 });
    getVerses.mockResolvedValue([]);
    render(wrap(await ChapterPage(params("nabre", "esther", "1", { tradition: "HEBREW" }))));
    expect(getChapter).toHaveBeenCalledWith(expect.objectContaining({ tradition: "HEBREW" }));
    expect(screen.getByLabelText("Esther text")).toHaveValue("HEBREW");

    getChapter.mockClear();
    getIndex.mockResolvedValue(drbIndex);
    render(wrap(await ChapterPage(params("drb", "esther", "1", { tradition: "HEBREW" }))));
    expect(getChapter).toHaveBeenCalledWith(expect.not.objectContaining({ tradition: "HEBREW" }));
  });
});
