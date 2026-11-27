# Persons, Places and Events Indices Implementation Plan (delivery 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each Bible edition's reader offers, in its ⚙ menu, indices of the persons, places and events of CBPPEDR, with
every verse linked into that edition; a docs page describes CBPPEDR.

**Architecture:** The endpoint loads a CBPPEDR checkout into `bpe_*` tables and serves an edition's index at
`/v3/metadata/entities`, resolving CBPPEDR's CBTUDR units to the edition's verses through `btu_link`. The website
fetches it server-side and renders A–Z pages per type.

**Tech Stack:** endpoint PHP 8.4, PostgreSQL, PHPUnit 13 (`BibleGet-I-O/endpoint`, branch from `development`);
website Next.js 16, next-intl, Vitest (`BibleGet-I-O/website`, branch from `main`).

**Spec:** `docs/superpowers/specs/2026-11-27-persons-places-events-design.md` (website repo).

## Global Constraints

- No Bible text and no label words are loaded or stored by this delivery; `bpe_label` keeps only `editions`.
- Unit links used: `btu_link.status IN ('rule','reviewed')`, both kinds (`same`, `corresponding`); drafts never.
- Labelled unit: kept for an edition only if the edition is in its `editions`; for an edition no label of any entry
  names (BLPD, LUZZI, i.e. not in `NVBSE, VGCL, CEI2008, NABRE, DRB`) every labelled unit is left out.
- Wikidata link shown only when `qid_status` is `reviewed` or `adjudicated`; `uncertain` entries are listed with a mark.
- Display name by edition language: `la`→`names.la`, `it`→`names.it`, `en`→`names.en`, other→`names.la`; an empty
  choice falls back to `en`, then `it`.
- Six locales for every message: en, it, es, fr, de, pt.
- Endpoint commits: `composer lint`, `composer analyse` (PHPStan 10) clean. Website: eslint, `tsc --noEmit` clean.
- Commits GPG-signed (`-S`), files staged by name, trailer lines as in the session.

## Review Focus

1. An edition whose `btu_link` has rows for only some books (LaBSE drafts for Tobit, Job, Sirach): the index lists the
   verses of the linked books and omits the rest without error. → Task 2 test `skipsUnitsWithOnlyDraftLinks`.
2. Esther in an edition with both texts: a ref `"1:1a@GREEK"` links with `?tradition=GREEK`. → Task 3 test
   `linksAGreekEstherVerseWithItsTradition`.
3. A name starting with an accented or lower-case letter ("Ìsacco", "ʾEl"): it files under its folded first letter,
   not a letter of its own. → Task 3 test `filesAccentedNamesUnderTheirBaseLetter`.
4. An entry attested in a unit linked to two verses of the edition (a split): both verses listed once each, in order.
   → Task 2 test `listsEveryVerseOfAUnitLinkedToTwo`.
5. The endpoint down or the index empty: the page says the edition has no index yet, the reader keeps working. →
   Task 4 test `saysThereIsNoIndexYetWhenEmpty`.

---

### Task 1 (endpoint): `bpe_*` tables and the CBPPEDR loader

**Files:**
- Create: `migrations/072-cbppedr.sql`, `src/Migrations/Version072Cbppedr.php`
- Create: `src/Cbppedr/CatalogReader.php`, `src/Repositories/EntityRepository.php`, `scripts/load_cbppedr.php`
- Create: `tests/fixtures/cbppedr/data/{persons,places,events}.json` (synthetic: 3 persons, 2 places, 1 event)
- Test: `tests/Unit/Cbppedr/CatalogReaderTest.php`, `tests/Integration/Repositories/EntityRepositoryTest.php`
- Modify: `CLAUDE.md` (route table row and a *Database* line for `bpe_*` and the loader)

**Interfaces:**
- Produces: tables `bpe_entry(id PK, type, kind, names jsonb, description jsonb, qid, qid_status, uncertain bool)`,
  `bpe_attested(entry FK cascade, unit, ord, PK(entry,unit))`, `bpe_label(entry, unit, editions text[], PK(entry,unit))`,
  `bpe_release(id bigserial, loaded_at timestamptz default now(), commit text, counts jsonb)`. Idempotent DDL
  (`IF NOT EXISTS`), no BEGIN/COMMIT.
