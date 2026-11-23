# Reader go-to navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the reader bar's book and chapter selects with a go-to panel (chapters → testament's books →
The Bible, back arrow, centered breadcrumb), open editions from the shelf on the last chapter read, lighten
the edition index page, and add a sitemap that staging never serves.

**Architecture:** One client component, `GoToPanel`, on a native `<dialog>`, fed by the index `ReaderBar`
already receives; its links are built by the same function `ReaderBar.go()` uses. Book sections come from a
fixed table by book number. The last chapter read lives in `localStorage`; the shelf's links keep pointing at
the index page and a click handler redirects through the existing `?book=&chapter=` redirect. Sitemaps are
route handlers with XML built by pure functions.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, next-intl 4, Tailwind 4, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-23-reader-goto-navigation-design.md`

## Global Constraints

- No new dependency. Read `node_modules/next/dist/docs/` before using a Next API (repo rule).
- Locales en, it, es, fr, de, pt: add English strings to `messages/en.json`, run `npm run sync-messages`, then translate the new strings in the other five files (no English left in them).
- Book numbers are 1–73 (OT 1–46, NT 47–73). Protestant editions lack 17, 18, 20, 21, 27, 28, 32.
- Sections, by book number: Pentateuch 1–5, Historical Books 6–21, Wisdom Books 22–28, Prophets 29–46, Gospels 47–50, Acts of the Apostles 51, Letters of Paul 52–64, Catholic Letters 65–72, Revelation 73.
- Italian section names: Pentateuco, Libri storici, Libri sapienziali, Profeti; Vangeli, Atti degli Apostoli, Lettere di Paolo, Lettere cattoliche, Apocalisse.
- Jumps keep `with`, `view` and Esther's `tradition` exactly as `ReaderBar.go()` does today.
- Staging (`SITE_NOINDEX=1`) and an unset canonical origin never serve a sitemap nor name one in `robots.txt`; no URL is ever built from the request host.
- Stage files by name; never commit `.env*` (except `.env.example`).
- The worktree has no `node_modules`: run `npm ci` first. Every task ends green on `npm test`, `npm run lint`, `npm run typecheck`.

## Review Focus

- Esc, or Android's back gesture, closes the panel without navigating; reopening starts again at the current book's chapters, not at the level last seen. (Task 2 test `escClosesWithoutNavigatingAndReopensOnChapters`.)
- Esther with both texts: another Esther chapter from the panel keeps `tradition`, another book drops it. (Task 3 test `panelKeepsEstherTraditionOnlyWithinEsther`.)
- Ctrl/Cmd/Shift/middle clicks on panel links and on shelf books are not intercepted. (Task 2 `modifiedClickIsLeftToTheBrowser`, Task 4 `modifiedShelfClickFollowsTheLink`.)
- `localStorage` throwing, or holding junk, falls back to Genesis 1 without an error. (Task 4 `badStorageFallsBackToGenesisOne`.)
- A Protestant edition shows no empty section and counts Wisdom Books as 5. (Task 1 `dropsEmptySectionsForAProtestantCanon`, Task 2 `bibleLevelCountsOnlyTheEditionsBooks`.)

---

### Task 1: Sections table and the GoTo strings

**Files:**
- Create: `lib/sections.ts`
- Test: `lib/__tests__/sections.test.ts` (create the folder if missing; follow the existing tests' style)
- Modify: `messages/en.json` (+ the five others via `npm run sync-messages`, then translate)

**Interfaces:**
- Produces:
  - `type Testament = "ot" | "nt"`
  - `type SectionKey = "pentateuch" | "historical" | "wisdom" | "prophets" | "gospels" | "acts" | "paul" | "catholic" | "revelation"`
  - `sectionOf(bookNum: number): { key: SectionKey; testament: Testament }` (throws `RangeError` outside 1–73)
  - `groupBySection<B extends { bookNum: number }>(books: readonly B[]): { key: SectionKey; testament: Testament; books: B[] }[]` — canon order, books kept in input order, empty sections omitted.
  - Messages namespace `GoTo`: `button` ("Go to another book or chapter"), `bible` ("The Bible"), `back` ("Back"), `close` ("Close"), `home` ("The Bible"), `whereYouAre` ("Where you are"), `allChapters` ("All chapters"), `bookCount` ("{count, plural, one {# book} other {# books}}"), `sections.{SectionKey}` (en: Pentateuch, Historical Books, Wisdom Books, Prophets, Gospels, Acts of the Apostles, Letters of Paul, Catholic Letters, Revelation). Testament names reuse `Books.ot` / `Books.nt`.

- [ ] **Step 1: Write the failing tests**

```ts
it("mapsBookNumbersToSections", () => {
  expect(sectionOf(1)).toEqual({ key: "pentateuch", testament: "ot" });
  expect(sectionOf(21)).toEqual({ key: "historical", testament: "ot" });
  expect(sectionOf(28)).toEqual({ key: "wisdom", testament: "ot" });
  expect(sectionOf(46)).toEqual({ key: "prophets", testament: "ot" });
  expect(sectionOf(51)).toEqual({ key: "acts", testament: "nt" });
  expect(sectionOf(64)).toEqual({ key: "paul", testament: "nt" });
  expect(sectionOf(65)).toEqual({ key: "catholic", testament: "nt" });
  expect(sectionOf(73)).toEqual({ key: "revelation", testament: "nt" });
  expect(() => sectionOf(74)).toThrow(RangeError);
});
it("dropsEmptySectionsForAProtestantCanon", () => {
  const books = [1, 22, 23, 24, 25, 26, 47].map((bookNum) => ({ bookNum }));
  expect(groupBySection(books).map((s) => [s.key, s.books.length])).toEqual([["pentateuch", 1], ["wisdom", 5], ["gospels", 1]]);
});
```

- [ ] **Step 2: Run** `npx vitest run lib/__tests__/sections.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement `lib/sections.ts`** as a ranges table `{ key, testament, first, last }[]` in canon order.
- [ ] **Step 4: Add the `GoTo` strings** to `messages/en.json`, run `npm run sync-messages`, translate them in it/es/fr/de/pt (Italian section names from Global Constraints).
- [ ] **Step 5: Run** `npx vitest run lib/__tests__/sections.test.ts && npm run typecheck` — Expected: PASS.
- [ ] **Step 6: Commit** `lib/sections.ts lib/__tests__/sections.test.ts messages/*.json` — `feat(reader): the books' sections by number, and the go-to panel's strings`.

