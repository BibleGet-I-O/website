import { describe, it, expect } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { StickyHead } from "@/components/StickyHead";

/** A heading whose top is at `top` (px from the viewport's top). */
function heading(col: number, text: string, top: number, groupLast?: string) {
  const h = document.createElement("h2");
  h.dataset.headCol = String(col);
  if (groupLast) h.dataset.headText = groupLast;
  h.textContent = text;
  h.getBoundingClientRect = () => ({ top, bottom: top + 20, left: 0, right: 0, width: 0, height: 20, x: 0, y: top, toJSON() {} });
  return h;
}

it("showsToolsOnTheTitlesLine", () => {
  render(<StickyHead title="Genesis 4" columns={[]} gridClass="" running={1} tools={<button type="button">Index</button>} />);
  expect(screen.getByRole("button", { name: "Index" }).closest("[data-title-line]")).toContainElement(screen.getByRole("heading", { level: 1 }));
});

function page(columns: string[], running: number, headings: [number, string, number, string?][]) {
  const r = render(
    <article>
      <StickyHead title="Genesis 4" columns={columns.map((name) => ({ key: name, label: name }))} gridClass="grid grid-cols-2" running={running} />
      <div id="body" />
    </article>,
  );
  const head = r.container.querySelector("[data-sticky-head]") as HTMLElement;
  head.getBoundingClientRect = () => ({ top: 0, bottom: 100, left: 0, right: 0, width: 0, height: 100, x: 0, y: 0, toJSON() {} });
  const body = r.container.querySelector("#body")!;
  for (const [c, t, top, last] of headings) body.appendChild(heading(c, t, top, last));
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
  return { ...r, head };
}

const running = (head: HTMLElement) => Array.from(head.querySelectorAll("[data-running]")).map((e) => e.textContent);

describe("StickyHead", () => {
  it("keepsTheTitleAndTheEditionsAtTheTop", () => {
    const { head } = page(["New American Bible", "Libro del Pueblo de Dios"], 2, []);
    expect(head).toHaveClass("sticky", "top-0");
    expect(screen.getByRole("heading", { level: 1, name: "Genesis 4" })).toBeInTheDocument();
    expect(screen.getAllByTestId("column-name").map((e) => e.textContent)).toEqual(["New American Bible", "Libro del Pueblo de Dios"]);
  });

  it("namesNoEditionWhenReadingOne", () => {
    page([], 1, []);
    expect(screen.queryByTestId("column-name")).toBeNull();
  });

  it("showsEachColumnsLastHeadingScrolledPast", () => {
    const { head } = page(["A", "B"], 2, [
      [0, "Cain and Abel", -400], [1, "Desde Adán hasta el Diluvio", -420], [1, "Caín y Abel", -380],
      [0, "Descendants of Cain", 600], [1, "Descendencia de Caín", 620],
    ]);
    expect(running(head)).toEqual(["Cain and Abel", "Caín y Abel"]);
  });

  it("showsNothingBeforeTheFirstHeadingIsPassed", () => {
    const { head } = page([], 1, [[0, "The Creation", 300]]);
    expect(running(head).filter(Boolean)).toEqual([]);
  });

  it("aGroupOfHeadingsShowsItsLastOnceItsFirstIsPassed", () => {
    const { head } = page([], 1, [[0, "The Creation", 80, "The First Account"], [0, "The First Account", 130, "The First Account"]]);
    expect(running(head)).toEqual(["The First Account"]);
  });

  it("aHeadingJustUnderTheStripCountsAsPassed", () => {
    const { head } = page([], 1, [[0, "The Flood", 90]]);
    expect(running(head)).toEqual(["The Flood"]);
  });
});
