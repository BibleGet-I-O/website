import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

vi.mock("server-only", () => ({}));
const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));
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
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  useRouter: () => ({ push: routerPush, prefetch: vi.fn() }),
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

  describe("the shelf opens the reader", () => {
    afterEach(() => localStorage.clear());
    const luzzi = () => screen.getAllByRole("link").find((a) => a.getAttribute("href") === "/en/read/luzzi")!;

    it("shelfClickOpensTheLastChapterRead", async () => {
      getEditions.mockResolvedValue(shelf());
      routerPush.mockClear();
      localStorage.setItem("bibleget.lastRead.LUZZI", JSON.stringify({ bookNum: 50, chapter: 3 }));
      await home();
      fireEvent.click(luzzi());
      expect(routerPush).toHaveBeenLastCalledWith("/en/read/luzzi?book=50&chapter=3");
    });

    it("shelfClickWithNothingStoredOpensGenesisOne", async () => {
      getEditions.mockResolvedValue(shelf());
      routerPush.mockClear();
      await home();
      fireEvent.click(luzzi());
      expect(routerPush).toHaveBeenLastCalledWith("/en/read/luzzi?book=1&chapter=1");
    });

    it("modifiedShelfClickFollowsTheLink", async () => {
      getEditions.mockResolvedValue(shelf());
      routerPush.mockClear();
      await home();
      const link = luzzi();
      let leftToBrowser: boolean | undefined;
      const stop = (e: Event) => {
        leftToBrowser = !e.defaultPrevented;
        e.preventDefault();
      };
      window.addEventListener("click", stop);
      fireEvent.click(link, { ctrlKey: true });
      window.removeEventListener("click", stop);
      expect(leftToBrowser).toBe(true);
      expect(routerPush).not.toHaveBeenCalled();
      expect(link).toHaveAttribute("href", "/en/read/luzzi");
    });
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
  const params = (edition: string, search: Record<string, string> = {}) => ({
    params: Promise.resolve({ locale: "en", edition }),
    searchParams: Promise.resolve(search),
  });

  describe("switching edition from a chapter", () => {
    beforeEach(() => {
      getEditions.mockResolvedValue([ed("LUZZI", "it"), ed("DRB", "en")]);
      getIndex.mockResolvedValue({ sigla: "LUZZI", books: [book(1, "Genesi", "Gen", 50), book(39, "Malachia", "Mal", 3)] });
    });

    it("opensTheSameChapterWhereTheEditionHasIt", async () => {
      await expect(BooksPage(params("luzzi", { book: "1", chapter: "12", with: "DRB,NABRE", view: "interlinear", tradition: "HEBREW" }))).rejects.toThrow(
        "NEXT_REDIRECT /en/read/luzzi/genesi/12?with=DRB,NABRE&view=interlinear&tradition=HEBREW",
      );
      await expect(BooksPage(params("luzzi", { book: "39", chapter: "3" }))).rejects.toThrow("NEXT_REDIRECT /en/read/luzzi/malachia/3");
    });

    it("showsTheBooksWhereTheEditionLacksTheBookOrChapter", async () => {
      // Tobit (17) is not in a Protestant canon; Malachi 4 is DRB's numbering, not Luzzi's.
      for (const search of [{ book: "17", chapter: "1" } as Record<string, string>, { book: "39", chapter: "4" }, { book: "1", chapter: "x" }, { book: "1" }]) {
        const { unmount } = render(wrap(await BooksPage(params("luzzi", search))));
        expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
        unmount();
      }
    });

    it("theBooksListKeepsTheComparisonOnItsChapterLinks", async () => {
      // Luzzi lacks Tobit: the list opens, and choosing a chapter keeps the compared editions and the view.
      render(wrap(await BooksPage(params("luzzi", { book: "17", chapter: "1", with: "DRB,NABRE", view: "interlinear" }))));
      expect(screen.getByRole("link", { name: "12" })).toHaveAttribute("href", "/en/read/luzzi/genesi/12?with=DRB,NABRE&view=interlinear");
    });
  });

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

  it("booksPageSearchesTheWholeEdition", async () => {
    // Search runs over the whole edition, so its lens is there before a chapter is chosen; the results lead back here.
    getEditions.mockResolvedValue([ed("DRB", "en", "Douay-Rheims")]);
    getIndex.mockResolvedValue({ sigla: "DRB", books: [book(1, "Genesis", "Gen", 50)] });
    const { container } = render(wrap(await BooksPage(params("drb", { book: "17", chapter: "1", with: "NABRE" }))));
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("action", "/en/read/drb/search");
    expect(container.querySelector('input[name="from"]')).toHaveValue("/en/read/drb?with=NABRE");
  });

  it("booksPageAllEditionsLinkPointsBack", async () => {
    getEditions.mockResolvedValue([ed("DRB", "en", "Douay-Rheims")]);
    getIndex.mockResolvedValue({ sigla: "DRB", books: [book(1, "Genesis", "Gen", 50)] });
    render(wrap(await BooksPage(params("drb"))));
    const back = screen.getByRole("link", { name: "All editions" });
    expect(back).toHaveAttribute("href", "/en");
    // The arrow is drawn, not read: the link's name stays "All editions".
    expect(back).toHaveTextContent(/^⟵\s*All editions$/);
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

  it("chapterPageRemembersItself", async () => {
    localStorage.clear();
    getIndex.mockResolvedValue(drbIndex);
    getChapter.mockResolvedValue({ rows: [verse(2, 1)], truncated: false, expectedVerses: 1 });
    getVerses.mockResolvedValue([]);
    render(wrap(await ChapterPage(params("drb", "tobias", "2"))));
    expect(JSON.parse(localStorage.getItem("bibleget.lastRead.DRB")!)).toEqual({ bookNum: 17, chapter: 2 });
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

  it("theChapterTurnsAsOnePage", async () => {
    getIndex.mockResolvedValue(drbIndex);
    getChapter.mockResolvedValue({ rows: [verse(11, 1), verse(11, 2)], truncated: false, expectedVerses: 2 });
    getVerses.mockResolvedValue([]);
    const { container } = render(wrap(await ChapterPage(params("drb", "wisdom", "11"))));
    const pages = container.querySelectorAll("[data-page-turn]");
    expect(pages).toHaveLength(1);
    expect(pages[0].querySelector("article")).not.toBeNull();
    expect(within(pages[0] as HTMLElement).getByRole("navigation", { name: "Chapters" })).toBeInTheDocument();
    expect(within(pages[0] as HTMLElement).queryByRole("toolbar")).toBeNull();
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
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

  it("twoComparedEditionsLoadBothAndAlignThree", async () => {
    getIndex.mockResolvedValue(drbIndex);
    getChapter.mockResolvedValue({ rows: [verse(11, 1), verse(11, 2)], truncated: false, expectedVerses: 2 });
    getVerses.mockResolvedValue([]);
    render(wrap(await ChapterPage(params("drb", "wisdom", "11", { with: "nabre,LUZZI,DRB" }))));
    for (const sigla of ["NABRE", "LUZZI"]) expect(getChapter).toHaveBeenCalledWith(expect.objectContaining({ sigla, chapter: 11 }));
    expect(screen.getAllByTestId("column-name").map((e) => e.textContent)).toEqual(["Douay-Rheims", "NABRE", "LUZZI"]);
    expect(screen.getByTestId("spread")).toHaveClass("grid-cols-3");
    expect(screen.getByRole("link", { name: /Next chapter/ })).toHaveAttribute("href", "/en/read/drb/wisdom/12?with=NABRE,LUZZI");
    expect(screen.getByRole("main")).toHaveClass("max-w-7xl");
  });

  it("interlinearViewIsPassedToTheLayoutAndTheChapterLinks", async () => {
    getIndex.mockResolvedValue(drbIndex);
    getChapter.mockResolvedValue({ rows: [verse(11, 1)], truncated: false, expectedVerses: 1 });
    getVerses.mockResolvedValue([]);
    render(wrap(await ChapterPage(params("drb", "wisdom", "11", { with: "NABRE", view: "interlinear" }))));
    expect(screen.getByTestId("spread")).toHaveClass("grid-cols-1");
    expect(screen.getByRole("main")).toHaveClass("max-w-3xl");
    expect(screen.getByRole("link", { name: /Next chapter/ })).toHaveAttribute("href", "/en/read/drb/wisdom/12?with=NABRE&view=interlinear");
  });

  it("thePageWidthFollowsTheEditionsInTheSpread", async () => {
    // LUZZI divides Wisdom 11 differently (another verse count): it goes below, so two columns, not three.
    getIndex.mockImplementation(async (sigla: string) =>
      sigla === "LUZZI" ? { sigla, books: [{ ...book(27, "Sapienza", "Sap", 19), versesPerChapter: Array(19).fill(5) }] } : drbIndex);
    getChapter.mockResolvedValue({ rows: [verse(11, 1)], truncated: false, expectedVerses: 1 });
    getVerses.mockResolvedValue([]);
    render(wrap(await ChapterPage(params("drb", "wisdom", "11", { with: "NABRE,LUZZI" }))));
    expect(screen.getAllByTestId("column-name")).toHaveLength(2);
    expect(screen.getByRole("main")).toHaveClass("max-w-6xl");
  });

  it("theViewWithoutAComparedEditionIsIgnored", async () => {
    getIndex.mockResolvedValue(drbIndex);
    getChapter.mockResolvedValue({ rows: [verse(11, 1)], truncated: false, expectedVerses: 1 });
    getVerses.mockResolvedValue([]);
    render(wrap(await ChapterPage(params("drb", "wisdom", "11", { view: "interlinear" }))));
    expect(screen.queryByTestId("spread")).toBeNull();
    expect(screen.getByRole("link", { name: /Next chapter/ })).toHaveAttribute("href", "/en/read/drb/wisdom/12");
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

  describe("Esther's two texts", () => {
    const est = { ...book(19, "Esther", "Est", 10), greekVersesPerChapter: Array(10).fill(12) };
    const nabre = { sigla: "NABRE", books: [est, book(20, "1 Maccabees", "1Mc", 16)] };
    const byText = (greek: object[], hebrew: object[] | Error, truncated = false) =>
      getChapter.mockImplementation(async (p: { sigla: string; tradition?: string }) => {
        if (p.sigla !== "NABRE") return { rows: [verse(1, 1, { text: "Douay 1:1." })], truncated: false, expectedVerses: 1 };
        if (p.tradition === "HEBREW") {
          if (hebrew instanceof Error) throw hebrew;
          return { rows: hebrew, truncated: false, expectedVerses: hebrew.length };
        }
        return { rows: greek, truncated, expectedVerses: greek.length };
      });
    beforeEach(() => {
      getIndex.mockImplementation(async (s: string) => (s === "NABRE" ? nabre : drbIndex));
      getVerses.mockResolvedValue([]);
    });

    it("estherWithBothTextsHasTenChaptersAndCrossesToFirstMaccabees", async () => {
      byText([verse(10, 1)], [verse(10, 1)]);
      await expect(ChapterPage(params("nabre", "esther", "11"))).rejects.toThrow("NEXT_NOT_FOUND");
      render(wrap(await ChapterPage(params("nabre", "esther", "10"))));
      fireEvent.click(screen.getByRole("button", { name: /Go to another book or chapter/ }));
      expect(screen.getAllByRole("link", { name: /^\d+$/ }).map((a) => a.textContent)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
      expect(screen.getByRole("link", { name: /Next chapter/ })).toHaveAttribute("href", "/en/read/nabre/1-maccabees/1");
      // The previous chapter's last verse is counted in each text.
      expect(getVerses).toHaveBeenCalledWith(expect.objectContaining({ chapter: 9, verse: 12, tradition: "GREEK" }));
      expect(getVerses).toHaveBeenCalledWith(expect.objectContaining({ chapter: 9, verse: 10, tradition: "HEBREW" }));
    });

    it("esthersTwoTextsTurnAsOnePage", async () => {
      byText([verse(1, 1, { text: "Greek one." })], [verse(1, 1, { text: "Hebrew one." })]);
      const { container } = render(wrap(await ChapterPage(params("nabre", "esther", "1"))));
      const pages = container.querySelectorAll("[data-page-turn]");
      expect(pages).toHaveLength(1);
      expect(within(pages[0] as HTMLElement).getAllByTestId("spread")).toHaveLength(1);
    });

    it("readAloneEstherShowsBothTextsSideBySide", async () => {
      byText(
        [verse(1, 1, { segment: "a", text: "Greek one-a." }), verse(1, 1, { text: "Greek one." })],
        [verse(1, 1, { text: "Hebrew one." })],
      );
      render(wrap(await ChapterPage(params("nabre", "esther", "1"))));
      expect(getChapter).toHaveBeenCalledWith(expect.objectContaining({ tradition: "GREEK" }));
      expect(getChapter).toHaveBeenCalledWith(expect.objectContaining({ tradition: "HEBREW" }));
      expect(screen.getAllByTestId("spread")).toHaveLength(1);
      expect(screen.getAllByTestId("column-name").map((e) => within(e).getByText(/Septuagint|Masoretic/).textContent)).toEqual(["Septuagint", "Masoretic text"]);
      const [a1, a2] = screen.getAllByTestId("cell-a");
      const [b1, b2] = screen.getAllByTestId("cell-b");
      expect(a1).toHaveTextContent("Greek one-a.");
      expect(b1).toBeEmptyDOMElement();
      expect(a2).toHaveTextContent("Greek one.");
      expect(b2).toHaveTextContent("Hebrew one.");
      fireEvent.click(screen.getByRole("button", { name: "Reading settings" }));
      expect(screen.queryByLabelText("Esther text")).toBeNull();
      expect(screen.queryByRole("navigation", { name: "Esther text" })).toBeNull();
    });

    it("readAloneInterlinearKeepsTheViewInTheChapterLinks", async () => {
      byText([verse(2, 1)], [verse(2, 1)]);
      render(wrap(await ChapterPage(params("nabre", "esther", "2", { view: "interlinear" }))));
      expect(screen.getAllByTestId("sigla").map((e) => e.textContent)).toEqual(["LXX", "MT"]);
      expect(screen.getByRole("link", { name: /Next chapter/ })).toHaveAttribute("href", "/en/read/nabre/esther/3?view=interlinear");
    });

    it("leavingEstherDropsItsView", async () => {
      byText([verse(10, 1)], [verse(10, 1)]);
      render(wrap(await ChapterPage(params("nabre", "esther", "10", { view: "interlinear" }))));
      expect(screen.getByRole("link", { name: /Next chapter/ })).toHaveAttribute("href", "/en/read/nabre/1-maccabees/1");
    });

    it("comparingEstherShowsTheSwitchAndOneText", async () => {
      byText([verse(1, 1)], [verse(1, 1, { text: "Hebrew one." })]);
      render(wrap(await ChapterPage(params("nabre", "esther", "1", { with: "DRB", tradition: "HEBREW" }))));
      const nabreCalls = getChapter.mock.calls.filter(([p]) => (p as { sigla: string }).sigla === "NABRE");
      expect(nabreCalls.map(([p]) => (p as { tradition?: string }).tradition)).toEqual(["HEBREW"]);
      const nav = screen.getByRole("navigation", { name: "Esther text" });
      expect(within(nav).getByRole("link", { name: "Masoretic text" })).toHaveAttribute("aria-current", "true");
      expect(within(nav).getByRole("link", { name: "Septuagint" })).toHaveAttribute("href", "/en/read/nabre/esther/1?with=DRB");
      expect(within(nav).getByRole("link", { name: "Masoretic text" })).toHaveAttribute("href", "/en/read/nabre/esther/1?with=DRB&tradition=HEBREW");
    });

    it("eachTextStopsAtItsOwnCap", async () => {
      byText(Array.from({ length: 30 }, (_, i) => verse(1, i + 1)), [verse(1, 1), verse(1, 2)], true);
      render(wrap(await ChapterPage(params("nabre", "esther", "1"))));
      expect(screen.queryByText(/Not in/)).toBeNull();
      expect(screen.getAllByText(/first 30 verses of each chapter/)).toHaveLength(1);
    });

    it("aFailedMasoreticTextLeavesTheSeptuagintWithANote", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      byText([verse(1, 1, { text: "Greek one." })], new ApiUnavailable("endpoint answered 503"));
      render(wrap(await ChapterPage(params("nabre", "esther", "1"))));
      expect(screen.getByText("Greek one.")).toBeInTheDocument();
      expect(screen.queryByTestId("spread")).toBeNull();
      expect(screen.getByRole("note")).toHaveTextContent("Masoretic text could not be loaded. Try again later.");
      error.mockRestore();
    });

    it("bothTextsLoadAtOnce", async () => {
      // The Masoretic chapter is asked for while the Septuagint's is still on its way.
      let hebrewAskedEarly = false;
      let greekPending = false;
      getChapter.mockImplementation(async (p: { tradition?: string }) => {
        if (p.tradition === "HEBREW") {
          hebrewAskedEarly = greekPending;
          return { rows: [verse(1, 1)], truncated: false, expectedVerses: 1 };
        }
        greekPending = true;
        await new Promise((r) => setTimeout(r, 20));
        greekPending = false;
        return { rows: [verse(1, 1)], truncated: false, expectedVerses: 1 };
      });
      render(wrap(await ChapterPage(params("nabre", "esther", "1"))));
      expect(hebrewAskedEarly).toBe(true);
    });

    it("aMasoreticChapterNotFoundLeavesTheSeptuagintWithANote", async () => {
      byText([verse(1, 1, { text: "Greek one." })], new NotFound("no rows"));
      render(wrap(await ChapterPage(params("nabre", "esther", "1"))));
      expect(screen.getByText("Greek one.")).toBeInTheDocument();
      expect(screen.getByRole("note")).toHaveTextContent("Masoretic text could not be loaded. Try again later.");
    });

    it("aComparedEditionWithBothTextsBringsTheSwitch", async () => {
      // DRB prints Esther once (the Vulgate's 16 chapters); NABRE beside it prints both texts.
      getChapter.mockImplementation(async (p: { sigla: string; tradition?: string }) => ({
        rows: [verse(1, 1, { text: `${p.sigla} ${p.tradition ?? "default"}.` })], truncated: false, expectedVerses: 1,
      }));
      render(wrap(await ChapterPage(params("drb", "esther", "1", { with: "NABRE", tradition: "HEBREW" }))));
      const calls = getChapter.mock.calls.map(([p]) => p as { sigla: string; tradition?: string });
      expect(calls.find((p) => p.sigla === "DRB")).not.toHaveProperty("tradition");
      expect(calls.filter((p) => p.sigla === "NABRE").map((p) => p.tradition)).toEqual(["HEBREW"]);
      const nav = screen.getByRole("navigation", { name: "Esther text" });
      expect(within(nav).getByRole("link", { name: "Masoretic text" })).toHaveAttribute("aria-current", "true");
      expect(within(nav).getByRole("link", { name: "Septuagint" })).toHaveAttribute("href", "/en/read/drb/esther/1?with=NABRE");
      // Moving on keeps the chosen text while a compared edition has both.
      expect(screen.getByRole("link", { name: /Next chapter/ })).toHaveAttribute("href", "/en/read/drb/esther/2?with=NABRE&tradition=HEBREW");
    });

    it("aComparedIndexThatCannotBeLoadedKeepsTheChosenText", async () => {
      // NABRE's index fails for now: it is not known to print one text, so Masoretic stays chosen.
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      getIndex.mockImplementation(async (s: string) => {
        if (s === "NABRE") throw new ApiUnavailable("endpoint answered 503");
        return drbIndex;
      });
      getChapter.mockResolvedValue({ rows: [verse(1, 1)], truncated: false, expectedVerses: 1 });
      render(wrap(await ChapterPage(params("drb", "esther", "1", { with: "NABRE", tradition: "HEBREW" }))));
      expect(screen.getByRole("link", { name: /Next chapter/ })).toHaveAttribute("href", "/en/read/drb/esther/2?with=NABRE&tradition=HEBREW");
      error.mockRestore();
    });

    it("noSwitchWhenNoEditionInTheComparisonHasBothTexts", async () => {
      getChapter.mockResolvedValue({ rows: [verse(1, 1)], truncated: false, expectedVerses: 1 });
      getIndex.mockResolvedValue(drbIndex);
      render(wrap(await ChapterPage(params("drb", "esther", "1", { with: "VGCL", tradition: "HEBREW" }))));
      expect(screen.queryByRole("navigation", { name: "Esther text" })).toBeNull();
    });

    it("aViewThatDoesNotApplyIsNotCarriedIntoTheNextComparison", async () => {
      // Arriving at a one-text Esther from Esther read interlinear: the view does not apply here.
      routerPush.mockClear();
      getChapter.mockResolvedValue({ rows: [verse(1, 1)], truncated: false, expectedVerses: 1 });
      render(wrap(await ChapterPage(params("drb", "esther", "1", { view: "interlinear" }))));
      fireEvent.click(screen.getByRole("button", { name: /Go to another book or chapter/ }));
      fireEvent.click(screen.getByRole("link", { name: "2" }));
      expect(routerPush).toHaveBeenLastCalledWith("/en/read/drb/esther/2");
      fireEvent.click(screen.getByRole("button", { name: "Reading settings" }));
      fireEvent.click(screen.getByRole("button", { name: /Compare with another edition/ }));
      fireEvent.change(screen.getByRole("combobox", { name: "Second edition" }), { target: { value: "NABRE" } });
      expect(routerPush).toHaveBeenLastCalledWith("/en/read/drb/esther/1?with=NABRE");
    });

    it("onlyEditionsWithBothTextsGetATradition", async () => {
      getChapter.mockResolvedValue({ rows: [verse(1, 1)], truncated: false, expectedVerses: 1 });
      render(wrap(await ChapterPage(params("drb", "esther", "1", { tradition: "HEBREW" }))));
      expect(getChapter).toHaveBeenCalledWith(expect.not.objectContaining({ tradition: expect.anything() }));
      expect(screen.queryByTestId("spread")).toBeNull();
    });
  });
});