---

### Task 2: `GoToPanel`

**Files:**
- Create: `components/GoToPanel.tsx`
- Test: `components/__tests__/GoToPanel.test.tsx`
- Modify: `vitest.setup.ts` (jsdom lacks `HTMLDialogElement.showModal`/`close`: add them when missing — `showModal` sets `open`, `close` clears it and dispatches a `close` event)

**Interfaces:**
- Consumes: `groupBySection`, `sectionOf`, `GoTo` strings (Task 1).
- Produces:

```ts
export type PanelBook = { slug: string; name: string; chapters: number; bookNum: number };
export type GoToPanelProps = {
  open: boolean;
  onClose: () => void;
  editionName: string;
  /** Locale-prefixed path of the edition's index page (the "All chapters" link). */
  indexHref: string;
  books: PanelBook[];
  current: { slug: string; chapter: number };
  /** The full (locale-prefixed) URL a jump goes to, with the reader's kept query. */
  hrefFor: (slug: string, chapter: number) => string;
  /** A plain click: navigate (ReaderBar.go). The panel closes itself afterwards. */
  onPick: (slug: string, chapter: number) => void;
};
export function GoToPanel(p: GoToPanelProps): JSX.Element;
```

Behaviour (spec §2): a `<dialog>` opened with `showModal()` when `open` turns true, always at the **chapters** level of `current.slug`; the dialog's `close` event (Esc, back gesture) calls `onClose`. Levels: `chapters` (grid of `<a>`, 5 columns below `sm`, 10 from `sm`), `books` (tiles under section headings, 3 columns below `sm`; a tile's click shows that book's chapters; the target section scrolls into view), `bible` (two columns OT | NT of section boxes with `bookCount`, the current book's section outlined; a testament heading opens its books at the top; the `allChapters` link to `indexHref`). Header: back arrow (hidden at `bible`), title (book name / testament / `bible`) with `editionName` under it, Close. Footer `<nav aria-label={whereYouAre}>`, **centered**: home icon (house SVG, accessible name `home`) › testament › book; the last item has `aria-current="page"` and no link/handler. Chapter links and book tiles are `<a href>`; a plain primary click without modifiers calls `preventDefault()`, then `onPick` and `onClose` (chapters) or changes level (books). Full screen below `sm`; from `sm` a centered dialog `max-w-[640px]`. Current book/chapter highlighted (`aria-current="true"` plus the red accent).

