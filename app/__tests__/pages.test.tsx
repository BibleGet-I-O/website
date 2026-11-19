import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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

const ed = (sigla: string, language: string, fullname = sigla, year = "2000", copyrightHolder = "Holder", copyright = true) => ({
  sigla,
  fullname,
  year,
  language,
  canon: "",
  copyrightHolder,
  notes: "",
  copyright,
  liturgical: false,
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
  const shelf = () => [
    ed("BLPD", "es", "Libro del Pueblo de Dios", "2015", "Fundación Palabra de Vida"),
    ed("CEI2008", "it", "Testo Sintetico", "2008"),
    { ...ed("DRB", "en", "Douay-Rheims", "1899", "", false), notes: "" },
    { ...ed("LUZZI", "it", "Luzzi Sintetico", "1924", "", false) },
    { ...ed("NABRE", "en", "Synthetic English", "1970", "Some Holder"), notes: "First note line.\nSecond note line." },
    ed("NVBSE", "es", "Nueva Sintetica", "1990"),
    ed("VGCL", "la", "Vulgata Synthetica", "1592", "", false),
  ];
  const home = async () => render(wrap(await HomePage({ params: Promise.resolve({ locale: "en" }) })));

  it("navListsOneLinkPerLanguagePointingAtItsSection", async () => {
    getEditions.mockResolvedValue(shelf());
    await home();
    const nav = screen.getByRole("navigation", { name: "Languages" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["English", "Italian", "Latin", "Spanish"]);
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["#lang-en", "#lang-it", "#lang-la", "#lang-es"]);
  });

  it("eachLanguageSectionHasItsIdAndHeading", async () => {
    getEditions.mockResolvedValue(shelf());
    const { container } = await home();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["English", "Italian", "Latin", "Spanish"]);
    for (const [code, name] of [["en", "English"], ["it", "Italian"], ["la", "Latin"], ["es", "Spanish"]]) {
      const section = container.querySelector(`#lang-${code}`)!;
      expect(section.tagName).toBe("SECTION");
      expect(within(section as HTMLElement).getByRole("heading", { level: 2 })).toHaveTextContent(name);
    }
  });

  it("eachBookLinksToItsEditionNewestFirst", async () => {
    getEditions.mockResolvedValue(shelf());
    const { container } = await home();
    const english = container.querySelector("#lang-en") as HTMLElement;
    const books = within(english).getAllByRole("link");
    expect(books).toEqual(["Synthetic English, 1970", "Douay-Rheims, 1899"].map((name) => within(english).getByRole("link", { name })));
    // The name comes from the cover's own text, not an aria-label, so the title can carry its language.
    expect(books[0]).not.toHaveAttribute("aria-label");
    expect(within(english).getByRole("link", { name: "Douay-Rheims, 1899" })).toHaveAttribute("href", "/en/read/drb");
    const spanish = container.querySelector("#lang-es") as HTMLElement;
    expect(within(spanish).getByRole("link", { name: "Nueva Sintetica, 1990" })).toHaveAttribute("href", "/en/read/nvbse");
    expect(within(spanish).getByRole("link", { name: "Libro del Pueblo de Dios, 2015" })).toHaveAttribute("href", "/en/read/blpd");
  });

  it("theEditionsTitleAndNotesCarryItsLanguage", async () => {
    getEditions.mockResolvedValue(shelf());
    await home();
    const link = screen.getByRole("link", { name: "Libro del Pueblo de Dios, 2015" });
    expect(within(link).getByText("Libro del Pueblo de Dios")).toHaveAttribute("lang", "es");
    const button = screen.getByRole("button", { name: "About Synthetic English, 1970" });
    const back = document.getElementById(button.getAttribute("aria-controls")!)!;
    expect(within(back).getByText("Synthetic English")).toHaveAttribute("lang", "en");
    expect(within(back).getByText("First note line.").closest("[lang]")).toHaveAttribute("lang", "en");
  });

  it("anEditionWithoutALanguageIsShelvedLastUnderOtherLanguages", async () => {
    getEditions.mockResolvedValue([...shelf(), ed("ZZZ", "", "Nameless Synthetic", "1800")]);
    const { container } = await home();
    const nav = screen.getByRole("navigation", { name: "Languages" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["English", "Italian", "Latin", "Spanish", "Other languages"]);
    const id = links.at(-1)!.getAttribute("href")!.slice(1);
    const section = container.querySelector(`#${id}`) as HTMLElement;
    expect(within(section).getByRole("heading", { level: 2 })).toHaveTextContent("Other languages");
    const link = within(section).getByRole("link", { name: "Nameless Synthetic, 1800" });
    expect(within(link).getByText("Nameless Synthetic")).not.toHaveAttribute("lang");
  });

  describe("shelf order and the liturgical stamp", () => {
    const it_ = (sigla: string, fullname: string, year: string, extra: object = {}) => ({ ...ed(sigla, "it", fullname, year), ...extra });
    const catholic = { canon: "CATHOLIC" };
    const liturgical = { canon: "CATHOLIC", liturgical: true };
    const italian = () => [
      it_("PROTA", "Synthetic Protestant Old", "1924", { canon: "PROTESTANT" }),
      it_("CATHA", "Synthetic Catholic Old", "1974", catholic),
      it_("LITA", "Synthetic Liturgical Old", "1974", liturgical),
      it_("NOCAN", "Synthetic Uncanoned New", "2020"),
      it_("CATHB", "Synthetic Catholic New", "2015", catholic),
      it_("LITB", "Synthetic Liturgical New", "2008", liturgical),
      it_("PROTB", "Synthetic Protestant New", "2011", { canon: "PROTESTANT" }),
      it_("NOYEAR", "Synthetic Catholic Undated", "", catholic),
    ];
    const order = (container: HTMLElement) =>
      within(container.querySelector("#lang-it") as HTMLElement).getAllByRole("link").map((a) => a.getAttribute("href"));

    it("shelvesLiturgicalThenOtherCatholicThenTheRestEachNewestFirst", async () => {
      getEditions.mockResolvedValue(italian());
      const { container } = await home();
      expect(order(container)).toEqual(
        ["litb", "lita", "cathb", "catha", "noyear", "nocan", "protb", "prota"].map((s) => `/en/read/${s}`),
      );
    });

    it("stampsOnlyTheLiturgicalEditions", async () => {
      getEditions.mockResolvedValue(italian());
      const { container } = await home();
      const stamps = container.querySelectorAll('[data-marker="liturgical"]');
      expect(stamps).toHaveLength(2);
      for (const stamp of stamps) expect(stamp).toHaveTextContent(en.Home.liturgical);
      // The stamp is part of the cover link's accessible name.
      expect(screen.getByRole("link", { name: "Synthetic Liturgical New, 2008, Liturgical text" })).toHaveAttribute("href", "/en/read/litb");
      expect(screen.getByRole("link", { name: "Synthetic Catholic New, 2015" })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Catholic New.*Liturgical/ })).toBeNull();
    });

    it("withoutLiturgicalEditionsShelvesCatholicThenTheRest", async () => {
      // An endpoint without `liturgicalversions`: getEditions marks none liturgical.
      getEditions.mockResolvedValue(italian().map((e) => ({ ...e, liturgical: false })));
      const { container } = await home();
      expect(order(container)).toEqual(
        ["cathb", "litb", "catha", "lita", "noyear", "nocan", "protb", "prota"].map((s) => `/en/read/${s}`),
      );
      expect(container.querySelector('[data-marker="liturgical"]')).toBeNull();
    });
  });

  it("aCopyrightedEditionHasTheDarkBinding", async () => {
    getEditions.mockResolvedValue(shelf());
    await home();
    expect(screen.getByRole("link", { name: "Synthetic English, 1970" })).toHaveAttribute("data-tone", "dark");
    expect(screen.getByRole("link", { name: "Douay-Rheims, 1899" })).toHaveAttribute("data-tone", "bright");
  });

  it("theCopyrightButtonTurnsTheBookToItsBackCover", async () => {
    getEditions.mockResolvedValue(shelf());
    await home();
    const button = screen.getByRole("button", { name: "About Synthetic English, 1970" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    const back = document.getElementById(button.getAttribute("aria-controls")!)!;
    expect(back).toHaveAttribute("inert");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(back).not.toHaveAttribute("inert");
    expect(screen.getByRole("link", { name: "Synthetic English, 1970" }).closest("[inert]")).not.toBeNull();
    expect(within(back).getByText("Some Holder")).toBeInTheDocument();
    expect(within(back).getByText("First note line.")).toBeInTheDocument();
    expect(within(back).getByText("Second note line.")).toBeInTheDocument();
    expect(within(back).getByText("1970")).toBeInTheDocument();
    // The endpaper scrolls, so it is a focusable, named region.
    const endpaper = within(back).getByRole("region", { name: "Colophon of Synthetic English, 1970" });
    expect(endpaper).toHaveAttribute("tabindex", "0");
    expect(button).not.toHaveAttribute("title");
    // The button comes before the turned book in tab order, so Tab from it reaches the back cover.
    expect(button.compareDocumentPosition(endpaper) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
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
    // In both columns: the second edition's own Wisdom 12:1 is fetched to pair with it.
    expect(getVerses).toHaveBeenCalledWith(expect.objectContaining({ sigla: "NABRE", chapter: 12, verse: 1 }));
    expect(screen.getAllByText("12:1")).toHaveLength(2);
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

  it("doesNotFetchThePreviousChaptersLastVerseForACappedChapter", async () => {
    // NABRE John 8 capped at 30 verses: 7:53 would make it 31, so it is not fetched or shown.
    const john = { sigla: "NABRE", books: [{ ...book(50, "John", "Jn", 21), versesPerChapter: [51, 25, 36, 54, 47, 71, 53, 59] }] };
    getIndex.mockResolvedValue(john);
    getChapter.mockResolvedValue({ rows: [verse(8, 1, { printedChapter: 8 })], truncated: true, expectedVerses: 59 });
    getVerses.mockResolvedValue([verse(7, 53, { printedChapter: 8, label: "7:53" })]);
    const { container } = render(wrap(await ChapterPage(params("nabre", "john", "8"))));
    expect(getVerses).not.toHaveBeenCalled();
    expect(Array.from(container.querySelectorAll("sup")).map((e) => e.textContent)).toEqual(["1"]);
  });

  it("aCappedPublicDomainEditionShowsNoNotice", async () => {
    getEditions.mockResolvedValue([ed("DRB", "en", "Douay-Rheims", "1899", "", false), ed("NABRE", "en")]);
    getIndex.mockResolvedValue(drbIndex);
    getChapter.mockResolvedValue({ rows: [verse(11, 1)], truncated: true, expectedVerses: 48 });
    getVerses.mockResolvedValue([]);
    render(wrap(await ChapterPage(params("drb", "wisdom", "11"))));
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("theInterlinearSecondEditionNoticeFollowsItsCopyrightToo", async () => {
    getEditions.mockResolvedValue([ed("DRB", "en", "Douay-Rheims", "1899", "", false), ed("NABRE", "en", "NABRE Full"), ed("LUZZI", "it", "Luzzi", "1900", "", false)]);
    getIndex.mockResolvedValue(drbIndex);
    getChapter.mockResolvedValue({ rows: [verse(11, 1)], truncated: true, expectedVerses: 48 });
    getVerses.mockResolvedValue([]);
    const copyrighted = render(wrap(await ChapterPage(params("drb", "wisdom", "11", { with: "NABRE" }))));
    expect(copyrighted.getAllByRole("note")).toHaveLength(1);
    expect(copyrighted.getByRole("note")).toHaveTextContent("NABRE Full");
    copyrighted.unmount();
    const publicDomain = render(wrap(await ChapterPage(params("drb", "wisdom", "11", { with: "LUZZI" }))));
    expect(publicDomain.queryByRole("note")).toBeNull();
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
