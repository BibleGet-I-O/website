import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

vi.mock("server-only", () => ({}));
const getEditions = vi.fn();
const getIndex = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, getEditions: () => getEditions(), getIndex: (s: string) => getIndex(s) };
});
vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<object>("next/navigation")),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  unstable_rethrow: (e: unknown) => {
    throw e;
  },
}));

const { NotFound } = await import("@/lib/api");
const { default: HomePage } = await import("@/app/[locale]/page");
const { default: BooksPage } = await import("@/app/[locale]/read/[edition]/page");

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

  it("bookTheEditionLacksIs404", async () => {
    // Tobit is a book the edition may lack: the books page simply does not list it.
    getEditions.mockResolvedValue([ed("LUZZI", "it")]);
    getIndex.mockResolvedValue({ sigla: "LUZZI", books: [book(1, "Genesi", "Gen", 50)] });
    render(wrap(await BooksPage(params("luzzi"))));
    expect(screen.queryByText(/Tobi/)).toBeNull();
    const { bookBySlug } = await import("@/lib/api");
    expect(bookBySlug({ sigla: "LUZZI", books: [book(1, "Genesi", "Gen", 50)] }, "tobia")).toBeUndefined();
  });
});
