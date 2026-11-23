import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { SearchForm, SearchLens, SearchPanel, SearchPanelProvider } from "@/components/SearchForm";

const wrap = (ui: React.ReactNode) => <NextIntlClientProvider locale="en" messages={en}>{ui}</NextIntlClientProvider>;
const props = { locale: "en", edition: "NABRE", editionName: "New American Bible", from: "/en/read/nabre/john/3" };

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ suggestions: ["light", "lights"] }), { headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const typeAndWait = async (input: HTMLElement, value: string) => {
  fireEvent.change(input, { target: { value } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
};

// The lens sits in a row; the panel it opens follows the row, at its full width.
const lensRow = () =>
  wrap(
    <SearchPanelProvider {...props}>
      <div role="toolbar" aria-label="Reader">
        <SearchLens />
      </div>
      <SearchPanel />
    </SearchPanelProvider>,
  );

describe("SearchLens", () => {
  it("theLensOpensAPanelBelowItsRowAndFocusesTheField", () => {
    render(lensRow());
    const lens = screen.getByRole("button", { name: "Search" });
    expect(lens).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("search")).toBeNull();
    fireEvent.click(lens);
    expect(lens).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(lens.getAttribute("aria-controls")!)!;
    const toolbar = screen.getByRole("toolbar");
    expect(toolbar.contains(panel)).toBe(false);
    expect(toolbar.nextElementSibling).toBe(panel);
    expect(panel.querySelector("form[role=search]")).not.toBeNull();
    expect(screen.getByRole("combobox", { name: "Words to find" })).toHaveFocus();
  });

  it("aTapOutsideLeavesThePanelOpen", () => {
    render(lensRow());
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.pointerDown(document.body);
    expect(screen.getByRole("search")).toBeInTheDocument();
  });

  it("theCloseButtonAndEscapeCloseThePanel", () => {
    render(lensRow());
    const lens = screen.getByRole("button", { name: "Search" });
    fireEvent.click(lens);
    fireEvent.click(screen.getByRole("button", { name: "Close search" }));
    expect(screen.queryByRole("search")).toBeNull();
    expect(lens).toHaveFocus();
    fireEvent.click(lens);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("search")).toBeNull();
    expect(lens).toHaveFocus();
  });

  it("theLensClosesWhatItOpened", () => {
    render(lensRow());
    const lens = screen.getByRole("button", { name: "Search" });
    fireEvent.click(lens);
    fireEvent.click(lens);
    expect(screen.queryByRole("search")).toBeNull();
  });
});

describe("SearchLens without JavaScript", () => {
  it("isALinkToTheSearchPageUntilTheScriptRuns", () => {
    const html = renderToString(lensRow());
    expect(html).toContain('href="/en/read/nabre/search?from=%2Fen%2Fread%2Fnabre%2Fjohn%2F3"');
    expect(html).toContain('aria-label="Search"');
    expect(html).not.toContain("<button");
  });
});

describe("SearchForm", () => {
  it("submitsAPlainGetWithoutJavaScript", () => {
    const { container } = render(wrap(<SearchForm {...props} />));
    const form = container.querySelector("form")!;
    expect(form).toHaveAttribute("action", "/en/read/nabre/search");
    expect(form).toHaveAttribute("method", "get");
    expect(container.querySelector("input[name=q]")).not.toBeNull();
    expect(container.querySelector("input[name=from]")).toHaveAttribute("value", "/en/read/nabre/john/3");
    expect(Array.from(container.querySelectorAll("input[name=mode]")).map((i) => i.getAttribute("value"))).toEqual(["keyword", "semantic", "reference"]);
  });

  it("theFormNamesTheEditionSearched", () => {
    render(wrap(<SearchForm {...props} />));
    expect(screen.getByText("Searching New American Bible")).toBeInTheDocument();
  });

  it("keywordModeOffersSuggestionsForTheLastWord", async () => {
    render(wrap(<SearchForm {...props} />));
    const input = screen.getByRole("combobox", { name: "Words to find" });
    await typeAndWait(input, "the lig");
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/search/suggest?edition=NABRE&prefix=lig");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["light", "lights"]);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[0].id);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("the light");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("arrowsWrapThroughTheSuggestionsAndBackToTheInput", async () => {
    render(wrap(<SearchForm {...props} />));
    const input = screen.getByRole("combobox", { name: "Words to find" });
    await typeAndWait(input, "lig");
    const [first, second] = screen.getAllByRole("option");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveAttribute("aria-activedescendant", second.id);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).not.toHaveAttribute("aria-activedescendant");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", first.id);
  });

  it("anInputMethodsKeysAreLeftToIt", async () => {
    render(wrap(<SearchForm {...props} />));
    const input = screen.getByRole("combobox", { name: "Words to find" });
    await typeAndWait(input, "lig");
    fireEvent.keyDown(input, { key: "ArrowDown", isComposing: true });
    expect(input).not.toHaveAttribute("aria-activedescendant");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(input).toHaveValue("lig");
  });

  it("aClickPicksASuggestion", async () => {
    render(wrap(<SearchForm {...props} />));
    const input = screen.getByRole("combobox", { name: "Words to find" });
    await typeAndWait(input, "lig");
    fireEvent.mouseDown(screen.getByRole("option", { name: "lights" }));
    expect(input).toHaveValue("lights");
  });

  it("escapeClosesTheSuggestions", async () => {
    render(wrap(<SearchForm {...props} />));
    const input = screen.getByRole("combobox", { name: "Words to find" });
    await typeAndWait(input, "lig");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("noSuggestionsBelowTwoLetters", async () => {
    render(wrap(<SearchForm {...props} />));
    await typeAndWait(screen.getByRole("combobox", { name: "Words to find" }), "l");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exactWordsSetsMatchExact", () => {
    const { container } = render(wrap(<SearchForm {...props} />));
    const exact = screen.getByRole("checkbox", { name: "Exact phrase" });
    expect(exact).toHaveAttribute("name", "match");
    expect(exact).toHaveAttribute("value", "exact");
    expect(container.querySelector("input[name=match]")).toBe(exact);
  });

  it("semanticModeIsATextAreaEnterSubmitsShiftEnterNewLine", () => {
    const { container } = render(wrap(<SearchForm {...props} />));
    fireEvent.click(screen.getByRole("radio", { name: "Meaning" }));
    const area = screen.getByRole("textbox", { name: "Theme or idea" });
    expect(area.tagName).toBe("TEXTAREA");
    expect(area).toHaveAttribute("maxLength", "500");
    expect(screen.queryByRole("checkbox", { name: "Exact phrase" })).toBeNull();
    const form = container.querySelector("form")!;
    const submit = vi.fn((e: Event) => e.preventDefault());
    form.addEventListener("submit", submit);
    form.requestSubmit = () => form.dispatchEvent(new Event("submit", { cancelable: true }));
    fireEvent.keyDown(area, { key: "Enter", shiftKey: true });
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(area, { target: { value: "God forgives" } });
    // Enter confirming an input method's candidate (Chinese, Japanese) is not a search.
    fireEvent.keyDown(area, { key: "Enter", isComposing: true });
    expect(submit).not.toHaveBeenCalled();
    fireEvent.keyDown(area, { key: "Enter" });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("aSearchShownSuggestsNothingUntilTheReaderTypes", async () => {
    render(wrap(<SearchForm {...props} initial={{ mode: "keyword", q: "light", exact: true }} />));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: "Exact phrase" })).toBeChecked();
    await typeAndWait(screen.getByRole("combobox", { name: "Words to find" }), "light lig");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("eachModeShowsItsPlaceholder", () => {
    render(wrap(<SearchForm {...props} />));
    expect(screen.getByRole("combobox", { name: "Words to find" })).toHaveAttribute("placeholder", "Words in the verse, e.g. shepherd");
    fireEvent.click(screen.getByRole("radio", { name: "Meaning" }));
    expect(screen.getByRole("textbox", { name: "Theme or idea" })).toHaveAttribute("placeholder", "A theme or idea, e.g. trust in God");
  });

  it("theReferenceFieldIsOneLineWithoutSuggestionsOrExactWords", async () => {
    render(wrap(<SearchForm {...props} />));
    fireEvent.click(screen.getByRole("radio", { name: "Reference" }));
    const field = screen.getByRole("textbox", { name: "Bible reference" });
    expect(field.tagName).toBe("INPUT");
    expect(field).toHaveAttribute("name", "q");
    expect(field).toHaveAttribute("placeholder", "Jonah 1:1-2:2; 3:2");
    expect(screen.queryByRole("checkbox", { name: "Exact phrase" })).toBeNull();
    await typeAndWait(field, "Jo");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("labelsTheModesByWhatTheyAreFor", () => {
    render(wrap(<SearchForm {...props} />));
    expect(screen.getAllByRole("radio").map((r) => r.closest("label")?.textContent)).toEqual(["Words", "Meaning", "Reference"]);
  });

  it("theInfoIconExplainsEachKindOfSearch", () => {
    const { container } = render(wrap(<SearchForm {...props} />));
    const details = container.querySelector("details")!;
    const summary = details.querySelector("summary")!;
    expect(summary).toHaveAttribute("aria-label", "About the kinds of search");
    expect(details).not.toHaveAttribute("open");
    fireEvent.click(summary);
    expect(details).toHaveAttribute("open");
    const note = details.textContent ?? "";
    expect(note).toContain("Words");
    expect(note).toContain("“Exact phrase”");
    expect(note).toContain("synonyms and paraphrases");
    expect(note).toContain("another language");
    expect(note).toContain("Jonah 1:1-2:2; 3:2");
  });

  it("startsFromTheSearchShown", () => {
    render(wrap(<SearchForm {...props} initial={{ mode: "semantic", q: "light of the world", exact: false }} />));
    expect(screen.getByRole("radio", { name: "Meaning" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: "Theme or idea" })).toHaveValue("light of the world");
  });
});
