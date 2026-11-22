# Search Modes (Reference, one Semantic, placeholders) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The reader's search offers Keyword, Semantic (served by `/search/hybrid`) and Reference, with a placeholder per mode; a Reference search shows exactly the verses of a Bible reference in the main edition.

**Architecture:** The modes move to one client-safe module that the form and the server code both import. Semantic stays the website's word but asks the endpoint's hybrid route. A Reference search asks `/quote` (the one reference grammar every BibleGet client shares), groups the rows by book and chapter, and renders them as a passage with `VerseLines`; comparison shows a note instead of compared editions.

**Tech Stack:** Next.js 16 (App Router, server components), next-intl, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-22-reference-search-design.md`

## Global Constraints

- Modes, in this order: `keyword` (default), `semantic`, `reference`. No `hybrid` tab; a URL with `mode=hybrid` is read as `semantic`.
- `semantic` requests `/search/hybrid?query=…&version=…&limit=30` (default weights: no weight parameters).
- `reference` requests `/quote?query=<q>&version=<SIGLA>&numbering=edition&return=json`; the key and cache rules are those of `quoteRequest` in `lib/api.ts` (reader: `{ cache: "no-store" }`; otherwise `{ next: { revalidate: 3600 } }`).
- A reference search shows the **main edition only**; it never pairs compared editions by chapter:verse.
- Never show the endpoint's own error text (English only).
- The semantic rate limit (`semanticLimiter`) applies to `semantic` only, not to `reference`.
- Placeholders and labels, exact copy (`messages/*.json`, namespace `Search`):

| key | en | it | es | fr | de | pt |
|---|---|---|---|---|---|---|
| `modes.reference` | Reference | Riferimento | Referencia | Référence | Bibelstelle | Referência |
| `referenceLabel` | Bible reference | Riferimento biblico | Referencia bíblica | Référence biblique | Bibelstelle | Referência bíblica |
| `placeholders.keyword` | Words in the verse, e.g. shepherd | Parole del versetto, es. pastore | Palabras del versículo, p. ej. pastor | Mots du verset, p. ex. berger | Wörter im Vers, z. B. Hirte | Palavras do versículo, p. ex. pastor |
| `placeholders.semantic` | A theme or idea, e.g. trust in God | Un tema o un'idea, es. fiducia in Dio | Un tema o una idea, p. ej. confianza en Dios | Un thème ou une idée, p. ex. confiance en Dieu | Ein Thema oder Gedanke, z. B. Vertrauen auf Gott | Um tema ou uma ideia, p. ex. confiança em Deus |
| `placeholders.reference` | Jonah 1:1-2:2; 3:2 | Giona 1,1-2,2; 3,2 | Jonás 1,1-2,2; 3,2 | Jonas 1,1-2,2; 3,2 | Jona 1,1-2,2; 3,2 | Jonas 1,1-2,2; 3,2 |
| `unreadableReference` | That reference could not be read. Try one like {example}. | Non è stato possibile leggere il riferimento. Provane uno come {example}. | No se pudo leer la referencia. Prueba una como {example}. | Impossible de lire cette référence. Essayez par exemple {example}. | Diese Bibelstelle konnte nicht gelesen werden. Versuchen Sie z. B. {example}. | Não foi possível ler a referência. Tente uma como {example}. |
| `compareLater` | Only {edition} is shown: the compared editions will be matched verse by verse once the verse mapping is ready. | Viene mostrata solo {edition}: le edizioni a confronto saranno allineate versetto per versetto quando la corrispondenza dei versetti sarà pronta. | Solo se muestra {edition}: las ediciones comparadas se alinearán versículo a versículo cuando la correspondencia de versículos esté lista. | Seule {edition} est affichée : les éditions comparées seront alignées verset par verset dès que la correspondance des versets sera prête. | Nur {edition} wird angezeigt: Die verglichenen Ausgaben werden Vers für Vers zugeordnet, sobald die Verszuordnung fertig ist. | Só {edition} é mostrada: as edições comparadas serão alinhadas versículo a versículo quando a correspondência dos versículos estiver pronta. |
| `passageHeading` | {book} {chapter} | {book} {chapter} | {book} {chapter} | {book} {chapter} | {book} {chapter} | {book} {chapter} |

- `modes.hybrid` is removed from every locale.
- Tests: `npx vitest run` green, `npx tsc --noEmit` and `npx eslint .` clean, after every task.

## Review Focus

1. A reference that crosses books (`Jonah 4; Micah 1`) or returns a verse printed in another chapter (`printedChapter`): one heading per book and printed chapter, each linking to the chapter the verse is printed in. Pinned by `groupsByBookAndPrintedChapter` (Task 2).
2. A reference in the other notation from the UI locale's (`Giona 1:1` on the English page): passed to `/quote` untouched, which auto-detects. Pinned by `sendsTheReferenceAsTyped` (Task 2).
3. `/quote` answering 200 with `errors` and no `results` (an unknown book), or 400/422 (a malformed query): the unreadable message, never an exception. Pinned by `anUnreadableReferenceIsNotAnError` (Task 2).
4. An old bookmark `?mode=hybrid&q=…`: searches as semantic, and the form shows Semantic selected. Pinned by `anOldHybridLinkSearchesSemantic` (Task 1).
5. A reference search started from a comparison: the note shows, the chapter links keep `with`/`view`, and the main edition alone is fetched. Pinned by `aComparisonShowsTheNoteAndKeepsItInTheLinks` (Task 3).

---

### Task 1: Three modes, semantic through hybrid, a placeholder per mode

**Files:**
- Create: `lib/search-modes.ts`
- Modify: `lib/search.ts`, `components/SearchForm.tsx`, `app/[locale]/read/[edition]/search/page.tsx`, `messages/{en,it,es,fr,de,pt}.json`
- Test: `lib/__tests__/search.test.ts`, `components/__tests__/SearchForm.test.tsx`, `app/__tests__/search-page.test.tsx`

**Interfaces:**
- Produces: `lib/search-modes.ts` (no `server-only`): `export type SearchMode = "keyword" | "semantic" | "reference"`, `export const SEARCH_MODES: readonly SearchMode[] = ["keyword", "semantic", "reference"]`, `export function parseMode(raw: string | undefined): SearchMode` (`"hybrid"` → `"semantic"`, unknown → `"keyword"`). `lib/search.ts` re-exports `SearchMode` and `SEARCH_MODES` from it; `SearchForm.tsx` imports them from it (its own copy is deleted).
- `searchEdition` keeps its signature; it accepts `mode: "keyword" | "semantic"` (reference goes through Task 2).

- [ ] **Step 1: Write the failing tests**

In `lib/__tests__/search.test.ts`, replace `asksSemanticAndHybridForThirty` with:

```ts
it("asksSemanticThroughTheHybridRouteForThirty", async () => {
  const fn = stub(() => json({ results: [raw(1), raw(2)], info: {} }));
  const out = await searchEdition({ ...base, mode: "semantic", q: "God forgives" });
  const u = url(fn);
  expect(u.pathname).toBe("/dev/search/hybrid");
  expect(Object.fromEntries(u.searchParams)).toEqual({ query: "God forgives", version: "NABRE", limit: "30" });
  expect(out).toMatchObject({ kind: "ok", total: 2, capped: null });
});
```

New `lib/__tests__/search-modes.test.ts`:

```ts
it("parsesTheModes", () => {
  expect(parseMode("reference")).toBe("reference");
  expect(parseMode("semantic")).toBe("semantic");
  expect(parseMode("hybrid")).toBe("semantic");
  expect(parseMode("nope")).toBe("keyword");
  expect(parseMode(undefined)).toBe("keyword");
});
```

In `components/__tests__/SearchForm.test.tsx`:

```ts
it("offersKeywordSemanticAndReference", () => {
  // render the form (as the file's other tests do)
  expect(screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual(["keyword", "semantic", "reference"]);
});
it("eachModeShowsItsPlaceholder", () => {
  // render; for each [mode, placeholder] of en's Search.placeholders: click the mode's radio,
  // then expect(screen.getByRole(<the field's role>)).toHaveAttribute("placeholder", placeholder)
  // keyword: role combobox, "Words in the verse, e.g. shepherd"; semantic: textbox, "A theme or idea, e.g. trust in God";
  // reference: textbox named "Bible reference", "Jonah 1:1-2:2; 3:2"
});
```

In `app/__tests__/search-page.test.tsx`:

```ts
it("anOldHybridLinkSearchesSemantic", async () => {
  await page({ mode: "hybrid", q: "trust" });
  expect(searchEdition).toHaveBeenCalledWith(expect.objectContaining({ mode: "semantic" }));
  expect(screen.getByRole("radio", { name: "Semantic" })).toBeChecked();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run lib/__tests__/search.test.ts lib/__tests__/search-modes.test.ts components/__tests__/SearchForm.test.tsx app/__tests__/search-page.test.tsx`
Expected: FAIL (`/dev/search/semantic` ≠ `/dev/search/hybrid`; `search-modes` not found; three radios with `hybrid`; no placeholder).

- [ ] **Step 3: Implement**

- `lib/search-modes.ts` as in Interfaces.
- `lib/search.ts`: the semantic path is `/search/hybrid?…`; `SearchMode`/`SEARCH_MODES` come from `search-modes`; update the doc comments that name hybrid.
- `components/SearchForm.tsx`: import the modes; `placeholder={t(`placeholders.${mode}`)}` on the keyword input and the question textarea. Reference's field is Task 3, so until then a `reference` mode in the form renders the textarea branch (Task 3 replaces it).
- `search/page.tsx`: `const mode = parseMode(one(search.mode))`; the page's doc comment lists `keyword|semantic|reference`. Until Task 3, a `reference` search returns `null` from `body()` (Task 3 fills it).
- `messages/*.json`: add `placeholders.*` and `modes.reference` from the Global Constraints table; remove `modes.hybrid`.

- [ ] **Step 4: Run all tests, typecheck, lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint .`
Expected: all green. Any existing test that named `hybrid` is updated to `semantic` (it asserted the old tab).

- [ ] **Step 5: Commit**

```bash
git add lib/search-modes.ts lib/search.ts components/SearchForm.tsx "app/[locale]/read/[edition]/search/page.tsx" messages/*.json lib/__tests__/search.test.ts lib/__tests__/search-modes.test.ts components/__tests__/SearchForm.test.tsx app/__tests__/search-page.test.tsx
git commit -m "feat(search): keyword, semantic (through hybrid) and reference modes, a placeholder for each"
```

---

### Task 2: Looking up a reference

**Files:**
- Create: `lib/passage.ts`
- Modify: `lib/api.ts` (`RawRow` gains `univbooknum?: number | string`; new `getPassage`)
- Test: `lib/__tests__/passage.test.ts`

**Interfaces:**
- Produces, in `lib/api.ts`: `export type PassageRow = VerseRow & { bookNum: number }` and
  `export async function getPassage(p: { sigla: string; query: string; access: Access }): Promise<{ rows: PassageRow[]; capped: boolean; readable: boolean }>`.
  It asks `/quote` as in the Global Constraints. `readable` is false when the endpoint answers 400 or 422, or answers with no `results` (whether or not it sends `errors`). `capped` is true when `notices` holds a `VERSES_CAPPED` entry for `sigla`. Other non-OK statuses throw `ApiUnavailable`, as `request` already does. `bookNum` is `Number(univbooknum)`.
- Produces, in `lib/passage.ts` (pure): `export type PassageGroup = { bookNum: number; chapter: number; rows: PassageRow[] }` and
  `export function groupPassage(rows: PassageRow[]): PassageGroup[]`, which starts a new group whenever `bookNum` or `printedChapter ?? chapter` changes from the previous row. `chapter` is that printed chapter. Rows keep the endpoint's order.

- [ ] **Step 1: Write the failing tests** (`lib/__tests__/passage.test.ts`, with the `stub`/`json` helpers of `search.test.ts`)

```ts
it("sendsTheReferenceAsTyped", async () => {
  const fn = stub(() => json({ results: [rawRow(39, 1, 1)] }));
  await getPassage({ sigla: "DRB", query: "Giona 1:1-2:2;3:2", access: "visitor" });
  expect(Object.fromEntries(url(fn).searchParams)).toEqual({ query: "Giona 1:1-2:2;3:2", version: "DRB", numbering: "edition", return: "json" });
  expect(url(fn).pathname).toBe("/dev/quote");
});
it("readsTheRowsAndTheCap", async () => {
  stub(() => json({ results: [rawRow(39, 1, 1), rawRow(39, 1, 2)], notices: [{ code: "VERSES_CAPPED", version: "DRB" }] }));
  const out = await getPassage({ sigla: "DRB", query: "Jonah 1", access: "visitor" });
  expect(out).toMatchObject({ readable: true, capped: true });
  expect(out.rows.map((r) => [r.bookNum, r.chapter, r.verse])).toEqual([[39, 1, 1], [39, 1, 2]]);
});
it("anUnreadableReferenceIsNotAnError", async () => {
  for (const res of [json({ errors: ["unknown book"] }), json({ results: [] }), json({ detail: "bad" }, 422), json({ detail: "bad" }, 400)]) {
    stub(() => res);
    expect(await getPassage({ sigla: "DRB", query: "Xyz 1", access: "visitor" })).toEqual({ rows: [], capped: false, readable: false });
    vi.unstubAllGlobals();
  }
});
it("groupsByBookAndPrintedChapter", () => {
  const r = (bookNum: number, chapter: number, verse: number, printedChapter: number | null = null) =>
    ({ bookNum, chapter, verse, printedChapter, segment: null, label: null, text: "", titles: [] });
  const groups = groupPassage([r(39, 4, 10), r(39, 4, 11), r(40, 1, 1), r(40, 1, 2), r(27, 12, 1, 11)]);
  expect(groups.map((g) => [g.bookNum, g.chapter, g.rows.length])).toEqual([[39, 4, 2], [40, 1, 2], [27, 11, 1]]);
});
```

(`rawRow(book, chapter, verse)` returns `{ univbooknum: book, chapter, verse, text: "…", verse_segment: null, printed_chapter: null }`.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run lib/__tests__/passage.test.ts`
Expected: FAIL (`getPassage` / `groupPassage` not exported).

- [ ] **Step 3: Implement `getPassage` in `lib/api.ts` and `groupPassage` in `lib/passage.ts`**

`getPassage` needs the response status (`request` throws on non-OK), so call `apiResponse` with the same `init` rule as `quoteRequest`, and parse the JSON body as `quoteRequest` does. Reuse `toRow` for the verse fields.

- [ ] **Step 4: Run all tests, typecheck, lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint .`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add lib/api.ts lib/passage.ts lib/__tests__/passage.test.ts
git commit -m "feat(search): look up a Bible reference through /quote, grouped by book and chapter"
```

---

### Task 3: The reference field and the passage page

**Files:**
- Create: `components/ReferenceResults.tsx`
- Modify: `components/SearchForm.tsx`, `app/[locale]/read/[edition]/search/page.tsx`, `messages/*.json` (`referenceLabel`, `unreadableReference`, `compareLater`, `passageHeading`)
- Test: `components/__tests__/SearchForm.test.tsx`, `app/__tests__/search-page.test.tsx`

**Interfaces:**
- Consumes: `getPassage`, `PassageRow` (Task 2, `lib/api.ts`); `groupPassage`, `PassageGroup` (Task 2, `lib/passage.ts`); `parseMode` (Task 1).
- Produces: `ReferenceResults({ groups, hrefFor, bookName, lang }: { groups: PassageGroup[]; hrefFor: (g: PassageGroup) => string; bookName: (bookNum: number) => string; lang?: string })`: one `<section>` per group, an `<h2>` holding a link with the text `passageHeading` (`{book} {chapter}`), then `<VerseLines rows={g.rows} chapter={g.chapter} lang={lang} />`.

- [ ] **Step 1: Write the failing tests**

`components/__tests__/SearchForm.test.tsx`:

```ts
it("theReferenceFieldIsOneLineWithoutSuggestionsOrExactWords", () => {
  // render, click the "Reference" radio
  const field = screen.getByRole("textbox", { name: "Bible reference" });
  expect(field.tagName).toBe("INPUT");
  expect(field).toHaveAttribute("name", "q");
  expect(screen.queryByRole("checkbox", { name: "Exact words" })).toBeNull();
  fireEvent.change(field, { target: { value: "Jo" } });
  // no fetch to /api/search/suggest after the debounce (advance fake timers 300 ms; the fetch stub was not called)
});
```

`app/__tests__/search-page.test.tsx` (mock `getPassage` beside `getEditions`; a group of Jonah 1:1–2 when `bookNum` 39 is in `index` as `{ bookNum: 39, name: "Jonah", abbrev: "Jon", chapters: 4, versesPerChapter: [] }`):

```ts
it("aReferenceSearchShowsThePassage", async () => {
  getPassage.mockResolvedValue({ readable: true, capped: false, rows: [row(39, 1, 1, "The word of the Lord came"), row(39, 1, 2, "Arise, go to Nineveh")] });
  await page({ mode: "reference", q: "Jonah 1:1-2" });
  expect(getPassage).toHaveBeenCalledWith({ sigla: "NABRE", query: "Jonah 1:1-2", access: "visitor" });
  expect(searchEdition).not.toHaveBeenCalled();
  expect(semanticHit).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "Jonah 1" })).toHaveAttribute("href", "/en/read/nabre/jonah/1#v1.1");
  expect(screen.getByText("Arise, go to Nineveh")).toBeInTheDocument();
});
it("anUnreadableReferenceSaysSoWithTheExample", async () => {
  getPassage.mockResolvedValue({ readable: false, capped: false, rows: [] });
  await page({ mode: "reference", q: "Xyz 9" });
  expect(screen.getByRole("status")).toHaveTextContent("That reference could not be read. Try one like Jonah 1:1-2:2; 3:2.");
});
it("aCappedReferenceOffersToSignIn", async () => {
  getPassage.mockResolvedValue({ readable: true, capped: true, rows: [row(39, 1, 1, "x")] });
  await page({ mode: "reference", q: "Jonah 1-4" });
  // the CappedNotice for a visitor is shown (assert as cappedNoticeComesBackToThisSearch does), coming back to
  // /en/read/nabre/search?mode=reference&q=Jonah+1-4
});
it("aComparisonShowsTheNoteAndKeepsItInTheLinks", async () => {
  getPassage.mockResolvedValue({ readable: true, capped: false, rows: [row(39, 1, 1, "x")] });
  await page({ mode: "reference", q: "Jonah 1:1", from: "/en/read/nabre/john/3?with=DRB&view=interlinear" });
  expect(getPassage).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("note")).toHaveTextContent("Only New American Bible is shown");
  expect(screen.getByRole("link", { name: "Jonah 1" })).toHaveAttribute("href", "/en/read/nabre/jonah/1?with=DRB&view=interlinear#v1.1");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run components/__tests__/SearchForm.test.tsx app/__tests__/search-page.test.tsx`
Expected: FAIL (no "Bible reference" field; `body()` returns nothing for reference).

- [ ] **Step 3: Implement**

- `SearchForm.tsx`: a `reference` branch, `<input type="text" name="q" aria-label={t("referenceLabel")} placeholder={t("placeholders.reference")} maxLength={200} autoComplete="off">`, with no listbox and no checkbox. Suggestions stay keyword-only.
- `search/page.tsx`: for `mode === "reference"` with a non-empty `q`, call `getPassage({ sigla, query: q, access })` instead of `searchEdition`, without the semantic limiter. Render:
  - the `compareLater` note (`<aside role="note">`, `edition` = the edition's fullname) when `cameFrom`'s query string has `with`;
  - unreadable: `<p role="status">{t("unreadableReference", { example: t("placeholders.reference") })}</p>`;
  - otherwise `ReferenceResults`. `hrefFor(g)` is `/${locale}/read/${slug}/${slugFor(book, index.books)}/${g.chapter}${keep}#${verseAnchor(g.rows[0])}`, where `keep` is `cameFrom`'s `with`, `view` and `tradition` parameters as `"?…"`, or `""`;
  - a cap: `noticeFor(true, access, edition.copyright)`, then `CappedNotice({ kind, about: "search", redirectTo: searchHref(…mode: "reference"…) })`, as the other modes do.
- The `{mode}: <q>…</q>` line above the results stays.
- `messages/*.json`: the four keys from the Global Constraints table.

- [ ] **Step 4: Run all tests, typecheck, lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint .`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add components/ReferenceResults.tsx components/SearchForm.tsx "app/[locale]/read/[edition]/search/page.tsx" messages/*.json components/__tests__/SearchForm.test.tsx app/__tests__/search-page.test.tsx
git commit -m "feat(search): the reference field and the passage it finds"
```
