import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { Entity, EntityRef } from "@/lib/entities";
import type { Book } from "@/lib/types";

vi.mock("server-only", () => ({}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, v: { edition: string }) => `${key}:${v.edition}`,
  setRequestLocale: () => {},
}));
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<object>()),
  getEditions: async () => [{ sigla: "NVBSE", fullname: "Nova Vulgata", language: "la" }],
}));
const { EntityIndex } = await import("@/components/EntityIndex");

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {ui}
  </NextIntlClientProvider>
);
const ref = (chapter: number, verse: number): EntityRef => ({ book: 1, chapter, verse, segment: null, tradition: null, label: null, printedChapter: null });
const entity = (id: string, la: string, extra: Partial<Entity> = {}): Entity => ({
  id, kind: "individual", names: { la, en: la }, description: { en: `about ${la}` }, qid: null, qidStatus: null, uncertain: false, refs: [ref(1, 1)], ...extra,
});
const books: Book[] = [{ bookNum: 1, name: "Genesis", abbrev: "Gn", chapters: 50, versesPerChapter: [], prologue: 0 }];
const base = { editionName: "Nova Vulgata", sigla: "NVBSE", editionLang: "la", type: "person" as const, books, locale: "en", back: null };

describe("EntityIndex", () => {
  it("listsTheLettersEntryNamesAndLinkedVerses", () => {
    const entities = [entity("bpers:abel", "Abel", { refs: [ref(4, 2), ref(4, 3)] }), entity("bpers:cain", "Cain"), entity("bpers:adam", "Adam", { names: { la: "Adam", en: "Adam" } })];
    render(wrap(<EntityIndex {...base} entities={entities} letter={null} />));
    expect(screen.getByRole("heading", { level: 1, name: "Persons in Nova Vulgata" })).toBeInTheDocument();
    const bar = screen.getByRole("navigation", { name: "Letters" });
    expect(within(bar).getAllByRole("link").map((a) => a.textContent)).toEqual(["A", "C"]);
    expect(within(bar).getByRole("link", { name: "A" })).toHaveAttribute("aria-current", "page");
    expect(within(bar).getByRole("link", { name: "C" })).toHaveAttribute("href", "?letter=C");
    const items = screen.getAllByRole("listitem").map((li) => li.querySelector("[lang]")?.textContent);
    expect(items).toEqual(["Abel", "Adam"]); // letter A only, sorted
    expect(screen.getByText("Abel")).toHaveAttribute("lang", "la");
    expect(screen.getByText("about Abel")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "4:2–3" })).toHaveAttribute("href", "/en/read/nvbse/genesis/4#v4.2");
  });

  it("marksUncertainEntriesAndHidesAutomaticWikidataLinks", () => {
    const entities = [
      entity("bpers:a1", "Aa", { uncertain: true, qid: "Q1", qidStatus: "auto" }),
      entity("bpers:a2", "Ab", { qid: "Q2", qidStatus: "reviewed" }),
    ];
    render(wrap(<EntityIndex {...base} entities={entities} letter="A" />));
    const [first, second] = screen.getAllByRole("listitem");
    expect(within(first).getByText("uncertain")).toBeInTheDocument();
    expect(within(first).queryByRole("link", { name: "Wikidata" })).toBeNull();
    expect(within(second).queryByText("uncertain")).toBeNull();
    expect(within(second).getByRole("link", { name: "Wikidata" })).toHaveAttribute("href", "https://www.wikidata.org/wiki/Q2");
  });

  it("foldsLongVerseListsIntoDetails", () => {
    const many = Array.from({ length: 41 }, (_, i) => ref(1 + i, 1));
    const { container } = render(wrap(<EntityIndex {...base} entities={[entity("bpers:d", "David", { refs: many })]} letter="D" />));
    const details = container.querySelector("details")!;
    expect(details).not.toBeNull();
    expect(details.querySelector("summary")).toHaveTextContent("Gn · 41 verses");
    expect(within(details).getAllByRole("link")).toHaveLength(41);
    const { container: short } = render(wrap(<EntityIndex {...base} entities={[entity("bpers:e", "Eva", { refs: many.slice(0, 40) })]} letter="E" />));
    expect(short.querySelector("details")).toBeNull();
  });

  it("saysThereIsNoIndexYetWhenEmpty", () => {
    render(wrap(<EntityIndex {...base} entities={[]} letter={null} />));
    expect(screen.getByText("This edition has no index yet.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Letters" })).toBeNull();
  });

  it("keepsTheBackLinkOnALetterThatIsNotALetter", () => {
    render(wrap(<EntityIndex {...base} entities={[entity("bpers:n", "123")]} letter={null} back="/en/read/nvbse/genesis/4" />));
    expect(screen.getByRole("navigation", { name: "Letters" }).querySelector("a")).toHaveAttribute("href", `?letter=%23&back=${encodeURIComponent("/en/read/nvbse/genesis/4")}`);
  });

  it("linksBackToTheReaderPageItWasOpenedFrom", () => {
    render(wrap(<EntityIndex {...base} entities={[entity("bpers:a", "Abel")]} letter={null} back="/en/read/nvbse/genesis/4?with=DRB" />));
    expect(screen.getByRole("link", { name: "Back to the reader" })).toHaveAttribute("href", "/en/read/nvbse/genesis/4?with=DRB");
    expect(screen.getByRole("navigation", { name: "Letters" }).querySelector("a")).toHaveAttribute("href", `?letter=A&back=${encodeURIComponent("/en/read/nvbse/genesis/4?with=DRB")}`);
  });
});

describe("backTo", () => {
  it("keepsOnlyAPathOfThisEditionsReader", async () => {
    const { backTo } = await import("@/components/EntityIndexPage");
    expect(backTo("/en/read/nvbse/genesis/4?with=DRB", "en", "NVBSE")).toBe("/en/read/nvbse/genesis/4?with=DRB");
    expect(backTo("https://evil.example/en/read/nvbse/", "en", "NVBSE")).toBeNull();
    expect(backTo("/en/read/nvbse//evil.example", "en", "NVBSE")).toBeNull();
    expect(backTo("/en/read/drb/genesis/4", "en", "NVBSE")).toBeNull();
    expect(backTo(undefined, "en", "NVBSE")).toBeNull();
    // A parent segment, plain or percent-encoded, would leave the edition once the browser resolves it.
    expect(backTo("/en/read/nvbse/../nabre/genesis/1", "en", "NVBSE")).toBeNull();
    expect(backTo("/en/read/nvbse/%2e%2e/nabre/genesis/1", "en", "NVBSE")).toBeNull();
    expect(backTo("/en/read/nvbse/genesis/4?with=DRB&tradition=GREEK#v4.2", "en", "NVBSE")).toBe("/en/read/nvbse/genesis/4?with=DRB&tradition=GREEK#v4.2");
  });
});

describe("indexMetadata", () => {
  it("titlesThePageWithTheEditionsFullName", async () => {
    const { indexMetadata } = await import("@/components/EntityIndexPage");
    expect(await indexMetadata(Promise.resolve({ locale: "en", edition: "nvbse" }), "place")).toEqual({ title: "placesIn:Nova Vulgata" });
    expect(await indexMetadata(Promise.resolve({ locale: "en", edition: "nope" }), "place")).toEqual({});
  });
});