- [ ] **Step 1: Write the failing tests** (render with `NextIntlClientProvider` and `en` messages, as `ReaderBar.test.tsx` does; books: Genesis 1 (50), Exodus 2 (40), Psalms 23 (150), Matthew 47 (28), John 50 (21))

```ts
it("opensOnTheCurrentBooksChapters", () => { /* open, current genesis 3 */
  expect(screen.getByRole("heading", { name: "Genesis" })).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: /^\d+$/ })).toHaveLength(50);
  expect(screen.getByRole("link", { name: "3" })).toHaveAttribute("aria-current", "true");
  expect(screen.getByRole("link", { name: "3" })).toHaveAttribute("href", "/en/read/x/genesis/3");
});
it("chapterClickPicksAndCloses", () => { /* click "7" → onPick("genesis", 7), onClose called once */ });
it("modifiedClickIsLeftToTheBrowser", () => { /* fireEvent.click(link, { ctrlKey: true }) → onPick not called, event not defaultPrevented */ });
it("backClimbsChaptersBooksBible", () => {
  /* Back → heading "Old Testament", tiles Genesis/Exodus/Psalms under "Pentateuch"/"Wisdom Books";
     Back → heading "The Bible", columns "Old Testament" and "New Testament"; Back button gone */
});
it("breadcrumbLinksEveryLevelButTheLast", () => {
  /* at chapters: nav "Where you are" holds "The Bible"(home) › "Old Testament" › "Genesis";
     "Genesis" has aria-current="page" and is not a link/button; clicking "Old Testament" shows the books level;
     at bible level the nav holds only the home item, with aria-current="page" */
});
it("bookTileShowsItsChapters", () => { /* books level, click "Psalms" → 150 chapter links, onPick not called */ });
it("sectionBoxOpensItsTestamentAtThatSection", () => { /* bible level, click "Gospels" → heading "New Testament" */ });
it("bibleLevelCountsOnlyTheEditionsBooks", () => { /* "Wisdom Books" box reads "1 book" (only Psalms given) */ });
it("allChaptersLinksTheIndex", () => { /* bible level: link "All chapters" href = indexHref */ });
it("escClosesWithoutNavigatingAndReopensOnChapters", () => {
  /* go to bible level; dispatch `close` on the dialog → onClose called, onPick not;
     rerender open=false then open=true → heading "Genesis" again */
});
```

- [ ] **Step 2: Run** `npx vitest run components/__tests__/GoToPanel.test.tsx` — Expected: FAIL (module not found).
- [ ] **Step 3: Add the dialog polyfill to `vitest.setup.ts`, implement `components/GoToPanel.tsx`.**
- [ ] **Step 4: Run** `npx vitest run components/__tests__/GoToPanel.test.tsx && npm run lint && npm run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `components/GoToPanel.tsx components/__tests__/GoToPanel.test.tsx vitest.setup.ts` — `feat(reader): the go-to panel: chapters, a testament's books, the Bible`.

---

### Task 3: The reader bar opens the panel

