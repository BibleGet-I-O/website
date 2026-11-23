import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { ChapterNotes } from "@/components/ChapterNotes";
import { NOTE_EVENT } from "@/components/NoteMarker";
import type { Note } from "@/lib/types";

const wrap = (ui: React.ReactNode) => <NextIntlClientProvider locale="en" messages={en}>{ui}</NextIntlClientProvider>;
const note = (n: number, extra: Partial<Note> = {}): Note => ({
  id: `NABRE:0100100${n}-1`, edition: "NABRE", kind: "footnote", marker: "*", label: `1:${n}`, title: null, body: `Note ${n}.`, refs: [], ...extra,
});
const group = (notes: Note[], name = "New American Bible") => ({ edition: "NABRE", name, notes: notes.map((n) => ({ note: n, first: `m-${n.id}` })) });

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("ChapterNotes", () => {
  it("listsEachNoteWithALinkBackToItsMarker", () => {
    render(wrap(<ChapterNotes groups={[group([note(1), note(2, { marker: null, title: "The creation" })])]} />));
    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("id", "note-NABRE-01001001-1");
    expect(screen.getByRole("link", { name: "Back to the text: *" })).toHaveAttribute("href", "#m-NABRE:01001001-1");
    // No printed marker: the note is introduced by its verse.
    expect(screen.getByRole("link", { name: "Back to the text: 1:2" })).toBeInTheDocument();
    expect(items[1]).toHaveTextContent("The creation");
    expect(screen.getByText("12 notes".replace("12", "2"))).toBeInTheDocument();
  });

  it("citationsInTheBodyAreLinks", () => {
    const n = note(1, { body: "See <i>Jn</i> 1:3.", refs: [{ start: { book: 50, chapter: 1, verse: 3, segment: null, printedChapter: null }, end: null, span: [4, 17], href: "/en/read/nabre/john/1#v1.3" }] });
    render(wrap(<ChapterNotes groups={[group([n])]} />));
    // jsdom's accessible name drops the space between inline spans: the text is read from the DOM instead.
    const link = screen.getAllByRole("link").find((a) => a.textContent === "Jn 1:3")!;
    expect(link).toHaveAttribute("href", "/en/read/nabre/john/1#v1.3");
    expect(link.querySelector("i")).toHaveTextContent("Jn");
  });

  it("groupsByEditionWhenComparing", () => {
    render(wrap(<ChapterNotes groups={[group([note(1)]), { ...group([note(3)], "Bibbia CEI"), edition: "CEI2008" }]} />));
    expect(screen.getByRole("heading", { name: "New American Bible" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bibbia CEI" })).toBeInTheDocument();
  });

  it("nothingWithoutNotes", () => {
    const { container } = render(wrap(<ChapterNotes groups={[group([])]} />));
    expect(container).toBeEmptyDOMElement();
  });

  it("aMarkerTapScrollsThePanelAndHighlightsTheNote", () => {
    vi.useFakeTimers();
    render(wrap(<ChapterNotes groups={[group([note(1), note(2)])]} />));
    const target = document.getElementById("note-NABRE-01001002-1")!;
    act(() => {
      window.dispatchEvent(new CustomEvent(NOTE_EVENT, { detail: "NABRE:01001002-1" }));
    });
    expect(target).toHaveAttribute("data-highlight", "true");
    act(() => vi.advanceTimersByTime(2500));
    expect(target).not.toHaveAttribute("data-highlight");
  });

  it("theHandleCyclesTheSizeAndRemembersIt", () => {
    render(wrap(<ChapterNotes groups={[group([note(1)])]} />));
    const panel = document.querySelector("[data-notes-panel]")!;
    expect(panel).toHaveAttribute("data-size", "quarter");
    const handle = screen.getByRole("button", { name: /Resize the notes/ });
    fireEvent.click(handle);
    expect(panel).toHaveAttribute("data-size", "half");
    fireEvent.click(handle);
    expect(panel).toHaveAttribute("data-size", "bar");
    expect(localStorage.getItem("bibleget.notesPanel")).toBe("bar");
  });

  it("opensAtTheRememberedSize", () => {
    localStorage.setItem("bibleget.notesPanel", "half");
    render(wrap(<ChapterNotes groups={[group([note(1)])]} />));
    expect(document.querySelector("[data-notes-panel]")).toHaveAttribute("data-size", "half");
  });

  it("aTapOnTheBarOpensThePanelToShowTheNote", () => {
    localStorage.setItem("bibleget.notesPanel", "bar");
    render(wrap(<ChapterNotes groups={[group([note(1)])]} />));
    act(() => {
      window.dispatchEvent(new CustomEvent(NOTE_EVENT, { detail: "NABRE:01001001-1" }));
    });
    expect(document.querySelector("[data-notes-panel]")).toHaveAttribute("data-size", "quarter");
  });
});