- Produces: `CatalogReader::read(string $dir): array{entries: list<array{id:string,type:string,kind:string,names:array<string,string>,description:array<string,string>,qid:?string,qid_status:?string,uncertain:bool,attested:list<string>,labels:array<string,list<string>>}>}`
  (`labels`: unit → editions); `uncertain` = the entry's `review` is `"uncertain"`; skips `$comment`.
- Produces: `EntityRepository::replaceAll(array $entries, string $commit): array{entries:int, attested:int, labels:int, unknown_units:list<string>}`
  — one transaction: delete all `bpe_*` rows, insert, append a `bpe_release` row; attested units absent from `btu_unit`
  are still stored but reported in `unknown_units`.
- Script: `php scripts/load_cbppedr.php <cbppedr-dir>`; prints `APP_ENV`, `DB_NAME` to stderr, then the counts; commit from
  `git -C <dir> rev-parse HEAD`. Same header and guard as `scripts/load_cbtudr.php`; not deployed (check the rsync
  excludes cover `scripts/`).

- [ ] **Step 1: Write the failing tests**
  - `CatalogReaderTest::readsEveryCatalogWithLabelsAndUncertainty`: on the fixture, 6 entries; `bpers:fixture.a` has
    `attested == ['btu:gn.1.1','btu:gn.1.2']`, `labels == ['btu:gn.1.2' => ['NVBSE','NABRE']]`; an entry with
    `"review": "uncertain"` has `uncertain === true`; the event's type is `event`.
  - `EntityRepositoryTest::replacesEverythingInOneLoad`: two `replaceAll` calls, the second with 1 entry → `bpe_entry`
    has 1 row, `bpe_release` 2 rows, last commit equals the second argument.
  - `EntityRepositoryTest::reportsUnitsCbtudrDoesNotKnow`: an attested `btu:xx.9.9` absent from `btu_unit` →
    `unknown_units == ['btu:xx.9.9']`, row still stored.
- [ ] **Step 2: Run** `vendor/bin/phpunit --filter 'CatalogReaderTest|EntityRepositoryTest'` — Expected: FAIL (classes missing).
- [ ] **Step 3: Implement** the migration, class, reader, repository and script as specified above. Integration
  tests apply `migrations/072-cbppedr.sql` in `setUp` (twice: idempotent) as `OutlineTest` does with 069.
- [ ] **Step 4: Run** the filter again — PASS; then `composer test:quick`, `composer lint`, `composer analyse` — clean.
- [ ] **Step 5: Commit** `feat(cbppedr): load the persons, places and events catalogs`.

### Task 2 (endpoint): `/v3/metadata/entities`

**Files:**
- Modify: `src/Repositories/EntityRepository.php` (add `index`), `src/Handlers/MetadataHandler.php` (case `entities`),
  `openapi.json` (`/metadata/entities`)
- Test: `tests/Integration/Handlers/EntitiesTest.php`

**Interfaces:**
- Consumes: Task 1 tables; `btu_link` (migration 053).
- Produces: `EntityRepository::index(string $edition, string $type): array{release: ?array{commit:string, loaded_at:string}, entries: list<array{id:string,kind:string,names:array,description:array,qid:?string,qid_status:?string,uncertain:bool,refs:list<array{book:int,chapter:int,verse:int,segment:?string,tradition:?string}>}>}`
- Route: `GET /v3/metadata/entities?version=NVBSE&type=person` (`type` ∈ `person|place|event`), JSON only (other
  content types → 400, as outline). Validation through the handler's existing `editionAndBook($pdo, $params, true)`;
  bad type → `BadRequestException`. Ruling: the spec's path form `/entities/{EDITION}/{type}` becomes query parameters,
  the convention of every other metadata sub-resource.
- Resolution: for each attested unit, the `btu_link` rows of the edition whose `units` contain it, status rule or
  reviewed; skip it when a `bpe_label` row exists for (entry, unit) and the edition is not in `editions` (for BLPD,
  LUZZI this skips every labelled unit). Parse `ref` `"C:V[seg][@TRAD]"` into chapter, verse, segment, tradition;
  dedupe; order by `btu_link.book, btu_link.ord`. Entries ordered by id; those with no refs omitted.

