import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { Book, VerseRow } from "@/lib/types";

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
const { Interlinear } = await import("@/components/Interlinear");

const row = (chapter: number, verse: number): VerseRow => ({
  chapter, verse, label: null, printedChapter: null, text: `Text ${chapter}:${verse}.`, titles: [],
});
const joel: Book = { bookNum: 32, name: "Joel", abbrev: "Joel", chapters: 3, versesPerChapter: [20, 32, 21] };
const base = {
  heading: "Joel 3",
  main: { sigla: "NABRE", name: "New American Bible" },
  rows: [row(3, 1), row(3, 2)],
  bookNum: 32,
  bookName: "Joel",
  chapter: 3,
  truncated: false,
  view: "side-by-side" as const,
  redirectTo: "/en/read/nabre/joel/3?with=VGCL",
};
type Props = Parameters<typeof Interlinear>[0];
type Second = Props["others"][number]["second"];
const VGCL = { sigla: "VGCL", name: "Vulgata Clementina" };
const DRB = { sigla: "DRB", name: "Douay-Rheims" };
const render2 = async (props: Partial<Props>) =>
  render(<NextIntlClientProvider locale="en" messages={en}>{await Interlinear({ ...base, others: [], ...props })}</NextIntlClientProvider>);
/** One compared edition (VGCL), as before the third. */
const show = async ({ second, secondNotice, ...props }: Partial<Props> & { second: Second; secondNotice?: Props["others"][number]["notice"] }) =>
  render2({ ...props, others: [{ side: VGCL, second, notice: secondNotice }] });

