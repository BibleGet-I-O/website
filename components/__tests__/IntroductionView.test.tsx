import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { IntroductionView } from "@/components/IntroductionView";
import type { Introduction } from "@/lib/types";

const intro: Introduction = {
  id: "1", title: "THE BOOK OF GENESIS", books: [1],
  blocks: [
    { type: "paragraph", text: "Genesis is the <i>first</i> book.", refs: [] },
    { type: "heading", level: 1, text: "Outline of Genesis", refs: [] },
    { type: "item", level: 1, text: "I. The Nations", refs: [] },
    { type: "item", level: 2, text: "A. Creation", refs: [] },
    { type: "paragraph", text: "After the list.", refs: [] },
    { type: "row", cells: [{ text: "Vulg.", refs: [] }, { text: "Greek", refs: [] }] },
    { type: "row", cells: [{ text: "11:2", refs: [] }, { text: "A:1", refs: [] }] },
  ],
};
const show = (p: Partial<Parameters<typeof IntroductionView>[0]> = {}) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <IntroductionView heading="Introduction to Genesis" intro={intro} lang="en" general={[{ title: "THE PENTATEUCH", href: "/en/read/nabre/genesis/introduction?part=pentateuch" }]} {...p} />
    </NextIntlClientProvider>,
  );

describe("IntroductionView", () => {
  it("printsTheTitleAndTheBlocksInOrder", () => {
    show();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Introduction to Genesis");
    expect(screen.getByText("THE BOOK OF GENESIS")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Outline of Genesis" })).toBeInTheDocument();
    expect(screen.getByText("first").tagName).toBe("I");
  });

  it("groupsOutlineItemsIntoAListIndentedByLevel", () => {
    show();
    const items = within(screen.getByRole("list", { name: "Outline of Genesis" })).getAllByRole("listitem");
    expect(items.map((li) => [li.textContent, li.getAttribute("data-level")])).toEqual([["I. The Nations", "1"], ["A. Creation", "2"]]);
  });

  it("groupsRowsIntoATable", () => {
    show();
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows.map((r) => r.textContent)).toEqual(["Vulg.Greek", "11:2A:1"]);
  });

  it("endsWithTheGeneralIntroductionsThatCoverTheBook", () => {
    show();
    const nav = screen.getByRole("navigation", { name: "General introductions" });
    expect(within(nav).getByRole("link", { name: "THE PENTATEUCH" })).toHaveAttribute("href", "/en/read/nabre/genesis/introduction?part=pentateuch");
  });

  it("aGeneralIntroductionsTitleIsItsHeadingOnce", () => {
    show({ heading: "THE BOOK OF GENESIS" });
    expect(screen.getAllByText("THE BOOK OF GENESIS")).toHaveLength(1);
  });

  it("noGeneralListWithoutAny", () => {
    show({ general: [] });
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
