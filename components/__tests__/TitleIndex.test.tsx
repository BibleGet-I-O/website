import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { TitleIndex, type IndexTitle } from "@/components/TitleIndex";

const title = (level: number, text: string, chapter: number, verse: number): IndexTitle => ({ level, title: text, chapter, verse, href: `/en/read/x/genesis/${chapter}#v${chapter}.${verse}` });
const titles = [title(1, "I. ORIGINS", 1, 1), title(3, "Creation", 1, 1), title(3, "The Garden", 2, 4), title(1, "II. ANCESTORS", 11, 27), title(4, "Terah", 11, 27)];
const show = (p: Partial<Parameters<typeof TitleIndex>[0]> = {}) =>
  render(<NextIntlClientProvider locale="en" messages={en}><TitleIndex book="Genesis" edition="New American Bible" chapter={5} titles={titles} {...p} /></NextIntlClientProvider>);
const open = () => fireEvent.click(screen.getByRole("button", { name: "Titles in Genesis" }));
const links = () => within(screen.getByRole("dialog")).getAllByRole("link");

describe("TitleIndex", () => {
  it("opensTheBooksTitlesEachALinkToItsVerse", () => {
    show();
    expect(screen.queryByRole("link")).toBeNull();
    open();
    expect(links().map((a) => a.textContent)).toEqual(["I. ORIGINS1:1", "Creation1:1", "The Garden2:4", "II. ANCESTORS11:27", "Terah11:27"]);
    expect(links()[2]).toHaveAttribute("href", "/en/read/x/genesis/2#v2.4");
    expect(links()[2]).toHaveAttribute("data-nav");
  });

  it("indentsByTheLevelsTheBookHas", () => {
    show();
    open();
    // Levels 1, 3 and 4 are three steps, not four.
    expect(links().map((a) => a.getAttribute("data-depth"))).toEqual(["0", "1", "1", "0", "2"]);
  });

  it("marksTheTitleTheChapterOpensUnder", () => {
    show();
    open();
    expect(links().filter((a) => a.getAttribute("aria-current") === "true").map((a) => a.textContent)).toEqual(["The Garden2:4"]);
  });

  it("closesOnAPickAndOnTheCloseButton", () => {
    show();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    open();
    fireEvent.click(links()[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
    // A modified click opens a tab: the index stays.
    open();
    fireEvent.click(links()[0], { ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("nothingWithoutTitles", () => {
    expect(show({ titles: [] }).container).toBeEmptyDOMElement();
  });
});