**Files:**
- Modify: `components/ReaderBar.tsx` (books prop, URL builder split out of `go()`, the go-to button replacing `rb-book`/`rb-chapter`)
- Modify: `app/[locale]/read/[edition]/[book]/[chapter]/page.tsx:184` (pass `bookNum` in `books`)
- Test: `components/__tests__/ReaderBar.test.tsx` (rewrite the select-based tests), `app/__tests__/pages.test.tsx` (only if it asserts the selects)

**Interfaces:**
- Consumes: `GoToPanel`, `PanelBook` (Task 2).
- Produces: `ReaderBarProps.books: PanelBook[]`. Inside `ReaderBar`, `target(o: SettingsChange & { book?: string; chapter?: number }): string` returns the URL `go()` pushes (same pending-ref rules); `go(o)` = `router.push(target(o))` plus the pending-ref update. The panel gets `hrefFor={(slug, ch) => target({ book: slug, chapter: ch })}` and `onPick={(slug, ch) => go({ book: slug, chapter: ch })}`, `indexHref={`/${locale}/read/${editionSlug(edition)}`}`.

The button (`aria-haspopup="dialog"`, accessible name from `GoTo.button`, visible text `{book name} {chapter}`) takes the space the two selects had (`max-sm:flex-1`). The edition select, lens and ⚙ are unchanged.

- [ ] **Step 1: Rewrite the failing tests** in `ReaderBar.test.tsx`:

```ts
it("toolbarHasTheEditionSelectAndTheGoToButton", () => {
  expect(screen.getAllByRole("combobox").map((c) => c.id)).toEqual(["rb-edition"]);
  expect(screen.getByRole("button", { name: /Go to another book or chapter/ })).toHaveTextContent("Tobit 3");
});
it("panelJumpsKeepTheComparedEditionsAndView", () => {
  /* withSiglas ["DRB","VGCL"], view interlinear: open, click chapter "4"
     → push("/en/read/nabre/tobit/4?with=DRB,VGCL&view=interlinear");
     reopen, Back, click "Esther", click "1" → push("/en/read/nabre/esther/1?with=DRB,VGCL&view=interlinear");
     the link's href equals the pushed URL */
});
it("panelKeepsEstherTraditionOnlyWithinEsther", () => {
  /* esther=true, book esther, tradition "hebrew": chapter "2" keeps tradition in the URL as today's go() does;
     Back → "Tobit" → "1": no tradition param */
});
```

Keep every other existing `ReaderBar` test (edition switch, settings menu, pending-change cases) passing unchanged, except the `books` fixture, which gains `bookNum` (Tobit 17, Esther 19).

- [ ] **Step 2: Run** `npx vitest run components/__tests__/ReaderBar.test.tsx` — Expected: FAIL on the new tests.
- [ ] **Step 3: Implement** the split, the button and the panel in `ReaderBar.tsx`; pass `bookNum` from the chapter page.
- [ ] **Step 4: Run** `npm test && npm run lint && npm run typecheck` — Expected: PASS (all suites).
- [ ] **Step 5: Commit** `components/ReaderBar.tsx components/__tests__/ReaderBar.test.tsx "app/[locale]/read/[edition]/[book]/[chapter]/page.tsx"` (+ `app/__tests__/pages.test.tsx` if changed) — `feat(reader): the go-to button replaces the book and chapter selects`.

---

### Task 4: The last chapter read, and the shelf opens it

**Files:**
- Create: `lib/last-read.ts`, `components/RememberChapter.tsx`
- Modify: `app/[locale]/read/[edition]/[book]/[chapter]/page.tsx` (render `<RememberChapter>`), `components/BookCover.tsx` (click handler)
- Test: `lib/__tests__/last-read.test.ts`, `app/__tests__/pages.test.tsx` (shelf cases)

**Interfaces:**
- Produces:
  - `loadLastRead(sigla: string): { bookNum: number; chapter: number } | null` — key `bibleget.lastRead.{SIGLA}`, JSON; null when storage throws, is empty, or holds anything but two positive integers (bookNum ≤ 73).
  - `saveLastRead(sigla: string, at: { bookNum: number; chapter: number }): void` — swallows storage errors.
  - `resumeHref(sigla: string): string` — locale-less `/read/{editionSlug}?book={n}&chapter={c}`, `?book=1&chapter=1` when nothing is stored.
  - `RememberChapter({ sigla, bookNum, chapter })` — client component, saves in an effect, renders nothing. Reading pages only (not review).

