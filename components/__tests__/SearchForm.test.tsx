import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { SearchForm, SearchLens } from "@/components/SearchForm";

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

describe("SearchLens", () => {
  it("theLensOpensTheFormAndEscapeCloses", () => {
    render(wrap(<SearchLens {...props} />));
    const lens = screen.getByRole("button", { name: "Search" });
    expect(lens).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(lens);
    expect(lens).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("search")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("search")).toBeNull();
    expect(lens).toHaveFocus();
  });
});

describe("SearchLens without JavaScript", () => {
  it("isALinkToTheSearchPageUntilTheScriptRuns", () => {
    const html = renderToString(wrap(<SearchLens {...props} />));
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
    expect(Array.from(container.querySelectorAll("input[name=mode]")).map((i) => i.getAttribute("value"))).toEqual(["keyword", "semantic", "hybrid"]);
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
    const exact = screen.getByRole("checkbox", { name: "Exact words" });
    expect(exact).toHaveAttribute("name", "match");
    expect(exact).toHaveAttribute("value", "exact");
    expect(container.querySelector("input[name=match]")).toBe(exact);
  });

  it("semanticModeIsATextAreaEnterSubmitsShiftEnterNewLine", () => {
    const { container } = render(wrap(<SearchForm {...props} />));
    fireEvent.click(screen.getByRole("radio", { name: "Semantic" }));
    const area = screen.getByRole("textbox", { name: "Your question" });
    expect(area.tagName).toBe("TEXTAREA");
    expect(area).toHaveAttribute("maxLength", "500");
    expect(screen.queryByRole("checkbox", { name: "Exact words" })).toBeNull();
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
    expect(screen.getByRole("checkbox", { name: "Exact words" })).toBeChecked();
    await typeAndWait(screen.getByRole("combobox", { name: "Words to find" }), "light lig");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("startsFromTheSearchShown", () => {
    render(wrap(<SearchForm {...props} initial={{ mode: "hybrid", q: "light of the world", exact: false }} />));
    expect(screen.getByRole("radio", { name: "Hybrid" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: "Your question" })).toHaveValue("light of the world");
  });
});
