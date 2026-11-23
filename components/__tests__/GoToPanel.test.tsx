import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, createEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { GoToPanel, type GoToPanelProps } from "@/components/GoToPanel";

const books = [
  { slug: "genesis", name: "Genesis", chapters: 50, bookNum: 1 },
  { slug: "exodus", name: "Exodus", chapters: 40, bookNum: 2 },
  { slug: "psalms", name: "Psalms", chapters: 150, bookNum: 23 },
  { slug: "matthew", name: "Matthew", chapters: 28, bookNum: 47 },
  { slug: "john", name: "John", chapters: 21, bookNum: 50 },
];
const onPick = vi.fn();
const onClose = vi.fn();
const props: GoToPanelProps = {
  open: true,
  onClose,
  editionName: "Nova Vulgata",
  indexHref: "/en/read/x",
  books,
  current: { slug: "genesis", chapter: 3 },
  hrefFor: (slug, chapter) => `/en/read/x/${slug}/${chapter}`,
  onPick,
};
const wrap = (p: Partial<GoToPanelProps> = {}) => (
  <NextIntlClientProvider locale="en" messages={en}>
    <GoToPanel {...props} {...p} />
  </NextIntlClientProvider>
);
const title = () => within(screen.getByRole("dialog")).getByRole("heading", { level: 2 });
const crumbs = () => within(screen.getByRole("navigation", { name: "Where you are" }));
const back = () => fireEvent.click(screen.getByRole("button", { name: "Back" }));
const chapterLinks = () => screen.getAllByRole("link", { name: /^\d+$/ });

beforeEach(() => {
  onPick.mockReset();
  onClose.mockReset();
});