describe("Interlinear", () => {
  it("alignedShowsTheSpread", async () => {
    await show({ second: { mode: "aligned", rows: [row(3, 1), row(3, 2)], truncated: false, book: joel } });
    expect(screen.getByTestId("spread")).toBeInTheDocument();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("sectionTitlesAreLevelTwoHeadingsUnderThePageHeading", async () => {
    const titled = { ...row(3, 1), titles: ["The day of the Lord"] };
    await show({ second: { mode: "aligned", rows: [row(3, 1), row(3, 2)], truncated: false, book: joel }, rows: [titled, row(3, 2)] });
    expect(screen.getByRole("heading", { level: 2, name: "The day of the Lord" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
  });

  it("wholeChapterShowsTheSecondBelowWithTheNotice", async () => {
    await show({ second: { mode: "whole-chapter", rows: [row(3, 1), row(3, 2), row(3, 3)], truncated: false, book: joel } });
    expect(screen.queryByTestId("spread")).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent(/divide the chapters of this book differently/);
    expect(screen.getByRole("heading", { level: 2, name: "Joel 3" })).toBeInTheDocument();
    expect(screen.getAllByTestId("verse-line")).toHaveLength(5);
  });

  it("aChapterTheSecondLacksIsDividedDifferently", async () => {
    await show({ chapter: 4, second: { mode: "whole-chapter", rows: [], truncated: false, book: joel } });
    expect(screen.getByRole("note")).toHaveTextContent("Vulgata Clementina has no chapter 4");
    expect(screen.getByRole("note")).toHaveTextContent(/divide the chapters of this book differently/);
  });

  it("missingSaysTheSecondHasNoSuchBook", async () => {
    await show({ second: { mode: "missing", reason: "book" } });
    expect(screen.getByRole("note")).toHaveTextContent("Vulgata Clementina does not have Joel");
  });

  it("estherBeyondTenIsPrintedAsAdditions", async () => {
    await show({ bookName: "Esther", chapter: 12, second: { mode: "missing", reason: "esther-additions" } });
    expect(screen.getByRole("note")).toHaveTextContent(/as additions within chapters 1–10/);
  });

  it("anUnavailableSecondShowsTheBookViewWithANotice", async () => {
    await show({ second: { mode: "unavailable" } });
    expect(screen.getByRole("heading", { level: 1, name: "Joel 3" })).toBeInTheDocument();
    expect(screen.queryAllByTestId("verse-line")).toHaveLength(0);
    expect(screen.getByRole("note")).toHaveTextContent(/Vulgata Clementina could not be loaded/);
  });

  it("aCappedSecondEditionShowsItsNotice", async () => {
    await show({ secondNotice: "signIn", second: { mode: "aligned", rows: [row(3, 1)], truncated: true, book: joel } });
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Vulgata Clementina");
    expect(note).toHaveTextContent(/Sign in to read the whole chapter/);
  });

  it("alignedSecondStaysInTheSpreadWhileAWholeChapterThirdGoesBelow", async () => {
    await render2({
      others: [
        { side: DRB, second: { mode: "aligned", rows: [row(3, 1), row(3, 2)], truncated: false, book: joel } },
        { side: VGCL, second: { mode: "whole-chapter", rows: [row(3, 1), row(3, 2), row(3, 3)], truncated: false, book: joel } },
      ],
    });
    expect(screen.getAllByTestId("column-name").map((e) => e.textContent)).toEqual(["New American Bible", "Douay-Rheims"]);
    expect(screen.getByRole("note")).toHaveTextContent(/New American Bible and Vulgata Clementina divide the chapters/);
    expect(screen.getAllByTestId("verse-line").length).toBeGreaterThanOrEqual(3);
  });

  it("twoAlignedComparedEditionsMakeThreeColumns", async () => {
    await render2({
      others: [
        { side: DRB, second: { mode: "aligned", rows: [row(3, 1), row(3, 2)], truncated: false, book: joel } },
        { side: VGCL, second: { mode: "aligned", rows: [row(3, 1), row(3, 2)], truncated: false, book: joel } },
      ],
    });
    expect(screen.getByTestId("spread")).toHaveClass("grid-cols-3");
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("theInterlinearViewReachesTheSpread", async () => {
    await render2({ view: "interlinear", others: [{ side: DRB, second: { mode: "aligned", rows: [row(3, 1)], truncated: false, book: joel } }] });
    expect(screen.getByTestId("spread")).toHaveClass("grid-cols-1");
  });

  it("oneUnavailableOfTwoKeepsTheSpreadOfTheOther", async () => {
    await render2({
      others: [
        { side: DRB, second: { mode: "unavailable" } },
        { side: VGCL, second: { mode: "aligned", rows: [row(3, 1), row(3, 2)], truncated: false, book: joel } },
      ],
    });
    expect(screen.getAllByTestId("column-name").map((e) => e.textContent)).toEqual(["New American Bible", "Vulgata Clementina"]);
    expect(screen.getByRole("note")).toHaveTextContent(/Douay-Rheims could not be loaded/);
  });

  it("allUnavailableShowsTheBookViewWithANotePerEdition", async () => {
    await render2({ others: [{ side: DRB, second: { mode: "unavailable" } }, { side: VGCL, second: { mode: "unavailable" } }] });
    expect(screen.queryByTestId("spread")).toBeNull();
    expect(screen.queryAllByTestId("verse-line")).toHaveLength(0);
    expect(screen.getAllByRole("note").map((n) => n.textContent)).toEqual([
      expect.stringMatching(/Douay-Rheims could not be loaded/),
      expect.stringMatching(/Vulgata Clementina could not be loaded/),
    ]);
  });

  it("eachCappedComparedEditionShowsItsNotice", async () => {
    await render2({
      others: [
        { side: DRB, notice: "signIn", second: { mode: "aligned", rows: [row(3, 1)], truncated: true, book: joel } },
        { side: VGCL, notice: "signIn", second: { mode: "aligned", rows: [row(3, 1)], truncated: true, book: joel } },
      ],
    });
    const notes = screen.getAllByRole("note");
    expect(notes).toHaveLength(2);
    expect(notes[0]).toHaveTextContent("Douay-Rheims");
    expect(notes[1]).toHaveTextContent("Vulgata Clementina");
  });
});