- [ ] **Step 1: Write the failing tests** (`EntitiesTest`, synthetic edition `TEST1` in `btu_link`, fixture entries
  inserted with `EntityRepository::replaceAll`):
  - `resolvesUnitsToTheEditionsVerses`: `refs` of `bpers:fixture.a` == `[{book:1,chapter:1,verse:1,segment:null,tradition:null}, {…verse:2…}]`.
  - `listsEveryVerseOfAUnitLinkedToTwo`: a unit in two links → both refs, in `ord` order.
  - `skipsUnitsWithOnlyDraftLinks`: a unit whose only link is `draft` → no ref; an entry left with none is absent.
  - `leavesOutALabelledUnitForAnEditionTheLabelDoesNotName`: label editions `['NVBSE']`, version `TEST1` → that ref absent.
  - `parsesTheTraditionOfEstherRefs`: link ref `"1:1a@GREEK"` → `segment 'a'`, `tradition 'GREEK'`.
  - `answersEmptyForAnEditionWithoutLinks` and `rejectsAnUnknownType` (400).
- [ ] **Step 2: Run** `vendor/bin/phpunit --filter EntitiesTest` — FAIL.
- [ ] **Step 3: Implement** `index` (one SQL with `unnest(units)` joins, or two queries; PHP parses refs) and the
  handler case; document the route in `openapi.json` with the response schema above.
- [ ] **Step 4: Run** the filter, `composer test:quick`, `composer lint`, `composer analyse` — clean.
- [ ] **Step 5: Commit** `feat(metadata): an edition's index of persons, places or events`; push, open the endpoint PR.

### Task 3 (website): `lib/entities.ts`

**Files:**
- Create: `lib/entities.ts`; Test: `lib/__tests__/entities.test.ts`

**Interfaces:**
- Produces:
  - `type EntityType = "person" | "place" | "event"`; `type EntityRef = {book:number;chapter:number;verse:number;segment:string|null;tradition:"GREEK"|"HEBREW"|null}`;
    `type Entity = {id:string;kind:string;names:Partial<Record<"la"|"it"|"en",string>>;description:Partial<Record<"it"|"en",string>>;qid:string|null;qidStatus:string|null;uncertain:boolean;refs:EntityRef[]}`
  - `getEntityIndex(sigla: string, type: EntityType): Promise<Entity[]>` — `request("/metadata/entities?version=…&type=…", "visitor", { next: { revalidate: 86400 } })`
    (export the needed helper from `lib/api.ts` or add the function there); malformed entries dropped; `NotFound`,
    `ApiUnavailable` → `[]`.
  - `displayName(e: Entity, editionLang: string): string` (Global Constraints rule); `otherName(e, editionLang, locale): string | null`
    (the `it`/`en` name for an `it`/`en` locale when it differs from the display name, else null);
    `description(e, locale): string | null` (`it` for `it`, else `en`); `showsWikidata(e): boolean`.
  - `fold(s: string): string` (NFD, strip combining marks and `ʾʿ'`, lower case); `byLetter(entities, editionLang): Map<string, Entity[]>`
    (keys A–Z upper case in order, entries sorted by folded name then id).
  - `compactRefs(refs: EntityRef[], books: Book[], sigla: string): {book: string; parts: {label: string; href: string}[]}[]`
    — grouped by book in ref order; consecutive verses of one chapter without segment merge into `"11:26–27"`; a later
    verse of the same chapter is `"29"`; href `/read/{sigla}/{slugFor(book)}/{chapter}{?tradition=T}#v{chapter}.{verse}{segment}`.
- [ ] **Step 1: Write the failing tests:** `picksTheNameInTheEditionsLanguage` (la/it/en/es→la; empty la → en);
  `showsWikidataOnlyForReviewedOrAdjudicatedItems` (auto → false); `filesAccentedNamesUnderTheirBaseLetter`
  ("Ìsacco" → I, "Abanà" sorts with "Abana", "ʾEl" → E); `compactsConsecutiveVersesAndLinksThem`
  (Gn 11:26, 11:27, 11:29, 12:1 → `[{book:"Gn", parts:["11:26–27","29","12:1"]}]` with hrefs `…/11#v11.26`);
  `linksAGreekEstherVerseWithItsTradition` (`/read/NVBSE/<slug>/1?tradition=GREEK#v1.1a`).
- [ ] **Step 2: Run** `npx vitest run lib/__tests__/entities.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(indices): an edition's persons, places and events from the API`.

### Task 4 (website): the index pages and the ⚙ menu

**Files:**
- Create: `components/EntityIndex.tsx`; `app/[locale]/read/[edition]/persons/page.tsx`, `places/page.tsx`,
  `events/page.tsx` (each a thin wrapper passing its `EntityType`)
