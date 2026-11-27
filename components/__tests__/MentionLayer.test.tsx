import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { MentionLayer } from "@/components/MentionLayer";
import type { MentionEntity } from "@/lib/types";

const person = (id: string, la: string, extra: Partial<MentionEntity> = {}): MentionEntity => ({
  id, type: "person", kind: "individual", names: { la }, description: { en: `About ${la}` }, uncertain: false, verseCount: 3, ...extra,
});
const entities: Record<string, MentionEntity> = {
  "bpers:petrus": person("bpers:petrus", "Petrus", {
    names: { la: "Petrus", en: "Peter" },
    verseCount: 12,
    image: { file: "Saint Peter.jpg", author: "A Painter", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0" },
    wikipedia: { en: "Saint Peter", it: "San Pietro" },
  }),
  "bpers:simon-1": person("bpers:simon-1", "Simon", { description: { en: "A tanner" } }),
  "bpers:simon-2": person("bpers:simon-2", "Simon", { description: { en: "A sorcerer" }, uncertain: true }),
};
const nv = { sigla: "NVBSE", lang: "la" };
const marks = { "1.1|0": { entry: "bpers:petrus", ...nv }, "1.2|0": { candidates: ["bpers:simon-1", "bpers:simon-2"], ...nv } };

function setup() {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <main data-annotations="on">
        <p>
          <span className="bg-mention" data-mention="1.1|0" data-mention-first="" tabIndex={0} role="button">Pe</span>
          <i><span className="bg-mention" data-mention="1.1|0">trus</span></i> ait.{" "}
          <span className="bg-mention" data-mention="1.2|0" data-review="" data-mention-first="" tabIndex={0} role="button">Simon</span>
          <sup className="bg-mention-review">?</sup> <span data-testid="plain">et alii</span>
        </p>
        <MentionLayer marks={marks} entities={entities} locale="en" />
      </main>
    </NextIntlClientProvider>,
  );
  const [first, second] = document.querySelectorAll<HTMLElement>('[data-mention="1.1|0"]');
  const review = document.querySelector<HTMLElement>('[data-mention="1.2|0"]')!;
  return { first, second, review, plain: screen.getByTestId("plain") };
}
const dialog = () => screen.queryByRole("dialog");
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const mouse = { pointerType: "mouse" };

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.setItem("reader.annotations", "1");
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("mention cards", () => {
  it("opensAfter300msOfHover", () => {
    const { first } = setup();
    fireEvent.pointerOver(first, mouse);
    wait(299);
    expect(dialog()).toBeNull();
    wait(1);
    expect(screen.getByRole("dialog", { name: "Petrus" })).toBeInTheDocument();
  });

  it("closes200msAfterLeaving", () => {
    const { first, plain } = setup();
    fireEvent.pointerOver(first, mouse);
    wait(300);
    fireEvent.pointerOut(first, { ...mouse, relatedTarget: plain });
    wait(199);
    expect(dialog()).not.toBeNull();
    wait(1);
    expect(dialog()).toBeNull();
  });

  it("keepsOpenFromOnePieceToTheNext", () => {
    const { first, second } = setup();
    fireEvent.pointerOver(first, mouse);
    wait(300);
    fireEvent.pointerOut(first, { ...mouse, relatedTarget: second });
    fireEvent.pointerOver(second, { ...mouse, relatedTarget: first });
    wait(1000);
    expect(screen.getByRole("dialog", { name: "Petrus" })).toBeInTheDocument();
  });

  it("staysOpenWhileTheCardIsHovered", () => {
    const { first } = setup();
    fireEvent.pointerOver(first, mouse);
    wait(300);
    const card = dialog()!;
    fireEvent.pointerOut(first, { ...mouse, relatedTarget: card });
    wait(1000);
    expect(dialog()).not.toBeNull();
    fireEvent.pointerLeave(card, { ...mouse, relatedTarget: document.body });
    wait(200);
    expect(dialog()).toBeNull();
  });

  it("tapPinsAndSecondTapUnpins", () => {
    const { first, second, plain } = setup();
    fireEvent.click(second);
    expect(screen.getByRole("dialog", { name: "Petrus" })).toBeInTheDocument();
    fireEvent.pointerOut(second, { ...mouse, relatedTarget: plain });
    wait(1000);
    expect(dialog()).not.toBeNull();
    fireEvent.click(first);
    expect(dialog()).toBeNull();
  });

  it("closesOnAPointerDownOutside", () => {
    const { first, plain } = setup();
    fireEvent.click(first);
    fireEvent.pointerDown(within(dialog()!).getByText("About Petrus"));
    expect(dialog()).not.toBeNull();
    fireEvent.pointerDown(plain);
    expect(dialog()).toBeNull();
  });

  it("escapeClosesAndReturnsFocus", () => {
    const { first } = setup();
    first.focus();
    fireEvent.keyDown(first, { key: "Enter" });
    const card = screen.getByRole("dialog", { name: "Petrus" });
    expect(card.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(first);
  });

  it("doesNothingWhenSwitchedOff", () => {
    localStorage.setItem("reader.annotations", "0");
    const { first } = setup();
    fireEvent.pointerOver(first, mouse);
    wait(1000);
    fireEvent.click(first);
    first.focus();
    fireEvent.keyDown(first, { key: "Enter" });
    expect(dialog()).toBeNull();
  });

  it("showsTheReviewLineAndEachCandidate", () => {
    const { review } = setup();
    fireEvent.click(review);
    const card = screen.getByRole("dialog");
    expect(within(card).getByText("This identification is still under review")).toBeInTheDocument();
    expect(within(card).getByText("A tanner")).toBeInTheDocument();
    expect(within(card).getByText("A sorcerer")).toBeInTheDocument();
    expect(within(card).getAllByText("Simon")).toHaveLength(2);
    expect(within(card).getByText("uncertain")).toBeInTheDocument();
  });

  it("showsNoImageOrWikipediaWithoutDetails", () => {
    const { review } = setup();
    fireEvent.click(review);
    const card = screen.getByRole("dialog");
    expect(card.querySelector("img")).toBeNull();
    expect(within(card).queryByRole("link", { name: "Wikipedia" })).toBeNull();
  });

  it("showsTheImageCreditAndWikipediaWithDetails", () => {
    const { first } = setup();
    fireEvent.click(first);
    const card = screen.getByRole("dialog", { name: "Petrus" });
    expect(within(card).getByText("(Peter)")).toBeInTheDocument();
    const img = card.querySelector("img")!;
    expect(img).toHaveAttribute("src", "https://commons.wikimedia.org/wiki/Special:FilePath/Saint_Peter.jpg?width=160");
    expect(img.closest("a")).toHaveAttribute("href", "https://commons.wikimedia.org/wiki/File:Saint_Peter.jpg");
    expect(within(card).getByText("Image: A Painter")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "CC BY-SA 4.0" })).toHaveAttribute("href", "https://creativecommons.org/licenses/by-sa/4.0");
    expect(within(card).getByRole("link", { name: "Wikipedia" })).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Saint_Peter");
  });

  it("linksToTheIndexEntryWithItsLetter", () => {
    const { first } = setup();
    fireEvent.click(first);
    expect(screen.getByRole("link", { name: "All 12 verses in the index" })).toHaveAttribute("href", "/en/read/nvbse/persons?letter=P#bpers:petrus");
  });
});
