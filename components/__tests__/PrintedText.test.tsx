import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import it_ from "@/messages/it.json";
import { PrintedText } from "@/components/PrintedText";
import type { PrintedPiece } from "@/lib/types";

const start = (chapter: number, verse: number) => ({ book: 1, chapter, verse, segment: null, printedChapter: null });
// Spans count code points of the text as stored, tags included: "Gn 25:19" is 14-22, "35:43" 23-28.
const piece: PrintedPiece = {
  text: "<b>Jacob.</b> Gn 25:19–35:43 tell of <i>him</i>.",
  refs: [{ start: start(25, 19), end: null, span: [14, 22], href: "/en/read/nabre/genesis/25#v25.19" }],
  sic: [{ span: [23, 28], intended: "36:43", ref: { start: start(36, 43), end: null, href: "/en/read/nabre/genesis/36#v36.43" } }],
};
const show = (p: PrintedPiece, messages: typeof en = en, locale: "en" | "it" = "en") =>
  render(<NextIntlClientProvider locale={locale} messages={messages}><p data-testid="p"><PrintedText {...p} /></p></NextIntlClientProvider>);

describe("PrintedText", () => {
  it("keepsTheTextAsPrintedWithItsFormattingAndLinks", () => {
    show({ ...piece, sic: undefined });
    expect(screen.getByTestId("p").textContent).toBe("Jacob. Gn 25:19–35:43 tell of him.");
    expect(screen.getByText("Jacob.").tagName).toBe("B");
    expect(screen.getByRole("link", { name: "Gn 25:19" })).toHaveAttribute("href", "/en/read/nabre/genesis/25#v25.19");
  });

  it("notesAMisprintAfterThePrintedWordsInRubricRed", () => {
    show(piece);
    expect(screen.getByTestId("p").textContent).toBe("Jacob. Gn 25:19–35:43 [sic! expected: 36:43] tell of him.");
    const note = screen.getByText((_, el) => el?.classList.contains("bg-sic") ?? false);
    expect(note.textContent).toBe("[sic! expected: 36:43]");
    expect(note.querySelector("i")?.textContent).toBe("sic!");
    expect(screen.getByRole("link", { name: "36:43" })).toHaveAttribute("href", "/en/read/nabre/genesis/36#v36.43");
  });

  it("aMisprintWithoutAPassageIsNotALink", () => {
    show({ text: "Teh end.", refs: [], sic: [{ span: [0, 3], intended: "The", ref: null }] });
    expect(screen.getByTestId("p").textContent).toBe("Teh [sic! expected: The] end.");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("speaksTheReadersLanguage", () => {
    show(piece, it_ as typeof en, "it");
    expect(screen.getByTestId("p").textContent).toContain("[sic! leggi: 36:43]");
  });
});