describe("GoToPanel", () => {
  it("opensOnTheCurrentBooksChapters", () => {
    render(wrap());
    expect(title()).toHaveTextContent("Genesis");
    expect(screen.getByText("Nova Vulgata")).toBeInTheDocument();
    expect(chapterLinks()).toHaveLength(50);
    const three = screen.getByRole("link", { name: "3" });
    expect(three).toHaveAttribute("aria-current", "true");
    expect(three).toHaveAttribute("href", "/en/read/x/genesis/3");
  });

  it("thePrologueTileComesBeforeChapterOne", () => {
    const sirach = { slug: "sirach", name: "Sirach", chapters: 51, bookNum: 28, prologue: 1 };
    render(wrap({ books: [...books, sirach], current: { slug: "sirach", chapter: 0 } }));
    const prol = screen.getByRole("link", { name: "Prologue" });
    expect(prol).toHaveTextContent("Prol.");
    expect(prol).toHaveAttribute("href", "/en/read/x/sirach/0");
    expect(prol).toHaveAttribute("aria-current", "true");
    const tiles = within(screen.getByRole("dialog")).getAllByRole("link").filter((a) => a.closest("ul"));
    expect(tiles[0]).toBe(prol);
    expect(tiles[1]).toHaveTextContent("1");
    fireEvent.click(prol);
    expect(onPick).toHaveBeenCalledWith("sirach", 0);
  });

  it("chapterClickPicksAndCloses", () => {
    render(wrap());
    fireEvent.click(screen.getByRole("link", { name: "7" }));
    expect(onPick).toHaveBeenCalledWith("genesis", 7);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("modifiedClickIsLeftToTheBrowser", () => {
    render(wrap());
    const link = screen.getByRole("link", { name: "7" });
    // What the panel left to the browser, seen before jsdom (which cannot open a new tab) is stopped from navigating.
    let leftToBrowser: boolean | undefined;
    const stop = (e: Event) => {
      leftToBrowser = !e.defaultPrevented;
      e.preventDefault();
    };
    window.addEventListener("click", stop);
    fireEvent(link, createEvent.click(link, { ctrlKey: true }));
    window.removeEventListener("click", stop);
    expect(onPick).not.toHaveBeenCalled();
    expect(leftToBrowser).toBe(true);
  });

  it("backClimbsChaptersBooksBible", () => {
    render(wrap());
    back();
    expect(title()).toHaveTextContent("Old Testament");
    expect(screen.getByRole("heading", { name: "Pentateuch" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Wisdom Books" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Genesis" })).toHaveAttribute("aria-current", "true");
    expect(screen.queryByRole("link", { name: "Matthew" })).toBeNull();
    back();
    expect(title()).toHaveTextContent("The Bible");
    expect(screen.getByRole("button", { name: "Old Testament" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Testament" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("breadcrumbLinksEveryLevelButTheLast", () => {
    render(wrap());
    expect(crumbs().getByRole("button", { name: "The Bible" })).toBeInTheDocument();
    const here = crumbs().getByText("Genesis");
    expect(here).toHaveAttribute("aria-current", "page");
    expect(here.closest("a,button")).toBeNull();
    fireEvent.click(crumbs().getByRole("button", { name: "Old Testament" }));
    expect(title()).toHaveTextContent("Old Testament");
    expect(crumbs().getByText("Old Testament")).toHaveAttribute("aria-current", "page");
    fireEvent.click(crumbs().getByRole("button", { name: "The Bible" }));
    expect(title()).toHaveTextContent("The Bible");
    expect(crumbs().queryAllByRole("button")).toHaveLength(0);
    expect(crumbs().getByLabelText("The Bible")).toHaveAttribute("aria-current", "page");
  });

  it("bookTileShowsItsChapters", () => {
    render(wrap());
    back();
    fireEvent.click(screen.getByRole("link", { name: "Psalms" }));
    expect(title()).toHaveTextContent("Psalms");
    expect(chapterLinks()).toHaveLength(150);
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "150" })).toHaveAttribute("href", "/en/read/x/psalms/150");
  });

  it("sectionBoxOpensItsTestamentAtThatSection", () => {
    render(wrap());
    back();
    back();
    fireEvent.click(screen.getByRole("button", { name: /Gospels/ }));
    expect(title()).toHaveTextContent("New Testament");
    expect(screen.getByRole("link", { name: "John" })).toBeInTheDocument();
  });

  it("bibleLevelCountsOnlyTheEditionsBooks", () => {
    render(wrap());
    back();
    back();
    expect(screen.getByRole("button", { name: /Wisdom Books/ })).toHaveTextContent("1 book");
    expect(screen.getByRole("button", { name: /Pentateuch/ })).toHaveTextContent("2 books");
    expect(screen.queryByRole("button", { name: /Prophets/ })).toBeNull();
  });

  it("allChaptersLinksTheIndex", () => {
    render(wrap());
    back();
    back();
    expect(screen.getByRole("link", { name: "All chapters" })).toHaveAttribute("href", "/en/read/x");
  });

  it("escClosesWithoutNavigatingAndReopensOnChapters", () => {
    const { rerender } = render(wrap());
    back();
    back();
    fireEvent(screen.getByRole("dialog"), new Event("close"));
    expect(onClose).toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
    rerender(wrap({ open: false }));
    rerender(wrap({ open: true }));
    expect(title()).toHaveTextContent("Genesis");
  });

  it("eachLevelOpensAtItsTop", () => {
    render(wrap());
    back();
    const body = screen.getByRole("dialog").querySelector<HTMLElement>("[data-goto-body]")!;
    body.scrollTop = 500;
    fireEvent.click(screen.getByRole("link", { name: "Psalms" }));
    expect(body.scrollTop).toBe(0);
    body.scrollTop = 400;
    fireEvent.click(crumbs().getByRole("button", { name: "Old Testament" }));
    expect(body.scrollTop).toBe(0);
  });

  it("aSectionOpenedFromTheBibleIsBrieflyHighlighted", () => {
    render(wrap());
    back();
    back();
    fireEvent.click(screen.getByRole("button", { name: /Gospels/ }));
    const gospels = screen.getByRole("heading", { name: "Gospels" }).closest("section")!;
    expect(gospels).toHaveAttribute("data-highlighted", "true");
    expect(screen.getByRole("heading", { name: "Gospels" }).closest("section")).toBeInTheDocument();
  });

  it("focusMovesToTheTitleOnEachLevelChange", () => {
    render(wrap());
    back();
    expect(document.activeElement).toBe(title());
    back();
    expect(document.activeElement).toBe(title());
  });

  it("clickingTheBackdropCloses", () => {
    render(wrap());
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(title());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // The stylesheet's order decides between two classes for the same property: the plain tile's colours must not be
  // on the current one, or they win and its number turns white on white.
  it("theCurrentChapterBookAndSectionCarryOnlyTheSelectedColours", () => {
    const plainColours = ["bg-slate-50", "text-slate-900", "border-slate-200", "dark:bg-slate-900", "dark:text-slate-100", "dark:border-slate-800"];
    render(wrap());
    const three = screen.getByRole("link", { name: "3" });
    expect(three).toHaveClass("bg-red-700", "text-white");
    for (const c of plainColours) expect(three).not.toHaveClass(c);
    expect(screen.getByRole("link", { name: "4" })).toHaveClass("bg-slate-50", "text-slate-900");
    back();
    const genesis = screen.getByRole("link", { name: "Genesis" });
    expect(genesis).toHaveClass("bg-red-700", "text-white");
    for (const c of plainColours) expect(genesis).not.toHaveClass(c);
    back();
    const pentateuch = screen.getByRole("button", { name: /Pentateuch/ });
    expect(pentateuch).toHaveClass("border-red-700");
    expect(pentateuch).not.toHaveClass("border-slate-200");
  });
});