`BookCover`'s `Link` keeps `href="/read/{edition}"`; its `onClick` returns untouched when `e.defaultPrevented`, `e.button !== 0` or any of meta/ctrl/shift/alt is held; otherwise `preventDefault()` and `router.push(resumeHref(sigla))` with `useRouter` from `@/i18n/navigation`. The existing index-page redirect resolves the slug (spec §5).

- [ ] **Step 1: Write the failing tests**

```ts
it("roundTripsPerEdition", () => { saveLastRead("NVBSE", { bookNum: 50, chapter: 3 }); expect(loadLastRead("NVBSE")).toEqual({ bookNum: 50, chapter: 3 }); expect(loadLastRead("DRB")).toBeNull(); });
it("badStorageFallsBackToGenesisOne", () => {
  localStorage.setItem("bibleget.lastRead.DRB", "{oops"); expect(resumeHref("DRB")).toBe("/read/drb?book=1&chapter=1");
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
  expect(resumeHref("DRB")).toBe("/read/drb?book=1&chapter=1");
});
// pages.test.tsx, home shelf:
it("shelfClickOpensTheLastChapterRead", () => { /* stored LUZZI {50,3}; click the LUZZI book → routerPush("/en/read/luzzi?book=50&chapter=3") (or locale-less, per how @/i18n/navigation's push is mocked) */ });
it("shelfClickWithNothingStoredOpensGenesisOne", () => { /* → ?book=1&chapter=1 */ });
it("modifiedShelfClickFollowsTheLink", () => { /* ctrlKey click → routerPush not called; the link's href is still /en/read/luzzi */ });
it("chapterPageRemembersItself", () => { /* render chapter page LUZZI genesi 2 → loadLastRead("LUZZI") = {bookNum: 1, chapter: 2} after effects */ });
```

- [ ] **Step 2: Run** `npx vitest run lib/__tests__/last-read.test.ts app/__tests__/pages.test.tsx` — Expected: FAIL on the new tests.
- [ ] **Step 3: Implement** `lib/last-read.ts`, `RememberChapter`, the chapter page line and the `BookCover` handler.
- [ ] **Step 4: Run** `npm test && npm run lint && npm run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** the five files by name — `feat(reader): the shelf opens the chapter last read in each edition`.

---

### Task 5: A lighter edition index page

**Files:**
- Modify: `app/[locale]/read/[edition]/page.tsx`
- Test: `app/__tests__/pages.test.tsx` (`books` describe)

Layout (spec §5, builder's call settled here): testaments as today, then `groupBySection` headings (`GoTo.sections.*`); each book a `<details>` whose `<summary>` is the book's name and its chapter count, holding the chapter links as today (`Books.chapters` label kept). Every chapter link stays in the HTML; the `?book=&chapter=` redirect and the search panel are unchanged.

- [ ] **Step 1: Write the failing tests**

```ts
it("groupsBooksUnderSectionHeadings", () => { /* index Genesi(1), Salmi(23), Matteo(47): headings "Pentateuch", "Wisdom Books", "Gospels" */ });
it("keepsEveryChapterAsALink", () => { /* Genesi 50 + Salmi 150 + Matteo 28 → 228 links matching /\/read\/luzzi\/[^/]+\/\d+$/ */ });
```

- [ ] **Step 2: Run** `npx vitest run app/__tests__/pages.test.tsx` — Expected: FAIL on the new tests.
- [ ] **Step 3: Implement** the layout.
- [ ] **Step 4: Run** `npm test && npm run lint && npm run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `"app/[locale]/read/[edition]/page.tsx" app/__tests__/pages.test.tsx` — `feat(reader): the edition's index grouped by section, chapters folded per book`.

---

### Task 6: Sitemaps that staging never serves

