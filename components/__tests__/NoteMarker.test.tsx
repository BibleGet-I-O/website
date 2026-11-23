import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { NoteMarker, NOTE_EVENT } from "@/components/NoteMarker";
import type { Note } from "@/lib/types";

const wrap = (ui: React.ReactNode) => <NextIntlClientProvider locale="en" messages={en}>{ui}</NextIntlClientProvider>;
const foot: Note = { id: "NABRE:01001001-1", edition: "NABRE", kind: "footnote", marker: "*", label: "1:1", title: null, body: "x", refs: [] };
const cross: Note = {
  id: "NABRE:01001001-2", edition: "NABRE", kind: "crossref", marker: "a", label: "1:1", title: null, body: "Jn 1:1-3; Ps 33:6.",
  refs: [
    { start: { book: 50, chapter: 1, verse: 1, segment: null, printedChapter: null }, end: { book: 50, chapter: 1, verse: 3 }, span: [0, 8], href: "/en/read/nabre/john/1#v1.1" },
    { start: { book: 23, chapter: 33, verse: 6, segment: null, printedChapter: null }, end: null, span: [10, 17] },
  ],
};
const mobile = (on: boolean) => vi.stubGlobal("matchMedia", (q: string) => ({ matches: on && q.includes("max-width"), media: q, addEventListener() {}, removeEventListener() {} }));

describe("NoteMarker", () => {
  it("aFootnoteLinksToItsNote", () => {
    mobile(false);
    render(wrap(<NoteMarker note={foot} id="m-1" />));
    const a = screen.getByRole("link", { name: "Footnote *" });
    expect(a).toHaveAttribute("href", "#note-NABRE-01001001-1");
    expect(a).toHaveAttribute("id", "m-1");
    expect(a).toHaveClass("bg-note", "bg-note-foot");
    expect(fireEvent.click(a)).toBe(true);
  });

  it("onMobileItScrollsThePanelNotThePage", () => {
    mobile(true);
    const panel = document.createElement("div");
    panel.setAttribute("data-notes-panel", "");
    document.body.append(panel);
    const heard = vi.fn();
    window.addEventListener(NOTE_EVENT, (e) => heard((e as CustomEvent<string>).detail));
    render(wrap(<NoteMarker note={foot} id="m-1" />));
    expect(fireEvent.click(screen.getByRole("link", { name: "Footnote *" }))).toBe(false);
    expect(heard).toHaveBeenCalledWith("NABRE:01001001-1");
    panel.remove();
  });

  it("aCrossReferenceOpensItsPassages", () => {
    render(wrap(<NoteMarker note={cross} id="m-2" />));
    const button = screen.getByRole("button", { name: "Cross-references a" });
    expect(button).toHaveClass("bg-note", "bg-note-cross");
    const pop = document.getElementById(button.getAttribute("popovertarget")!)!;
    expect(pop).toHaveAttribute("popover", "auto");
    const link = screen.getByRole("link", { name: "Jn 1:1-3", hidden: true });
    expect(link).toHaveAttribute("href", "/en/read/nabre/john/1#v1.1");
    // A passage the edition cannot link to is still listed.
    expect(pop).toHaveTextContent("Ps 33:6");
  });

  it("aWholeVerseCrossReferenceOpensItsPassagesFromTheNumber", () => {
    render(wrap(<NoteMarker note={cross} id="m-4">7</NoteMarker>));
    const button = screen.getByRole("button", { name: "Cross-references on verse 7" });
    expect(button).toHaveClass("bg-note-num");
    expect(button).toHaveTextContent("7");
    expect(document.getElementById(button.getAttribute("popovertarget")!)).toHaveAttribute("popover", "auto");
  });

  it("aPassageInAnotherEditionShowsABookAndItsName", () => {
    const nv = { ...cross, refs: [{ ...cross.refs[0], href: "/it/read/nvbse/ecclesiasticus/24#v24.1b", edition: "NVBSE", editionName: "Nova Vulgata" }] };
    render(wrap(<NoteMarker note={nv} id="m-5" />));
    const link = screen.getByRole("link", { name: /^Jn 1:1-3 ?\(in Nova Vulgata\)$/, hidden: true });
    expect(link.querySelector("svg.bg-other-edition")).not.toBeNull();
    expect(link).toHaveAttribute("title", "In Nova Vulgata");
  });

  it("aWholeVerseNoteWrapsTheVerseNumber", () => {
    render(wrap(<NoteMarker note={{ ...foot, marker: null }} id="m-3">12</NoteMarker>));
    const a = screen.getByRole("link", { name: "Note on verse 12" });
    expect(a).toHaveClass("bg-note-num");
    expect(a).toHaveTextContent("12");
  });
});