- Modify: `components/ReaderSettings.tsx` (prop `indexHref: (type: EntityType) => string`, group "Indices" with three
  links), `components/ReaderBar.tsx` (pass it), `messages/{en,it,es,fr,de,pt}.json` (`Reader.indices.{title,persons,places,events,uncertain,wikidata,verses,empty,inEdition,back}`)
- Test: `components/__tests__/EntityIndex.test.tsx`, `components/__tests__/ReaderSettings.test.tsx` (extend)

**Interfaces:**
- Consumes: Task 3 exports; `getEditions`, `getIndex`.
- `EntityIndex({ edition, type, letter, entities, books, locale })`: h1 "Persons in {edition}" (`inEdition`), a letter bar of
  links `?letter=X` (only letters present, current one `aria-current="page"`), then for the current letter (default the
  first) a list: display name in `lang` of the edition, other name in brackets, description, the "uncertain" mark,
  Wikidata link (`https://www.wikidata.org/wiki/{qid}`, external), and the compact refs; more than 40 refs → books and
  count in a `<summary>`, refs inside `<details>`. `indexHref` adds `?back=<the reader's path and query>`; the
  page shows a "Back to the reader" link to it when it is a `/read/{edition}/…` path (ignored otherwise). Each page: `generateMetadata` title from messages; not in the sitemap.
- [ ] **Step 1: Write the failing tests:** `listsTheLettersEntryNamesAndLinkedVerses`; `marksUncertainEntriesAndHidesAutomaticWikidataLinks`;
  `foldsLongVerseListsIntoDetails` (41 refs); `saysThereIsNoIndexYetWhenEmpty`; ReaderSettings
  `offersTheEditionsThreeIndices` (three links with the `indexHref` values).
- [ ] **Step 2: Run** `npx vitest run components/__tests__/EntityIndex.test.tsx components/__tests__/ReaderSettings.test.tsx` — FAIL.
- [ ] **Step 3: Implement**, messages in six locales.
- [ ] **Step 4: Run** — PASS; full `npx vitest run`, eslint, `tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat(reader): indices of persons, places and events in the ⚙ menu`.

### Task 5 (website): the CBPPEDR docs page

**Files:**
- Create: `content/docs/en/persons-places-events.mdx`
- Modify: `lib/docs.ts` (after `textual-units`: `{ slug: "persons-places-events", part: "project", langs: EN }`),
  `messages/*.json` (`Docs.pages.persons-places-events.{title,description}` ×6), `content/docs/en/data-and-api.mdx`
  and `contributing.mdx` (link to the page), tests with page counts and neighbours (`lib/__tests__/docs.test.ts`,
  `lib/__tests__/sitemap.test.ts` 108→114, the docs page test's count +6, pager neighbours of `textual-units`/`data-and-api`)
- Title: "Persons, places and events and CBPPEDR".

- [ ] **Step 1: Update the tests** (new slug, counts, neighbours) — run `npx vitest run lib/__tests__/docs.test.ts lib/__tests__/sitemap.test.ts` — FAIL.
- [ ] **Step 2: Write the page** from CBPPEDR's README, `docs/schema.md` and `docs/vocabulary.md` only (every fact
  sourced there, `<Sources>` block linking them): what CBPPEDR is and why (homonyms; one identifier for every edition
  through CBTUDR units), the id scheme with the README's examples, what an entry holds, "better unidentified than
  misidentified", the sources (dictionary and Jerusalem Bible cited by location, no text; TIPNR a pointer only;
  Catholic and peer-reviewed sources as authorities for conjectures), conjectures and their statuses, Wikidata matching
  (automatic, adjudicated, reviewed; the reader links only reviewed and adjudicated items), licences, drafts until
  v1.0.0, and how the reader's indices are built (attested units → the edition's verses through CBTUDR's reviewed and
  rule links; labelled verses only where the edition's text was checked). Wording style as the other docs pages.
- [ ] **Step 3: Run** the full suite, eslint — PASS.
- [ ] **Step 4: Commit** `docs: persons, places and events and CBPPEDR`; push, open the website PR.

### After the tasks

- Final whole-branch review (each repo), CodeRabbit on both PRs, merge when clean (endpoint first).
- Ask the user before loading CBPPEDR into staging's database and before deploying.
