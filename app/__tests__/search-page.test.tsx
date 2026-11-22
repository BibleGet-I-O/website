import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

vi.mock("server-only", () => ({}));
const getEditions = vi.fn();
const getIndex = vi.fn();
const getPassage = vi.fn();
vi.mock("@/lib/api", async () => ({
  ...(await vi.importActual<typeof import("@/lib/api")>("@/lib/api")),
  getEditions: () => getEditions(),
  getIndex: (s: string) => getIndex(s),
  getPassage: (p: unknown) => getPassage(p),
}));
const searchEdition = vi.fn();
vi.mock("@/lib/search", async () => ({ ...(await vi.importActual<object>("@/lib/search")), searchEdition: (p: unknown) => searchEdition(p) }));
const getAccess = vi.fn();
vi.mock("@/lib/access", () => ({ getAccess: () => getAccess() }));
vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
const semanticHit = vi.fn();
vi.mock("@/lib/rate-limit", async () => ({
  ...(await vi.importActual<object>("@/lib/rate-limit")),
  semanticLimiter: { hit: () => semanticHit(), limit: 10, windowMs: 60_000, size: () => 0 },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "203.0.113.5" }) }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<object>("next/navigation")),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

const { default: SearchPage, generateMetadata } = await import("@/app/[locale]/read/[edition]/search/page");

const ed = { sigla: "NABRE", fullname: "New American Bible", year: "2011", language: "en", canon: "", copyrightHolder: "USCCB", notes: "", copyright: true, liturgical: false };
const index = {
  books: [
    { bookNum: 27, name: "Wisdom", abbrev: "Ws", chapters: 19, versesPerChapter: [] },
    { bookNum: 39, name: "Jonah", abbrev: "Jon", chapters: 4, versesPerChapter: [] },
    { bookNum: 50, name: "John", abbrev: "Jn", chapters: 21, versesPerChapter: [] },
  ],
};
const hit = (extra: object = {}) => ({ bookNum: 50, book: "John", chapter: 3, verse: 16, segment: null, printedChapter: null, label: null, text: "God so loved the world, the Light", ...extra });

const row = (bookNum: number, chapter: number, verse: number, text: string) =>
  ({ bookNum, chapter, verse, text, segment: null, label: null, printedChapter: null, titles: [] });

async function page(search: Record<string, string>) {
  const ui = await SearchPage({ params: Promise.resolve({ locale: "en", edition: "nabre" }), searchParams: Promise.resolve(search) });
  return render(<NextIntlClientProvider locale="en" messages={en}>{ui}</NextIntlClientProvider>);
}

beforeEach(() => {
  getEditions.mockReset().mockResolvedValue([ed]);
  getIndex.mockReset().mockResolvedValue(index);
  getPassage.mockReset();
  searchEdition.mockReset().mockResolvedValue({ kind: "ok", hits: [hit()], total: 1, capped: null });
  getAccess.mockReset().mockResolvedValue({ access: "visitor", signedIn: false, emailVerified: false });
  semanticHit.mockReset().mockReturnValue({ ok: true, retryAfter: 0 });
});

