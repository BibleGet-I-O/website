# Documentation, delivery 1: framework, Parts I–II, the reader's "why?" links — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/{locale}/docs` section with its index and the ten pages of Parts I–II in English (the other languages show
the English under a notice), linked from the header, plus four "why?" marks in the reader that open the right section of
*Why editions differ*.

**Architecture:** The romanmartyrology.com framework (`CatholicOS/martyrology-frontend`: `lib/docs.ts`,
`app/[locale]/docs/*`, `components/docs/*`, `mdx-components.tsx`, `next.config.ts`'s `createMDX`), adapted: one ordered
registry; titles and descriptions in the messages (`Docs.pages.<slug>`); content in `content/docs/{lang}/{slug}.mdx`,
compiled at build by `@next/mdx`. Each page records the languages it is written in; the rest render the English. The
reader's marks are one `WhyLink` component whose topic → anchor map lives in `lib/docs.ts`.

**Tech Stack:** Next.js 16.4, next-intl 4, React 19, Tailwind 4 (dark mode through `[data-theme]`, `app/globals.css`),
Vitest + Testing Library; `@next/mdx` ~16.4.6, `@mdx-js/loader` ^3.1.1, `@mdx-js/react` ^3.1.1, `@types/mdx` ^2.0.14,
`remark-gfm` ^4.0.1 (the martyrology's versions).

**Spec:** `docs/superpowers/specs/2026-11-26-documentation-section-design.md` (approved 2026-11-26).

## Global Constraints

- Slugs are English and the same in every language; titles are translated (messages, all six locales).
- Delivery 1 pages, in order: Part I `how-the-bible-reached-us`, `why-editions-differ`; Part II `hebrew-text`,
  `qumran`, `septuagint`, `new-testament-text`, `codex-sinaiticus`, `codex-vaticanus`, `codex-alexandrinus`, `vulgate`.
- Untranslated pages render the English in `<article lang="en">` under a one-line notice in the interface language.
- No Bible text of a copyrighted edition (NABRE, CEI 2008, BLPD, NVBSE) beyond what a citation needs.
- No claims without a source; every page ends with **Sources**; every date and figure is checked against an
  authoritative source (the spec's *Sources and authority*) before review; where scholars disagree, the page says so.
- No manuscript images; link to the holding libraries' digitized manuscripts.
- `ReaderLink`: `book` is the universal number; href `/read/{editionSlug}?book={n}&chapter={c}` (+ `with`, `view`,
  `tradition` as `compareQuery` writes them) + `#v{c}.{v}`; the link keeps its edition in every language.
- "Why?" anchors are fixed ids, kept in every translation: `esther` (inside `greek-and-hebrew`), `missing-verses`,
  `psalm-numbering`, `printed-elsewhere`.
- Marks: the site's muted icon grey, red on hover; tooltip and accessible name per place; shown to visitors and
  readers alike; no setting to hide them.
- `next.config.ts` keeps `output: "standalone"` and the next-intl plugin.
- Six languages for every new message (`i18n/__tests__/messages.test.ts`).
- Stage files explicitly; never `git add -A`.

## Rulings within the spec

- Titles and descriptions live in the messages, not the registry (as the martyrology does): the messages test then
  enforces all six languages. The registry holds order, part and written languages.
- `<article lang>` moves from the layout into each page, since the content language is per page.
- Fixed anchors: `<H2 id="…">` / `<H3 id="…">` in MDX (markdown `##` headings keep their derived `headingId`).
- A Psalm's other number and its mark go in the chapter's `tools` slot (beside the title), not into the heading
  string, so `StickyHead`/`BookPage` keep taking a string.
- The docs get their own sitemap file (`docs.xml`) in the sitemap index.

## Review Focus

- A locale without its own MDX file (every non-English locale today) renders the English page, under the notice, with
  `lang="en"` on the article and the interface (sidebar, pager, notice) in the locale. (Test `untranslatedPageReadsEnglish`.)
- A `ReaderLink` or docs link to a missing page, heading or edition fails the test run, not the reader. (Tests
  `everyDocsLinkResolves`, `everyReaderLinkIsInTheFixture`.)
- The printed-elsewhere mark appears only for a verse printed in this chapter that belongs to another (Wis 12:1 on
  Wis 11, John 7:53 on John 8), never on a compared Psalm verse numbered "9:22". (Test `printedElsewhereNotPsalmOffset`.)
- A Psalm whose Hebrew number equals its own (most, in NABRE) shows no number and no mark. (Test `samePsalmNumberShowsNothing`.)
- An unknown docs slug is a 404 (`dynamicParams = false`), in every locale. (Test `unknownSlugIsNotRegistered` + build route list.)

---

### Task 1: The registry, the toolchain and the messages

**Files:**
- Create: `lib/docs.ts`; test `lib/__tests__/docs.test.ts`
- Modify: `package.json` (the five MDX packages above), `next.config.ts` (`createMDX({ options: { remarkPlugins: ["remark-gfm"] } })`
  wrapped inside the next-intl plugin), `mdx-components.tsx` (create; see Task 2), `messages/{en,it,es,fr,de,pt}.json`
  (`Docs` namespace, `Header.docs`), `i18n/__tests__/messages.test.ts` (only if a cognate needs `SHARED`)

**Interfaces:**
- Produces:
  - `DOC_PARTS = ["text", "manuscripts"] as const`, `type DocPart`
  - `DOC_PAGES: readonly { slug: DocSlug; part: DocPart; langs: readonly Locale[] }[]` — the ten slugs in order, each `langs: ["en"]`
  - `INDEX_LANGS: readonly Locale[] = ["en"]`
  - `findPage(slug: string): DocPage | undefined`
  - `docContentLang(langs: readonly Locale[], locale: Locale): Locale` — the locale if written, else `"en"`
  - `docHref(slug?: string): string` — `"/docs"` or `"/docs/{slug}"` (locale-less, for the i18n `Link`)
  - `neighbours(slug: string): { prev?: DocPage; next?: DocPage }`
  - `slugFromPath(pathname: string): { slug?: string } | null`
  - `headingId(text: string): string` (the martyrology's, unchanged)
  - `type WhyTopic = "esther" | "missing-verses" | "psalm-numbering" | "printed-elsewhere"`; `WHY_TOPICS: readonly WhyTopic[]`;
    `whyHref(topic: WhyTopic): string` → `"/docs/why-editions-differ#" + topic`
- Messages (`Docs`): `index.title` "Documentation", `index.description`, `parts.text` "The Bible and its text",
  `parts.manuscripts` "Manuscripts and traditions", `pages.<slug>.title|description` for the ten, `contents`, `prev`,
  `next`, `sources` "Sources", `untranslated` (per locale, the language named in it: en "This page is not yet available in
  English." is never shown; it "Questa pagina non è ancora disponibile in italiano: ecco il testo inglese."; likewise es,
  fr, de, pt). `Header.docs` "Docs". `Reader.why.{esther,missingVerses,psalmNumbering,printedElsewhere}` (the
  accessible names: "Why do the Greek and Hebrew texts differ?", "Why does this edition lack this verse?", "Why are the
  Psalms numbered two ways?", "Why is this verse printed here?") and `Reader.why.short` "Why?".

- [ ] **Step 1: Failing tests** in `lib/__tests__/docs.test.ts`: `pagesInOrder` (slugs equal the ten above, parts
  `text`×2 then `manuscripts`×8); `slugsUnique`; `unknownSlugIsNotRegistered` (`findPage("editions")` undefined);
  `neighboursAtBothEnds` (first has no prev, last no next, `why-editions-differ` → prev `how-the-bible-reached-us`, next
  `hebrew-text`); `contentLangFallsBackToEnglish` (`docContentLang(["en"], "it")` = `"en"`, `(["en","it"], "it")` = `"it"`);
  `hrefs` (`docHref()` `/docs`, `docHref("qumran")` `/docs/qumran`, `whyHref("esther")` `/docs/why-editions-differ#esther`);
  `slugFromPath` (`/docs` → `{}`, `/docs/qumran` → `{slug:"qumran"}`, `/read/x` → null); `headingId("Cœlum’s Text")` = `"coelums-text"`.
- [ ] **Step 2:** `npx vitest run lib/__tests__/docs.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `lib/docs.ts`; add the packages (`npm install`), `next.config.ts`, the messages.
- [ ] **Step 4:** `npx vitest run lib/__tests__/docs.test.ts i18n/__tests__/messages.test.ts` → PASS.
- [ ] **Step 5:** Commit `feat(docs): the documentation registry, MDX toolchain and messages`.

### Task 2: Routes, layout and MDX components

**Files:**
- Create: `app/[locale]/docs/layout.tsx`, `app/[locale]/docs/page.tsx`, `app/[locale]/docs/[page]/page.tsx`,
  `components/docs/{DocsNav,DocsPager,UntranslatedNotice,Sources,mdx}.tsx`, `components/docs/docs.module.css`,
  `mdx-components.tsx`, `content/docs/en/index.mdx` (a two-line placeholder until Task 5), placeholder `content/docs/en/{slug}.mdx`
  for the ten (an `# Title` line each; Tasks 5–7 write them); tests `components/docs/__tests__/{DocsNav,DocsPager,UntranslatedNotice,mdx-components}.test.tsx`,
  `lib/__tests__/docs-content.test.ts`
- Modify: `components/SiteHeader.tsx` (a `Docs` link before `API` in `NavMenu`), `lib/sitemap.ts` + `app/sitemaps/[file]/route.ts`
  + `app/sitemap.xml/route.ts` (`docsSitemapXml(origin): string` listing `/{locale}/docs` and `/{locale}/docs/{slug}` for every
  locale and page; the index lists `docs.xml`), `lib/__tests__/sitemap.test.ts`

**Interfaces:**
- Consumes: Task 1's registry and messages.
- Produces: `docsComponents: MDXComponents` (`Rubric`, `Sources`, `H2`, `H3`, `ReaderLink` from Task 3) in `components/docs/mdx.tsx`;
  `components` in `mdx-components.tsx` (`h2`/`h3` self-linking with `headingId`; `a` → i18n `Link` for `/` paths, `rel="external"`
  otherwise); `H2/H3({ id, children })` (explicit id, self-linking).
- Pages: `generateStaticParams` = every locale × page; `dynamicParams = false`; `generateMetadata` titles from
  `Docs.pages.<slug>.title` with the site's metadata pattern; the page imports
  `@/content/docs/${docContentLang(page.langs, locale)}/${slug}.mdx`, renders `<article lang={contentLang}>`, the
  `UntranslatedNotice` when `contentLang !== locale`, the content, `DocsPager`. The index lists each part with its
  pages' titles and descriptions. Layout: sidebar (`DocsNav`) + main column, as the martyrology's.
- CSS: the martyrology's `docs.module.css`, its dark rules rewritten for this site's theme: the `@media (prefers-color-scheme: dark)`
  rules apply under `:root:not([data-theme="light"])` and again under `[data-theme="dark"]`; rubric `#a3161b` / `red-400`.

- [ ] **Step 1: Failing tests:** `DocsNav` (both parts listed, current page `aria-current="page"`, Italian titles under `it`,
  the "Contents" button folds the list); `DocsPager` (prev/next titles and hrefs; none on a single page); `UntranslatedNotice`
  (the Italian sentence under `it`); `mdx-components` (`## Il testo ebraico` → `id="il-testo-ebraico"` self-link; `<H2 id="esther">Esther</H2>` → `id="esther"`;
  `/docs/qumran` through `Link`, `https://…` with `rel="external"`); `docs-content` (`content/docs/en` has exactly
  `index` + the ten; every other `content/docs/{lang}` file is a page whose `langs` includes `lang`, and every `langs` entry has
  its file); `untranslatedPageReadsEnglish` (render `[page]/page.tsx` for `it`/`qumran` with the MDX import mocked: the
  article has `lang="en"`, the notice shows, the pager is Italian); `sitemap` (`docsSitemapXml` has 66 `<loc>`s: 6 × (index + 10)).
- [ ] **Step 2:** `npx vitest run components/docs lib/__tests__/docs-content.test.ts lib/__tests__/sitemap.test.ts` → FAIL.
- [ ] **Step 3:** Implement the files above.
- [ ] **Step 4:** Tests → PASS; `npm run build` lists `/[locale]/docs` and `/[locale]/docs/[page]` with 66 prerendered paths.
- [ ] **Step 5:** Commit `feat(docs): the documentation section's pages, navigation and sitemap`.

### Task 3: `ReaderLink` and the editions fixture

**Files:**
- Create: `components/docs/ReaderLink.tsx`; `lib/__tests__/fixtures/editions.json` (`{ "<SIGLA>": [universal book numbers] }`
  for every edition of `/metadata/bibleversions`, from `/metadata/versionindex`; no text; the file's sibling `README.md`
  gives the one `curl`+`jq` command that refreshes it); tests `components/docs/__tests__/ReaderLink.test.tsx`,
  `lib/__tests__/docs-reader-links.test.ts`
- Modify: `components/docs/mdx.tsx` (register `ReaderLink`)

**Interfaces:**
- Produces: `ReaderLink({ edition, book, chapter, verse?, with?, view?, tradition?, children }: { edition: string; book: number;
  chapter: number; verse?: number; with?: string[]; view?: View; tradition?: "GREEK" | "HEBREW"; children: ReactNode })`
  and `readerHref(p): string` (exported, pure). Uses `editionSlug` (`lib/slug.ts`) and `compareQuery` (`lib/compare.ts`),
  joined as `?book=…&chapter=…&with=…`.

- [ ] **Step 1: Failing tests:** `readerHref({edition:"NABRE", book:27, chapter:11, verse:26})` =
  `/read/nabre?book=27&chapter=11#v11.26`; with `with:["VGCL"], view:"interlinear"` →
  `/read/nabre?book=27&chapter=11&with=VGCL&view=interlinear#v11.26`; `everyReaderLinkIsInTheFixture` (scan every
  `content/docs/**/*.mdx` for `<ReaderLink …>`: its `edition` is a fixture key, its `book` in that edition's list, each `with` too).
- [ ] **Step 2:** `npx vitest run components/docs/__tests__/ReaderLink.test.tsx lib/__tests__/docs-reader-links.test.ts` → FAIL.
- [ ] **Step 3:** Implement; write the fixture from staging's API (`https://query.bibleget.io/dev/v3/metadata/...` with the
  developer's own key, never printed or committed).
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(docs): links from the docs into the reader`.

### Task 4: The reader's "why?" marks

**Files:**
- Create: `components/WhyLink.tsx`, `lib/why.ts`; tests `components/__tests__/WhyLink.test.tsx`, `lib/__tests__/why.test.ts`
- Modify: `components/Spread.tsx` (the rubric heads: a mark after each name, topic `esther`; the head of a compared
  column in Psalms whose rows carry another psalm's number: topic `psalm-numbering`), `components/GapNote.tsx` (the short
  "Why?" after the note, `missing-verses`), `lib/formatted.tsx` (`renderVerse({ …, why?: ReactNode })`: rendered right
  after the verse number), `components/VerseLines.tsx` and `components/BookPage.tsx` (pass `why` when
  `printedElsewhere(row, chapter)`), `app/[locale]/read/[edition]/[book]/[chapter]/page.tsx` (in Psalms, when
  `otherPsalmNumbers(rows, chapter)` is non-empty, the `tools` slot shows "(23)" / "(9–10)" with the mark), existing
  tests of those components as they change.

**Interfaces:**
- Consumes: `whyHref`, `WhyTopic` (Task 1); `psalmChapters` (`lib/parallel.ts`), `PSALMS`.
- Produces: `WhyLink({ topic, short? }: { topic: WhyTopic; short?: boolean })` — an i18n `Link` to `whyHref(topic)`, an
  inline ⓘ icon (or the text `Reader.why.short` when `short`), `aria-label` and `title` = `Reader.why.<camelTopic>`, classes
  `text-slate-400 hover:text-red-700 dark:text-slate-500 dark:hover:text-red-400`.
  `printedElsewhere(row: VerseRow, chapter: number): boolean` — `row.printedChapter === chapter && row.chapter !== chapter`.
  `otherPsalmNumbers(rows: VerseRow[], chapter: number): number[]` — `psalmChapters(rows)` without `chapter`; `[]` when the
  rows report none. `psalmNote(numbers: number[]): string` — `"(23)"`, `"(9–10)"`.

- [ ] **Step 1: Failing tests:** `WhyLink` (href `/docs/why-editions-differ#esther`, accessible name, tooltip; `short` shows "Why?");
  `printedElsewhereNotPsalmOffset` (Wis 12:1 with `printedChapter` 11 on chapter 11 → true; a VGCL row chapter 9 beside
  NABRE Psalm 10, `printedChapter` null → false; an ordinary verse → false); `samePsalmNumberShowsNothing`
  (`otherPsalmNumbers` of rows reporting `psalmHebrew` "23:1" on chapter 23 → `[]`; on chapter 22 → `[23]`; VGCL 9 → `[10]`
  when 9 and 10 reported); `psalmNote([9,10])` = `"(9–10)"`; `GapNote` shows the link; `Spread` with Esther's two sides shows
  two marks, with no rubric none; `renderVerse` puts `why` after the number.
- [ ] **Step 2:** `npx vitest run components/__tests__/WhyLink.test.tsx lib/__tests__/why.test.ts components/__tests__/Spread.test.tsx components/__tests__/GapNote.test.tsx lib/__tests__/formatted.test.tsx` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** → PASS, and the whole suite (`npm test`).
- [ ] **Step 5:** Commit `feat(reader): "why?" marks where editions differ, linked to the docs`.

### Task 5: Part I and the index (content)

**Files:** `content/docs/en/index.mdx`, `content/docs/en/how-the-bible-reached-us.mdx`, `content/docs/en/why-editions-differ.mdx`;
test `lib/__tests__/docs-links.test.ts` (create with this task: the martyrology's, extended so `<H2 id>`/`<H3 id>` count as
anchors and every `WHY_TOPICS` anchor must exist in `en/why-editions-differ.mdx` — `everyDocsLinkResolves`, `whyAnchorsExist`).

- `index`: who the section is for (general readers: Part I; students: Part II), what is planned (editions, the project).
- `how-the-bible-reached-us` (general reader, one page): the spec's Part I item 1, each step linking its Part II page.
- `why-editions-differ`, sections in this order: chapters and verses numbered differently (a `ReaderLink` example);
  `<H2 id="psalm-numbering">` the Psalms' two numberings; `<H2 id="greek-and-hebrew">` books with a Greek and a Hebrew form,
  with `<H3 id="esther">`, Daniel's additions, Jeremiah; `<H2 id="missing-verses">` a verse one edition has and another lacks;
  `<H2 id="printed-elsewhere">` a verse printed in another chapter (Wis 12:1 at the end of Wis 11 in NABRE, John 7:53);
  Sirach's prologue; notes and introductions (for signed-in readers). Each with a `ReaderLink` to where it shows.
- [ ] **Step 1:** Write the links test; run it → FAIL (anchors missing).
- [ ] **Step 2:** Research: the endpoint wiki pages the spec lists (`Versification-Differences`, `Psalms-Numbering`,
  `Esther-Greek-and-Hebrew-Variants`, `Jeremiah-Textual-Traditions`, `Daniel-Deuterocanonical-Additions`,
  `Deuterocanonical-Books`), *Dei Verbum*, Trent's *Sacrosancta*; note each fact's source.
- [ ] **Step 3:** Write the three pages, each ending with `<Sources>`; every date/figure traceable to a listed source.
- [ ] **Step 4:** `npx vitest run lib/__tests__/docs-links.test.ts lib/__tests__/docs-reader-links.test.ts` → PASS.
- [ ] **Step 5:** Commit `docs(content): Part I, the Bible and its text`.

### Task 6: Part II, the texts and versions (content)

**Files:** `content/docs/en/{hebrew-text,qumran,septuagint,new-testament-text}.mdx`.
Each per the spec's Part II items 3–6. Authorities: the Leon Levy Dead Sea Scrolls Digital Library (IAA), the Israel Museum
(Aleppo Codex, Great Isaiah Scroll), the National Library of Russia (Leningrad Codex), the Deutsche Bibelgesellschaft
(BHS, BHQ, Nestle–Aland, UBS), the Göttingen Septuaginta-Unternehmen, the PBC's *Interpretation of the Bible in the Church*,
Catholic or peer-reviewed scholarship; others as leads only.
- [ ] **Step 1:** Research, noting each fact's source (discovery years, cave count, codex dates, edition years).
- [ ] **Step 2:** Write the four pages, each ending with `<Sources>`; disagreements stated.
- [ ] **Step 3:** `npx vitest run lib/__tests__/docs-links.test.ts lib/__tests__/docs-reader-links.test.ts lib/__tests__/docs-content.test.ts` → PASS.
- [ ] **Step 4:** Commit `docs(content): Part II, the Hebrew text, Qumran, the Septuagint, the New Testament`.

### Task 7: Part II, the codices and the Vulgate (content)

**Files:** `content/docs/en/{codex-sinaiticus,codex-vaticanus,codex-alexandrinus,vulgate}.mdx`.
Each per the spec's Part II items 7–10. Authorities: codexsinaiticus.org and the British Library; the Biblioteca Apostolica
Vaticana (Vat. gr. 1209, DigiVatLib); the British Library (Royal MS 1 D V–VIII); for the Vulgate, Trent's decree, the
Sixtine and Clementine editions, the Stuttgart *Biblia Sacra*, *Scripturarum thesaurus* (1979), *Liturgiam authenticam* (2001).
- [ ] **Step 1:** Research, noting each fact's source (centuries, leaf counts, holders, dates of acquisition, edition years).
- [ ] **Step 2:** Write the four pages, each ending with `<Sources>`, linking the digitized manuscripts.
- [ ] **Step 3:** Same tests as Task 6 → PASS.
- [ ] **Step 4:** Commit `docs(content): Part II, the great codices and the Vulgate`.

### Task 8: Check and hand over

- [ ] **Step 1:** `npm run lint && npx tsc --noEmit && npm test && npm run build` → all pass; the build's route list shows the 66 docs paths.
- [ ] **Step 2:** In a browser (Playwright, then close it): `/en/docs`, a page in English and in Italian (the notice, `lang="en"`),
  light and dark, a phone width (the sidebar folds); in the reader: Esther with both texts, a comparison gap, VGCL Psalm 9,
  NABRE Wis 11 — each mark opens its section.
- [ ] **Step 3:** Push `feat/docs`, open the PR (spec and plan linked; the pages listed for the user's content review).
