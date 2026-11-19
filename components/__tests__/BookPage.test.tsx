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

describe("BookPage formatting", () => {
  it("rendersLineTagsInsteadOfPrintingThem", () => {
    const rows = [
      row(2, 1, { text: "<pof>Why have the Gentiles raged,</pof> <pol>and the people devised vain things?</pol>" }),
      row(2, 2, { text: "\n<pof>The kings of the earth stood up,</pof>\n<poi>and the princes met together,</poi>" }),
      row(2, 3, { text: "And then a prose verse." }),
    ];
    const { container } = render(<BookPage heading="Psalm 2" chapter={2} rows={rows} />);
    expect(container.textContent).not.toMatch(/<\/?po/);
    const lines = Array.from(container.querySelectorAll(".bg-line"));
    expect(lines.map((l) => l.className.split(" ")[1])).toEqual(["bg-pof", "bg-pol", "bg-pof", "bg-poi"]);
    // Each poetic verse's number hangs at the start of its first line; the prose verse's stays inline.
    expect(lines[0].firstElementChild).toHaveClass("bg-vnum-hang");
    expect(lines[0].firstElementChild?.textContent).toBe("1");
    expect(lines[2].firstElementChild?.textContent).toBe("2");
    const three = Array.from(container.querySelectorAll("sup")).find((s) => s.textContent === "3");
    expect(three).not.toHaveClass("bg-vnum-hang");
  });

  it("putsAMidVerseHeadingAtItsTitlePositionWithoutStartingASection", () => {
    const text = "And it was so. And God made two great lights.";
    const rows = [
      row(1, 1, { titles: ["Creation"], text: "In the beginning." }),
      row(1, 2, { titles: ["The Lights"], titlePosition: "And it was so. ".length, text }),
    ];
    const { container } = render(<BookPage heading="Genesis 1" chapter={1} rows={rows} />);
    expect(container.querySelectorAll("section")).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Creation", "The Lights"]);
    expect(container.querySelector("p")?.textContent).toContain("And it was so. The LightsAnd God made");
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
    expect(noticeFor(false, visitor, true)).toBeNull();
    expect(noticeFor(true, visitor, true)).toBe("signIn");
    render(await CappedNotice({ kind: "signIn", redirectTo: "/en/read/nabre/matthew/5" }));
    expect(screen.getByText(/Sign in to read the whole chapter/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("noNoticeForAnEditionTheApiDoesNotListAsCopyrighted", () => {
    expect(noticeFor(true, visitor, false)).toBeNull();
    expect(noticeFor(true, unverified, false)).toBeNull();
    expect(noticeFor(true, reader, false)).toBeNull();
  });

  it("unverifiedUserSeesTheVerifyPrompt", async () => {
    expect(noticeFor(true, unverified, true)).toBe("verify");
    expect(noticeFor(false, unverified, true)).toBeNull();
    render(await CappedNotice({ kind: "verify", redirectTo: "/en" }));
    expect(screen.getByText(/Verify your email address/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("fullTextOffForTheEditionShowsTheUnavailableNoticeWithoutSignIn", async () => {
    expect(noticeFor(true, reader, true)).toBe("unavailable");
    expect(noticeFor(false, reader, true)).toBeNull();
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