**Files:**
- Create: `lib/sitemap.ts`, `app/sitemap.xml/route.ts`, `app/sitemaps/[file]/route.ts`
- Modify: `app/robots.ts`, `.env.example`, `CLAUDE.md` (Rules: one line on `SITE_CANONICAL_ORIGIN`)
- Test: `lib/__tests__/sitemap.test.ts`, `app/__tests__/robots.test.ts`, `app/__tests__/sitemap-routes.test.ts`

**Interfaces:**
- Produces:
  - `canonicalOrigin(): string | null` — `process.env.SITE_CANONICAL_ORIGIN` without trailing `/`; null when `SITE_NOINDEX === "1"`, unset, or not an `https://` or `http://` URL. Read per call (runtime env).
  - `sitemapIndexXml(origin: string, editionSlugs: string[]): string` — `<sitemapindex>` with `{origin}/sitemaps/{slug}.xml` per edition.
  - `editionSitemapXml(origin: string, editionSlug: string, books: { slug: string; chapters: number }[]): string` — `<urlset>`: for each locale in `LOCALES`, `{origin}/{locale}/read/{edition}` and `{origin}/{locale}/read/{edition}/{book}/{n}` for every chapter. XML-escaped.
- Routes (both `export const dynamic = "force-dynamic"`, `Content-Type: application/xml`): `GET /sitemap.xml` → index of `getEditions()`; `GET /sitemaps/{slug}.xml` → that edition (book slugs via `slugFor` over `getIndex`). Both answer **404** when `canonicalOrigin()` is null; the second also for an unknown edition or a name without `.xml`. The `.xml` extension keeps them outside `proxy.ts`'s matcher.
- `robots()` adds `sitemap: "{origin}/sitemap.xml"` only when `canonicalOrigin()` is not null.

- [ ] **Step 1: Write the failing tests**

```ts
it("noOriginOnStagingOrWhenUnset", () => {
  vi.stubEnv("SITE_CANONICAL_ORIGIN", "https://www.bibleget.io/"); vi.stubEnv("SITE_NOINDEX", "1"); expect(canonicalOrigin()).toBeNull();
  vi.stubEnv("SITE_NOINDEX", ""); expect(canonicalOrigin()).toBe("https://www.bibleget.io");
  vi.stubEnv("SITE_CANONICAL_ORIGIN", ""); expect(canonicalOrigin()).toBeNull();
});
it("editionSitemapListsTheIndexAndEveryChapterPerLocale", () => {
  const xml = editionSitemapXml("https://www.bibleget.io", "nvbse", [{ slug: "genesis", chapters: 2 }]);
  expect(xml.match(/<loc>/g)).toHaveLength(18); // 6 locales × (index + 2 chapters)
  expect(xml).toContain("<loc>https://www.bibleget.io/it/read/nvbse/genesis/2</loc>");
});
// robots.test.ts: SITE_NOINDEX=1 → unchanged disallow, no sitemap; origin set → { rules: allow, sitemap: "https://www.bibleget.io/sitemap.xml" }; origin unset → no sitemap key.
// sitemap-routes.test.ts (mock @/lib/api as pages.test.tsx does): staging → both 404; origin set → index lists /sitemaps/nvbse.xml; /sitemaps/unknown.xml → 404; /sitemaps/nvbse → 404.
```

- [ ] **Step 2: Run** `npx vitest run lib/__tests__/sitemap.test.ts app/__tests__/robots.test.ts app/__tests__/sitemap-routes.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `lib/sitemap.ts`, the two routes and `robots.ts`; document `SITE_CANONICAL_ORIGIN=` in `.env.example` (comment: production origin; leave empty on staging) and in `CLAUDE.md`.
- [ ] **Step 4: Run** `npm test && npm run lint && npm run typecheck && npm run build` — Expected: PASS, and the build lists `/sitemap.xml` and `/sitemaps/[file]` as dynamic.
- [ ] **Step 5: Commit** the files by name — `feat(seo): per-edition sitemaps from the canonical origin, never on staging`.
