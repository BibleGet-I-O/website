import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { VerseRow } from "@/lib/types";

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
const push = vi.fn();
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<object>("next/navigation")),
  useRouter: () => ({ push }),
}));

const { BookPage } = await import("@/components/BookPage");
const { CappedNotice, noticeFor } = await import("@/components/CappedNotice");
const { ReaderBar } = await import("@/components/ReaderBar");
const { placeAsPrinted } = await import("@/lib/placement");
const { default: ErrorPage } = await import("@/app/[locale]/error");

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {ui}
  </NextIntlClientProvider>
);
const row = (chapter: number, verse: number, extra: Partial<VerseRow> = {}): VerseRow => ({
  chapter, verse, label: null, printedChapter: null, text: `Text of ${chapter}:${verse}.`, titles: [], ...extra,
});

beforeEach(() => push.mockReset());

describe("BookPage", () => {
  it("rendersHeadingsWhereTheyFallAndSuperscriptVerseNumbers", () => {
    const rows = [
      row(1, 1, { titles: ["The Creation"], text: "In the beginning God created heaven, and earth." }),
      row(1, 2, { text: "And the earth was void and empty." }),
      row(1, 3, { titles: ["Light", "The first day"], label: "3", text: "And God said: Be light made." }),
    ];
    const { container } = render(<BookPage heading="Genesis 1" chapter={1} rows={rows} />);
    expect(screen.getByRole("heading", { level: 1, name: "Genesis 1" })).toBeInTheDocument();
    const order = Array.from(container.querySelectorAll("h2, sup")).map((e) => e.textContent);
    expect(order).toEqual(["The Creation", "1", "2", "Light", "The first day", "3"]);
    expect(screen.getByText(/In the beginning God created/)).toBeInTheDocument();
  });

  it("showsThePrintedLabelOfAVersePrintedInThePreviousChapter", () => {
    const placed = placeAsPrinted(
      [],
      [row(11, 25, { printedChapter: 11 }), row(11, 26, { printedChapter: 11 })],
      [row(12, 1, { printedChapter: 11, label: "1" })],
      11,
    );
    const { container } = render(<BookPage heading="Wisdom 11" chapter={11} rows={placed} />);
    const sups = Array.from(container.querySelectorAll("sup")).map((e) => e.textContent);
    expect(sups).toEqual(["25", "26", "12:1"]);
    // Twelve no longer shows it.
    const twelve = placeAsPrinted([], [row(12, 1, { printedChapter: 11, label: "1" }), row(12, 2)], [], 12);
    expect(twelve.map((r) => r.verse)).toEqual([2]);
  });
});

describe("BookPage labels", () => {
  it("printsNoVerseNumberForAnUnlabelledContinuation", () => {
    const { container } = render(
      <BookPage heading="Job 10" chapter={10} rows={[row(10, 1, { label: "", text: "rest of verse one" }), row(10, 2)]} />,
    );
    expect(Array.from(container.querySelectorAll("sup")).map((e) => e.textContent)).toEqual(["2"]);
    expect(screen.getByText(/rest of verse one/)).toBeInTheDocument();
  });
});

describe("CappedNotice", () => {
  const visitor = { access: "visitor" as const, signedIn: false, emailVerified: false };
  const unverified = { access: "visitor" as const, signedIn: true, emailVerified: false };
  const reader = { access: "reader" as const, signedIn: true, emailVerified: true };

  it("cappedChapterShowsTheNoticeAndSignInButton", async () => {
    expect(noticeFor(false, visitor)).toBeNull();
    expect(noticeFor(true, visitor)).toBe("signIn");
    render(await CappedNotice({ kind: "signIn", redirectTo: "/en/read/nabre/matthew/5" }));
    expect(screen.getByText(/Sign in to read the whole chapter/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("unverifiedUserSeesTheVerifyPrompt", async () => {
    expect(noticeFor(true, unverified)).toBe("verify");
    expect(noticeFor(false, unverified)).toBeNull();
    render(await CappedNotice({ kind: "verify", redirectTo: "/en" }));
    expect(screen.getByText(/Verify your email address/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("fullTextOffForTheEditionShowsTheUnavailableNoticeWithoutSignIn", async () => {
    expect(noticeFor(true, reader)).toBe("unavailable");
    expect(noticeFor(false, reader)).toBeNull();
    render(await CappedNotice({ kind: "unavailable", redirectTo: "/en" }));
    expect(screen.getByText(/full text is not available for this edition/i)).toBeInTheDocument();
    expect(screen.queryByText(/Sign in to read/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });
});

describe("ReaderBar", () => {
  const editions = [
    { sigla: "NABRE", fullname: "New American Bible" },
    { sigla: "DRB", fullname: "Douay-Rheims" },
  ];
  const books = [
    { slug: "tobit", name: "Tobit", chapters: 14 },
    { slug: "esther", name: "Esther", chapters: 10 },
  ];
  const props = { locale: "en", edition: "NABRE", editions, books, book: "esther", chapter: 1 };

  it("estherOffersGreekAndHebrewOnlyForEditionsWithBoth", () => {
    const { unmount } = render(wrap(<ReaderBar {...props} esther />));
    const select = screen.getByLabelText("Esther text");
    expect(Array.from((select as HTMLSelectElement).options).map((o) => o.value)).toEqual(["GREEK", "HEBREW"]);
    expect(select).toHaveValue("GREEK");
    fireEvent.change(select, { target: { value: "HEBREW" } });
    expect(push).toHaveBeenCalledWith("/en/read/nabre/esther/1?tradition=HEBREW");
    unmount();

    render(wrap(<ReaderBar {...props} edition="DRB" esther={false} />));
    expect(screen.queryByLabelText("Esther text")).toBeNull();
  });

  it("navigatesByBookAndChapterAndKeepsTheSecondEdition", () => {
    render(wrap(<ReaderBar {...props} book="tobit" chapter={3} withSigla="DRB" esther={false} />));
    expect(screen.getByLabelText("Interlinear")).toBeChecked();
    expect(screen.getByLabelText("Second edition")).toHaveValue("DRB");
    fireEvent.change(screen.getByLabelText("Chapter"), { target: { value: "4" } });
    expect(push).toHaveBeenLastCalledWith("/en/read/nabre/tobit/4?with=DRB");
    fireEvent.change(screen.getByLabelText("Book"), { target: { value: "esther" } });
    expect(push).toHaveBeenLastCalledWith("/en/read/nabre/esther/1?with=DRB");
    fireEvent.click(screen.getByLabelText("Interlinear"));
    expect(push).toHaveBeenLastCalledWith("/en/read/nabre/tobit/3");
    fireEvent.change(screen.getByLabelText("Edition"), { target: { value: "DRB" } });
    expect(push).toHaveBeenLastCalledWith("/en/read/drb");
  });

  it("turningInterlinearOnPicksAnotherEdition", () => {
    render(wrap(<ReaderBar {...props} book="tobit" esther={false} />));
    expect(screen.getByLabelText("Second edition")).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Interlinear"));
    expect(push).toHaveBeenLastCalledWith("/en/read/nabre/tobit/1?with=DRB");
  });
});

describe("error boundary", () => {
  it("errorBoundaryOffersRetry", () => {
    const retry = vi.fn();
    const err = new Error("endpoint answered 503");
    err.name = "ApiUnavailable";
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(wrap(<ErrorPage error={err} retry={retry} />));
    expect(screen.getByText("The Bible service is unavailable, try again.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalled();
  });
});
