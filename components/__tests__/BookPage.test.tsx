import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { Note, VerseRow } from "@/lib/types";
import { markerDomId } from "@/lib/notes";

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
const push = vi.fn();
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<object>("next/navigation")),
  useRouter: () => ({ push }),
}));

const { BookPage } = await import("@/components/BookPage");
const { CappedNotice, noticeFor } = await import("@/components/CappedNotice");
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
  it("printsVerseNumbersInRubricRedAndKeepsTheTitleAndSectionAtTheTop", () => {
    const { container } = render(<BookPage heading="Genesis 4" chapter={4} rows={[row(4, 1, { titles: ["Cain and Abel"] }), row(4, 2)]} />);
    expect(container.querySelector("sup")).toHaveClass("text-red-700", "dark:text-red-400");
    expect(container.querySelector("[data-sticky-head]")).toContainElement(screen.getByRole("heading", { level: 1, name: "Genesis 4" }));
    expect(screen.getByRole("heading", { level: 2, name: "Cain and Abel" })).toHaveAttribute("data-head-col", "0");
  });

  it("givesEachVerseAnIdToLinkTo", () => {
    const { container } = render(<BookPage heading="John 3" chapter={3} rows={[row(3, 16), row(3, 17, { segment: "a" }), row(4, 1)]} />);
    expect(container.querySelector("#v3\\.16")).toHaveTextContent("Text of 3:16.");
    expect(container.querySelector("#v3\\.17a")).not.toBeNull();
    // A neighbour chapter's verse printed on this page keeps its own chapter in its id.
    expect(container.querySelector("#v4\\.1")).not.toBeNull();
  });

  it("marksANumberTheEditionOmitsWithARubricAndAWhyLink", () => {
    const { container } = render(wrap(<BookPage heading="Actus Apostolorum 24" chapter={24} rows={[row(24, 6), row(24, 8)]} />));
    const line = container.querySelector("#v24\\.7")!;
    expect(line.querySelector("sup")).toHaveTextContent(/^7$/);
    expect(line.querySelector("sup")).toHaveClass("text-red-700");
    const rubric = screen.getByText("[omissis]");
    expect(rubric).toHaveAttribute("lang", "la");
    expect(rubric).toHaveClass("text-red-700");
    expect(line).toContainElement(screen.getByRole("link", { name: "Why does this edition lack this verse?" }));
    expect(screen.getByRole("link", { name: "Why does this edition lack this verse?" })).toHaveAttribute("href", "/en/docs/why-editions-differ#missing-verses");
    expect(container.querySelector("#v24\\.6")).not.toContainElement(line as HTMLElement);
    expect(Array.from(container.querySelectorAll("sup")).map((e) => e.textContent)).toEqual(["6", "7", "8"]);
  });

  it("marksTwoConsecutiveOmittedNumbersOnOneLine", () => {
    const { container } = render(wrap(<BookPage heading="Ecclesiasticus 9" chapter={9} rows={[row(9, 9), row(9, 12)]} />));
    expect(container.querySelector("#v9\\.10")!.querySelector("sup")).toHaveTextContent("10–11");
    expect(screen.getAllByText("[omissis]")).toHaveLength(1);
  });

  it("marksARowTheApiSendsAsOmitted", () => {
    const rows = [row(24, 6), row(24, 7, { text: "", omitted: true }), row(24, 8)];
    const { container } = render(wrap(<BookPage heading="Actus Apostolorum 24" chapter={24} rows={rows} />));
    expect(container.querySelector("#v24\\.7")!.querySelector("sup")).toHaveTextContent(/^7$/);
    expect(screen.getAllByText("[omissis]")).toHaveLength(1);
    expect(container.querySelectorAll("#v24\\.7")).toHaveLength(1);
    expect(Array.from(container.querySelectorAll("sup")).map((e) => e.textContent)).toEqual(["6", "7", "8"]);
  });

  it("marksTwoOmittedRowsOnOneLineWithAnAnchorForEach", () => {
    const rows = [row(9, 9), row(9, 10, { text: "", omitted: true }), row(9, 11, { text: "", omitted: true }), row(9, 12)];
    const { container } = render(wrap(<BookPage heading="Ecclesiasticus 9" chapter={9} rows={rows} />));
    expect(container.querySelector("#v9\\.10")!.querySelector("sup")).toHaveTextContent("10–11");
    expect(container.querySelector("#v9\\.11")).not.toBeNull();
    expect(screen.getAllByText("[omissis]")).toHaveLength(1);
    expect(Array.from(container.querySelectorAll("sup")).map((e) => e.textContent)).toEqual(["9", "10–11", "12"]);
  });

  it("keepsTheNoteMarkersOfOmittedRows", () => {
    const note = (id: string): Note => ({ id, edition: "NABRE", kind: "footnote", marker: "*", label: null, title: null, body: "Omitted.", refs: [] });
    const rows = [
      row(8, 36),
      row(8, 37, { text: "", omitted: true, notes: [{ note: note("NABRE:44008037-1"), field: "text", position: null }] }),
      row(8, 38, { text: "", omitted: true, notes: [{ note: note("NABRE:44008038-1"), field: "text", position: null }] }),
      row(8, 39),
    ];
    const { container } = render(wrap(<BookPage heading="Acts 8" chapter={8} rows={rows} />));
    expect(container.querySelector("#v8\\.37")!.querySelector(`[id="${markerDomId("NABRE:44008037-1", rows[1])}"]`)).not.toBeNull();
    expect(container.querySelector("#v8\\.38")!.querySelector(`[id="${markerDomId("NABRE:44008038-1", rows[2])}"]`)).not.toBeNull();
    expect(screen.getAllByText("[omissis]")).toHaveLength(1);
  });

  it("anchorsAnOmittedRowWithItsSegment", () => {
    const rows = [row(24, 7, { segment: "a" }), row(24, 7, { segment: "b", text: "", omitted: true }), row(24, 8)];
    const { container } = render(wrap(<BookPage heading="Actus Apostolorum 24" chapter={24} rows={rows} />));
    expect(container.querySelector("#v24\\.7b")).toContainElement(screen.getByText("[omissis]"));
  });

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
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <BookPage heading="Wisdom 11" chapter={11} rows={placed} />
      </NextIntlClientProvider>,
    );
    const sups = Array.from(container.querySelectorAll("sup")).map((e) => e.textContent);
    expect(sups).toEqual(["25", "26", "12:1"]);
    // Its number explains why it is printed here; the chapter's own verses carry no mark.
    expect(screen.getAllByRole("link", { name: "Why is this verse printed here?" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Why is this verse printed here?" })).toHaveAttribute("href", "/en/docs/why-editions-differ#printed-elsewhere");
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
    expect(container.querySelector("section p")?.textContent).toContain("And it was so. The LightsAnd God made");
    // It feeds the running head like any other.
    expect(screen.getByRole("heading", { level: 2, name: "The Lights" })).toHaveAttribute("data-head-col", "0");
  });

  it("headingsOpeningASectionTogetherGiveTheRunningHeadTheirLast", () => {
    render(<BookPage heading="Genesis 1" chapter={1} rows={[row(1, 1, { titles: ["Light", "The first day"] })]} />);
    for (const name of ["Light", "The first day"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toHaveAttribute("data-head-text", "The first day");
    }
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

describe("marks", () => {
  it("marksTheRowsMentions", () => {
    const rows = [row(1, 1, { text: "Et dixit Petrus." }), row(1, 2, { text: "Venit Iacobus.", mentions: [{ start: 6, end: 13, candidates: ["a", "b"] }] })];
    rows[0].mentions = [{ start: 9, end: 15, entry: "petrus" }];
    const { container } = render(wrap(<BookPage heading="Liber 1" chapter={1} rows={rows} />));
    const marks = Array.from(container.querySelectorAll(".bg-mention"));
    expect(marks.map((m) => [m.textContent, m.getAttribute("data-mention")])).toEqual([["Petrus", "1.1|0"], ["Iacobus", "1.2|0"]]);
    expect(container.querySelectorAll("sup.bg-mention-review")).toHaveLength(1);
  });
});
