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
  other: { sigla: "VGCL", name: "Vulgata Clementina" },
  rows: [row(3, 1), row(3, 2)],
  bookNum: 32,
  bookName: "Joel",
  chapter: 3,
  truncated: false,
  redirectTo: "/en/read/nabre/joel/3?with=VGCL",
};
const show = async (props: Partial<Parameters<typeof Interlinear>[0]>) =>
  render(<NextIntlClientProvider locale="en" messages={en}>{await Interlinear({ ...base, second: { mode: "unavailable" }, ...props })}</NextIntlClientProvider>);

describe("Interlinear", () => {
  it("alignedShowsTheSpread", async () => {
    await show({ second: { mode: "aligned", rows: [row(3, 1), row(3, 2)], truncated: false, book: joel } });
    expect(screen.getByTestId("spread")).toBeInTheDocument();
    expect(screen.queryByRole("note")).toBeNull();
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
});
