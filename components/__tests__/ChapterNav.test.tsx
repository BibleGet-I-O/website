import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

vi.mock("server-only", () => ({}));
const { neighbours, ChapterNav } = await import("@/components/ChapterNav");

const book = (bookNum: number, name: string, chapters: number) => ({
  bookNum, name, abbrev: name.slice(0, 3), chapters, versesPerChapter: Array(chapters).fill(10),
});
const index = { sigla: "DRB", books: [book(1, "Genesis", 50), book(47, "Matthew", 28), book(48, "Mark", 16), book(73, "Apocalypse", 22)] };

describe("neighbours", () => {
  it("neighboursCrossBooks", () => {
    expect(neighbours(index, 47, 28)).toEqual({ prev: { slug: "matthew", chapter: 27 }, next: { slug: "mark", chapter: 1 } });
    expect(neighbours(index, 48, 1)).toEqual({ prev: { slug: "matthew", chapter: 28 }, next: { slug: "mark", chapter: 2 } });
    expect(neighbours(index, 1, 1)).toEqual({ next: { slug: "genesis", chapter: 2 } });
    expect(neighbours(index, 73, 22)).toEqual({ prev: { slug: "apocalypse", chapter: 21 } });
  });

  it("linksToTheNeighboursKeepingTheQuery", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        {await ChapterNav({ index, bookNum: 47, chapter: 28, base: "/read/drb", query: "?with=VGCL" })}
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("link", { name: /Previous chapter/ })).toHaveAttribute("href", "/en/read/drb/matthew/27?with=VGCL");
    expect(screen.getByRole("link", { name: /Next chapter/ })).toHaveAttribute("href", "/en/read/drb/mark/1?with=VGCL");
  });
});
