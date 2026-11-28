import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { MentionLayer } from "@/components/MentionLayer";
import { MentionCard } from "@/components/MentionCard";
import { toMentionEntity } from "@/lib/mentions";
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
        <MentionLayer marks={marks} entities={entities} locale="en" back="/en/read/nvbse/acts/1?with=NABRE" />
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

  it("titlesTheUncertainMarkAsAnUncertainIdentification", () => {
    // "Uncertain" is CBPPEDR's doubt about who is meant, not the review of the mention.
    const { review } = setup();
    fireEvent.click(review);
    expect(within(screen.getByRole("dialog")).getByText("uncertain")).toHaveAttribute("title", "The identification is uncertain");
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
    expect(screen.getByRole("link", { name: "All 12 verses in the index" })).toHaveAttribute(
      "href",
      `/en/read/nvbse/persons?letter=P&back=${encodeURIComponent("/en/read/nvbse/acts/1?with=NABRE")}#bpers:petrus`,
    );
  });

  it("showsAPublicDomainImageWithoutAuthorOrLicenceLink", () => {
    // CBPPEDR's details: license_url and author are optional (a public-domain image has neither).
    const e = toMentionEntity({
      type: "person", kind: "individual", names: { la: "Moyses" }, description: {}, verse_count: 0,
      image: { file: "Moses.jpg", license: "Public domain" },
    }, "bpers:moyses")!;
    expect(e.image).toEqual({ file: "Moses.jpg", license: "Public domain" });
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <MentionCard mark={{ entry: "bpers:moyses", ...nv }} entities={{ "bpers:moyses": e }} locale="en" />
      </NextIntlClientProvider>,
    );
    expect(document.querySelector("img")).toHaveAttribute("src", "https://commons.wikimedia.org/wiki/Special:FilePath/Moses.jpg?width=160");
    expect(screen.getByText("Public domain")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Public domain" })).toBeNull();
    expect(screen.queryByText(/^Image:/)).toBeNull();
  });

  it("syntheticClickFocusesTheCard", () => {
    // A screen reader's activation is a click with no pointer (detail 0): it opens the card as the keyboard does.
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    try {
      const { first } = setup();
      fireEvent.click(first, { detail: 0 });
      const card = screen.getByRole("dialog", { name: "Petrus" });
      expect(document.activeElement).toBe(card);
      expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
      fireEvent.keyDown(card, { key: "Escape" });
      expect(document.activeElement).toBe(first);
      expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    } finally {
      focus.mockRestore();
    }
  });

  it("aMouseClickLeavesTheFocus", () => {
    const { first } = setup();
    fireEvent.click(first, { detail: 1 });
    expect(screen.getByRole("dialog", { name: "Petrus" }).contains(document.activeElement)).toBe(false);
  });

  it("setsAriaExpandedOnTheOpenMark", () => {
    const { first, second, review, plain } = setup();
    fireEvent.click(second, { detail: 1 });
    const card = screen.getByRole("dialog", { name: "Petrus" });
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(card.id).not.toBe("");
    expect(first).toHaveAttribute("aria-controls", card.id);
    expect(second).not.toHaveAttribute("aria-expanded");
    expect(review).not.toHaveAttribute("aria-expanded");
    fireEvent.pointerDown(plain);
    expect(dialog()).toBeNull();
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(first).not.toHaveAttribute("aria-controls");
  });

  it("aTouchPinsTheCard", () => {
    const { first, plain } = setup();
    const touch = { pointerType: "touch" };
    fireEvent.pointerOver(first, touch);
    fireEvent.pointerDown(first, touch);
    fireEvent.click(first, { detail: 1 });
    expect(screen.getByRole("dialog", { name: "Petrus" })).toBeInTheDocument();
    fireEvent.pointerOut(first, { ...touch, relatedTarget: plain });
    wait(1000);
    expect(dialog()).not.toBeNull();
    fireEvent.click(first, { detail: 1 });
    expect(dialog()).toBeNull();
  });
});