describe("search page", () => {
  it("listsKeywordHitsWithLinksToTheirVerses", async () => {
    await page({ mode: "keyword", q: "light" });
    expect(searchEdition).toHaveBeenCalledWith({ sigla: "NABRE", mode: "keyword", q: "light", exact: false, page: 1, access: "visitor" });
    expect(screen.getByRole("link", { name: "John 3:16" })).toHaveAttribute("href", "/en/read/nabre/john/3#v3.16");
  });

  it("marksTheMatchedWords", async () => {
    const { container } = await page({ mode: "keyword", q: "light" });
    expect(Array.from(container.querySelectorAll("mark")).map((m) => m.textContent)).toEqual(["Light"]);
  });

  it("marksAccentFoldedWholeWordsOnly", async () => {
    searchEdition.mockResolvedValue({ kind: "ok", hits: [hit({ text: "Israël and Israelites" })], total: 1, capped: null });
    const { container } = await page({ mode: "keyword", q: "israel" });
    expect(Array.from(container.querySelectorAll("mark")).map((m) => m.textContent)).toEqual(["Israël"]);
  });

  it("marksWordsWithDigitsWhole", async () => {
    searchEdition.mockResolvedValue({ kind: "ok", hits: [hit({ text: "TEST2 Gen 3:1" })], total: 1, capped: null });
    const { container } = await page({ mode: "keyword", q: "test2" });
    expect(Array.from(container.querySelectorAll("mark")).map((m) => m.textContent)).toEqual(["TEST2"]);
  });

  it("marksNothingForSemanticSearch", async () => {
    const { container } = await page({ mode: "semantic", q: "light of the world" });
    expect(container.querySelectorAll("mark")).toHaveLength(0);
  });

  it("linksAVersePrintedElsewhereToItsPrintedChapter", async () => {
    searchEdition.mockResolvedValue({ kind: "ok", hits: [hit({ bookNum: 27, book: "Wisdom", chapter: 12, verse: 1, printedChapter: 11 })], total: 1, capped: null });
    await page({ mode: "keyword", q: "light" });
    expect(screen.getByRole("link", { name: "Wisdom 12:1" })).toHaveAttribute("href", "/en/read/nabre/wisdom/11#v12.1");
  });

  it("pagesKeywordResultsByFifty", async () => {
    searchEdition.mockResolvedValue({ kind: "ok", hits: Array.from({ length: 50 }, () => hit()), total: 1234, capped: null });
    await page({ mode: "keyword", q: "light", match: "exact", page: "2" });
    expect(searchEdition).toHaveBeenCalledWith(expect.objectContaining({ page: 2, exact: true }));
    expect(screen.getByText("51–100 of 1,234")).toBeInTheDocument();
    const nav = within(screen.getByRole("navigation", { name: "Result pages" }));
    expect(nav.getByRole("link", { name: "Previous" })).toHaveAttribute("href", "/en/read/nabre/search?mode=keyword&q=light&match=exact&page=1");
    expect(nav.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/en/read/nabre/search?mode=keyword&q=light&match=exact&page=3");
  });

  it("cappedNoticeComesBackToThisSearch", async () => {
    searchEdition.mockResolvedValue({ kind: "ok", hits: [hit()], total: 30, capped: 252 });
    await page({ mode: "keyword", q: "light" });
    expect(screen.getByText("30 of 252 results")).toBeInTheDocument();
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Visitors see the first 30 results in this edition. Sign in to see them all.");
    expect(within(note).getByRole("button")).toBeInTheDocument();
    expect(note.querySelector("input[name=redirectTo]")?.getAttribute("value") ?? note.innerHTML).toContain("/en/read/nabre/search?mode=keyword&q=light");
  });

  it("refusedKeywordSaysTryAnotherWord", async () => {
    searchEdition.mockResolvedValue({ kind: "refused" });
    await page({ mode: "keyword", q: "the" });
    expect(screen.getByText("Try a longer or less common word.")).toBeInTheDocument();
  });

  it("semanticUnavailableOffersKeyword", async () => {
    searchEdition.mockResolvedValue({ kind: "semanticUnavailable" });
    await page({ mode: "semantic", q: "light of the world" });
    expect(screen.getByText("Semantic search is not available right now.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search these words instead" })).toHaveAttribute("href", "/en/read/nabre/search?mode=keyword&q=light+of+the+world");
  });

  it("tooManySemanticSearchesSaysWait", async () => {
    semanticHit.mockReturnValue({ ok: false, retryAfter: 30 });
    await page({ mode: "semantic", q: "light" });
    expect(searchEdition).not.toHaveBeenCalled();
    expect(screen.getByText("Too many searches; try again in a minute.")).toBeInTheDocument();
  });

  it("aReferenceSearchShowsThePassage", async () => {
    getPassage.mockResolvedValue({ readable: true, capped: false, rows: [row(39, 1, 1, "The word of the Lord came"), row(39, 1, 2, "Arise, go to Nineveh")] });
    await page({ mode: "reference", q: "Jonah 1:1-2" });
    expect(getPassage).toHaveBeenCalledWith({ sigla: "NABRE", query: "Jonah 1:1-2", access: "visitor" });
    expect(searchEdition).not.toHaveBeenCalled();
    expect(semanticHit).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Jonah 1" })).toHaveAttribute("href", "/en/read/nabre/jonah/1#v1.1");
    expect(screen.getByText("Arise, go to Nineveh")).toBeInTheDocument();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("aPassageAcrossBooksHasAHeadingForEach", async () => {
    getPassage.mockResolvedValue({ readable: true, capped: false, rows: [row(39, 4, 11, "Nineveh"), row(50, 1, 1, "In the beginning was the Word")] });
    await page({ mode: "reference", q: "Jonah 4:11; John 1:1" });
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Jonah 4", "John 1"]);
    expect(screen.getByRole("link", { name: "John 1" })).toHaveAttribute("href", "/en/read/nabre/john/1#v1.1");
  });

  it("anUnreadableReferenceSaysSoWithTheExample", async () => {
    getPassage.mockResolvedValue({ readable: false, capped: false, rows: [] });
    await page({ mode: "reference", q: "Xyz 9" });
    expect(screen.getByRole("status")).toHaveTextContent("That reference could not be read. Try one like Jonah 1:1-2:2; 3:2.");
  });

  it("aCappedReferenceOffersToSignIn", async () => {
    getPassage.mockResolvedValue({ readable: true, capped: true, rows: [row(39, 1, 1, "x")] });
    await page({ mode: "reference", q: "Jonah 1-4" });
    const note = screen.getByRole("note");
    expect(within(note).getByRole("button")).toBeInTheDocument();
    expect(note.querySelector("input[name=redirectTo]")?.getAttribute("value") ?? note.innerHTML).toContain("/en/read/nabre/search?mode=reference&q=Jonah+1-4");
  });

  it("aComparisonShowsTheNoteAndKeepsItInTheLinks", async () => {
    getPassage.mockResolvedValue({ readable: true, capped: false, rows: [row(39, 1, 1, "x")] });
    await page({ mode: "reference", q: "Jonah 1:1", from: "/en/read/nabre/john/3?with=DRB&view=interlinear" });
    expect(getPassage).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("note")).toHaveTextContent("Only New American Bible is shown");
    expect(screen.getByRole("link", { name: "Jonah 1" })).toHaveAttribute("href", "/en/read/nabre/jonah/1?with=DRB&view=interlinear#v1.1");
  });

  it("anOldHybridLinkSearchesSemantic", async () => {
    await page({ mode: "hybrid", q: "trust" });
    expect(searchEdition).toHaveBeenCalledWith(expect.objectContaining({ mode: "semantic" }));
    expect(screen.getByRole("radio", { name: "Semantic" })).toBeChecked();
  });

  it("noResultsSaysSo", async () => {
    searchEdition.mockResolvedValue({ kind: "ok", hits: [], total: 0, capped: null });
    await page({ mode: "keyword", q: "zebra" });
    expect(screen.getByText("No results for “zebra”.")).toBeInTheDocument();
  });

  it("isNotIndexed", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "en", edition: "nabre" }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("unknownModeFallsBackToKeyword", async () => {
    await page({ mode: "telepathy", q: "light" });
    expect(searchEdition).toHaveBeenCalledWith(expect.objectContaining({ mode: "keyword" }));
  });

  it("emptyQueryAsksForSomethingWithoutSearching", async () => {
    await page({ mode: "keyword", q: "  " });
    expect(searchEdition).not.toHaveBeenCalled();
    expect(screen.getByText("Type a word or a question to search this edition.")).toBeInTheDocument();
  });

  it("anUnknownEditionIsNotFound", async () => {
    await expect(SearchPage({ params: Promise.resolve({ locale: "en", edition: "nope" }), searchParams: Promise.resolve({ q: "light" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("everyLinkThePageBuildsKeepsTheWayBack", async () => {
    const from = "/en/read/nabre/john/3";
    searchEdition.mockResolvedValue({ kind: "ok", hits: Array.from({ length: 50 }, () => hit()), total: 1234, capped: null });
    await page({ mode: "keyword", q: "light", from });
    expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toContain(`from=${encodeURIComponent(from)}`);

    searchEdition.mockResolvedValue({ kind: "semanticUnavailable" });
    await page({ mode: "semantic", q: "light", from });
    expect(screen.getByRole("link", { name: "Search these words instead" }).getAttribute("href")).toContain(`from=${encodeURIComponent(from)}`);

    searchEdition.mockResolvedValue({ kind: "ok", hits: [hit()], total: 30, capped: 252 });
    const { container } = await page({ mode: "keyword", q: "light", from });
    expect(container.querySelector("[role=note]")!.innerHTML).toContain(encodeURIComponent(from));
  });

  it("theFormShowsTheSearchTheURLNamesAfterANavigation", async () => {
    searchEdition.mockResolvedValue({ kind: "semanticUnavailable" });
    const first = await SearchPage({ params: Promise.resolve({ locale: "en", edition: "nabre" }), searchParams: Promise.resolve({ mode: "semantic", q: "light" }) });
    const { rerender } = render(<NextIntlClientProvider locale="en" messages={en}>{first}</NextIntlClientProvider>);
    searchEdition.mockResolvedValue({ kind: "ok", hits: [hit()], total: 1, capped: null });
    const second = await SearchPage({ params: Promise.resolve({ locale: "en", edition: "nabre" }), searchParams: Promise.resolve({ mode: "keyword", q: "light" }) });
    rerender(<NextIntlClientProvider locale="en" messages={en}>{second}</NextIntlClientProvider>);
    expect(screen.getByRole("radio", { name: "Keyword" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Words to find" })).toHaveValue("light");
  });

  it("theReferenceUsesTheEditionsOwnLabel", async () => {
    searchEdition.mockResolvedValue({ kind: "ok", hits: [hit({ bookNum: 27, book: "Wisdom", chapter: 12, verse: 1, printedChapter: 11, label: "12:1" }), hit({ verse: 17, label: "17a" })], total: 2, capped: null });
    await page({ mode: "keyword", q: "light" });
    expect(screen.getByRole("link", { name: "Wisdom 12:1" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "John 3:17a" })).toBeInTheDocument();
  });

  it("aPagePastTheEndSaysThereAreNoMoreAndLinksToTheFirst", async () => {
    searchEdition.mockResolvedValue({ kind: "ok", hits: [], total: 30, capped: 252 });
    await page({ mode: "keyword", q: "light", page: "2" });
    expect(screen.queryByText("No results for “light”.")).toBeNull();
    expect(screen.getByText("No more results.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "First page" })).toHaveAttribute("href", "/en/read/nabre/search?mode=keyword&q=light&page=1");
  });

  it("aRefusedQuestionAsksToRephrase", async () => {
    searchEdition.mockResolvedValue({ kind: "refused" });
    await page({ mode: "semantic", q: "?" });
    expect(screen.getByText("Try rephrasing your question.")).toBeInTheDocument();
  });

  it("goesBackOnlyToAReaderPage", async () => {
    await page({ mode: "keyword", q: "light", from: "/en/read/nabre/john/3" });
    expect(screen.getByRole("link", { name: "Back to the reading" })).toHaveAttribute("href", "/en/read/nabre/john/3");
  });

  it("ignoresABackLinkElsewhere", async () => {
    await page({ mode: "keyword", q: "light", from: "https://evil.example/" });
    expect(screen.getByRole("link", { name: "Back to the reading" })).toHaveAttribute("href", "/en/read/nabre");
  });
});
