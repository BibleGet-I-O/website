import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { IntroductionLink, TitleIndex, type IndexTitle } from "@/components/TitleIndex";

const title = (level: number, text: string, chapter: number, verse: number): IndexTitle => ({ level, title: text, chapter, verse, href: `/en/read/x/genesis/${chapter}#v${chapter}.${verse}` });
const titles = [title(1, "I. ORIGINS", 1, 1), title(3, "Creation", 1, 1), title(3, "The Garden", 2, 4), title(1, "II. ANCESTORS", 11, 27), title(4, "Terah", 11, 27)];
const show = (p: Partial<Parameters<typeof TitleIndex>[0]> = {}) =>
  render(<NextIntlClientProvider locale="en" messages={en}><TitleIndex book="Genesis" edition="New American Bible" opening={{ chapter: 5, verse: 1 }} titles={titles} {...p} /></NextIntlClientProvider>);
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

  it("comparesTheWholeReferenceTheChapterOpensAt", () => {
    const seg = (s: string | null, text: string) => ({ ...title(1, text, 1, 1), segment: s });
    const marked = () => links().filter((a) => a.getAttribute("aria-current") === "true").map((a) => a.textContent);
    const { unmount } = show({ opening: { chapter: 1, verse: 1, segment: "a" }, titles: [seg("a", "Dream"), seg("b", "Later"), seg(null, "Feast")] });
    open();
    expect(marked()).toEqual(["Dream1:1a"]);
    unmount();
    // NABRE John 8 opens with 7:53: the title there, not the one at 8:12.
    show({ opening: { chapter: 7, verse: 53 }, titles: [title(1, "Before", 7, 40), title(1, "Adultery", 7, 53), title(1, "Light", 8, 12)] });
    open();
    expect(marked()).toEqual(["Adultery7:53"]);
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

  it("opensWithTheIntroductionWhenTheBookHasOne", () => {
    show({ introduction: { href: "/en/read/x/genesis/introduction?with=CEI2008" } });
    open();
    expect(links()[0].textContent).toBe("Introduction");
    expect(links()[0]).toHaveAttribute("href", "/en/read/x/genesis/introduction?with=CEI2008");
    expect(links()[0]).toHaveAttribute("data-nav");
    expect(links().slice(1).map((a) => a.textContent)[0]).toBe("I. ORIGINS1:1");
  });

  it("isOfferedForAnIntroductionAlone", () => {
    show({ titles: [], introduction: { href: "/en/read/x/genesis/introduction" } });
    open();
    expect(links().map((a) => a.textContent)).toEqual(["Introduction"]);
  });
});

describe("IntroductionLink", () => {
  it("isABookIconLinkingToTheIntroduction", () => {
    render(<NextIntlClientProvider locale="en" messages={en}><IntroductionLink book="Genesis" href="/en/read/x/genesis/introduction" /></NextIntlClientProvider>);
    const a = screen.getByRole("link", { name: "Introduction to Genesis" });
    expect(a).toHaveAttribute("href", "/en/read/x/genesis/introduction");
    expect(a).toHaveAttribute("data-nav");
    expect(a.querySelector("svg")).not.toBeNull();
  });
});
