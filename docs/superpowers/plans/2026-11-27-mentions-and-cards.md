# Mentions and cards in the reader: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The NVBSE reader marks the persons and places a verse names, opens a card on hover or tap, and offers an
Annotations switch, from CBPPEDR mentions served by the endpoint.

**Architecture:** CBPPEDR (Python, stdlib) proposes Latin forms, matches them in every NVBSE verse's `text_plain`
(a private export), and publishes positions and hashes (`data/mentions/nvbse.json`) and card details
(`data/details.json`). The endpoint's loader checks each verse's hash, converts plain-text positions to code points of
the formatted `text` (`PlainTextMap`), and the quote route adds `mentions` per row and `entities` on `mentions=1`.
The website renders marks through `renderVerse`'s insert mechanism, a client card layer, and a localStorage switch.

**Tech stack:** Python 3 `unittest` (CBPPEDR); PHP 8.4, PostgreSQL, PHPUnit 13, PHPStan 10, PHPCS (endpoint);
Next.js, React, TypeScript, Vitest, Leaflet (website).

**Spec:** `docs/superpowers/specs/2026-11-27-mentions-and-cards-design.md` (website repo).

## Global constraints

- No copyrighted text in any public repository, test fixture or commit message: NVBSE text, its exports and the review
  report stay in `~/development/BibleGet-I-O/data-local/cbppedr/`; test fixtures use invented Latin sentences.
- Positions in CBPPEDR: UTF-16 code units of `text_plain`; `check` = first 8 hex digits of SHA-256 of the span's
  UTF-8 words; `hash` = SHA-256 hex of the row's `text_plain` (UTF-8).
- Positions served by the endpoint: code points of the row's formatted `text` (what `renderVerse` counts).
- A mention has `entry` (settled) xor `candidates` (one or more: under review).
- Images, Wikipedia titles and coordinates only for entries with `qid_status` `reviewed` or `adjudicated`; coordinates
  only when the Wikidata item has exactly one P625.
- Marks on the chapter page and both comparisons; never in search results.
- Switch: label "Annotations", off by default, `localStorage` key `reader.annotations` (`"1"`/`"0"`), synced across
  tabs, drawn only when the chapter has mentions.
- Card timing: open after 300 ms hover, close 200 ms after leaving; tap/click pins, second tap unpins, Escape or an
  outside click closes and returns focus.
- Review line, exact copy (en): "This identification is still under review".
- Repos: commits GPG-signed (`-S`) with the session trailers; stage files by name; PRs, merged only on a clean
  CodeRabbit review. Website: no Prettier. Endpoint: `composer lint`, `composer analyse`, `composer test` green.
  CBPPEDR: `python -m unittest` in `scripts/` and `python scripts/validate.py` before each commit.

## Review focus

1. A mention whose words cross a tag, a poetry line break or a note marker: rendered as several pieces, one card,
   focus on the first piece only (Task 12, `splitsAMarkAcrossALineAndANoteMarker`).
2. A visitor's chapter capped at 30 rows: mentions only for the rows sent and `entities` only for the ids they name
   (Task 10, `sendsOnlyTheEntitiesOfTheRowsGiven`).
3. NVBSE as the second edition of a comparison, and a non-NVBSE side: marks only on the NVBSE side (Task 15,
   `marksOnlyTheNovaVulgataSide`).
4. An NVBSE row whose text changed after the load: no marks on that row, never misplaced ones (Task 10,
   `dropsTheMentionsOfARowWhoseTextChanged`).
5. Storage blocked or empty on first paint: the switch stays off, no tint or (?) flashes, no crash (Task 13,
   `staysOffWhenStorageThrows`).

---

## Part A: CBPPEDR (`~/development/CatholicOS_org/cbppedr`, branch `feat/mentions`)

### Task 1: Latin forms

**Files:** Create `scripts/forms.py`, `scripts/test_forms.py`, `data/curated/forms.json`; modify `docs/schema.md`.

**Interfaces:**
- Produces: `propose(name: str) -> list[str]` (the name first, then its case forms, no duplicates);
  `build(catalogs: dict[str, dict], existing: dict[str, list[str]]) -> dict[str, list[str]]` (by entry id; an id
  already in `existing` is kept as is); file shape `{"$comment": "…", "forms": {"<id>": ["Petrus", "Petri", …]}}`.

- [ ] **Step 1: Write the failing tests** in `test_forms.py`:
  - `test_second_declension_us`: `propose("Petrus") == ["Petrus", "Petri", "Petro", "Petrum", "Petre"]`.
  - `test_first_declension_a`: `propose("Maria") == ["Maria", "Mariae", "Mariam"]`.
  - `test_es_names`: `propose("Moyses") == ["Moyses", "Moysi", "Moysen", "Moyse"]`.
  - `test_indeclinable_hebrew`: `propose("Abraham") == ["Abraham"]`; `propose("Iacob") == ["Iacob"]`.
  - `test_multiword_declines_head_only`: `propose("Ioannes Baptista")[0] == "Ioannes Baptista"`.
  - `test_build_keeps_hand_corrected`: `build({...}, {"bpers:x": ["X"]})["bpers:x"] == ["X"]`.
  - `test_build_adds_nvbse_labels_of_as_name`: a `labels` unit `{"as": "name", "editions": {"NVBSE": "Cephas"}}`
    adds `"Cephas"` (and its forms); a `designation` label is added verbatim, undeclined.
- [ ] **Step 2: Run** `cd scripts && python -m unittest test_forms -v`. Expected: FAIL (`ModuleNotFoundError`).
- [ ] **Step 3: Implement** `forms.py`: ending rules `-us`(i,o,um,e), `-a`(ae,am), `-es`(i,en,e), `-as`(ae,am),
  `-is`(is kept; no rule), consonant/`-am`/`-el`/`-on`/`-ath` endings indeclinable; a `main()` that reads
  `data/{persons,places}.json`, merges into `data/curated/forms.json`, sorts ids.
- [ ] **Step 4: Run** the tests. Expected: PASS. Run `python scripts/forms.py`, then `python scripts/validate.py`.
- [ ] **Step 5:** `docs/schema.md` gets a `forms.json` row in the curated table. Commit
  (`feat(forms): Latin forms to find each name in the text`).

### Task 2: Plain-text export by row

**Files:** Modify `scripts/export_texts.py`; create `scripts/test_export_texts.py`.

**Interfaces:**
- Produces: `export_texts.py --plain NVBSE` writes private `texts/NVBSE-plain.json`:
  `{"<unit key>": {"text": "<text_plain as stored>", "hash": "<sha256 hex>"}}`, unit key `btu:…`, or `btu:…@GREEK`
  / `@HEBREW` when the unit maps to rows of both Esther texts; a unit mapped to several rows of one text is left
  out and counted on stderr. `plain_by_unit(rows, refs) -> tuple[dict[str, dict], int]`.

- [ ] **Step 1: Failing tests:** `test_plain_keeps_the_stored_text` (no tag stripping, no unescape: the column is
  read as is), `test_esther_gets_both_traditions`, `test_unit_over_two_rows_is_skipped`, `test_hash_is_sha256_hex`.
- [ ] **Step 2: Run** `python -m unittest test_export_texts -v`. Expected: FAIL.
- [ ] **Step 3: Implement** `plain_by_unit`; `--plain` selects `text_plain` and `text_tradition` in the SQL.
- [ ] **Step 4: Run** tests: PASS. Commit (`feat(export): the plain text by unit, with its hash`).

### Task 3: The matcher

**Files:** Create `scripts/extract_mentions.py`, `scripts/test_extract_mentions.py`, `scripts/stoplist_la.txt`.

**Interfaces:**
- Consumes: `forms.json` (Task 1), the export (Task 2), catalogs' `attested`.
- Produces: `utf16(s: str, i: int) -> int`; `check(span: str) -> str`;
  `find(text: str, forms: dict[str, list[str]]) -> list[tuple[int, int, str]]` (start, end in code points, entry id;
  whole words; names case-sensitive on the initial);
  `resolve(hits, attested_here: set[str], shared: dict[str, set[str]], stop: set[str]) -> list[dict]` (mentions in
  the file's shape with UTF-16 positions); `extract(texts, forms, catalogs, stop) -> tuple[dict, dict]`
  (public file body, private report).

- [ ] **Step 1: Failing tests** (invented sentences only):
  - `test_unique_name_is_settled`: "Et dixit Petrus ad eos" with forms `{bpers:petrus: ["Petrus"]}` gives
    `[{start: 9, end: 15, entry: "bpers:petrus", check: check("Petrus")}]`.
  - `test_shared_name_settled_by_attestation`: two ids with form "Zacharias", one attested in the unit, gives
    `entry` of that one.
  - `test_shared_name_unattested_is_under_review`: neither attested gives `candidates` of both, sorted.
  - `test_stop_word_form_is_a_candidate_of_one`: a form in the stop list gives `candidates: [id]`.
  - `test_whole_words_only`: "Petrusque" is not a hit for "Petrus"; "Petri" is.
  - `test_initial_capital`: "petrus" is not a hit; a designation label "rex Aegypti" matches lower-case.
  - `test_nested_spans_kept_crossing_dropped`: "rex Aegypti" (person label) and "Aegypti" (place) both kept;
    two crossing spans both dropped and listed in the report's `crossing`.
  - `test_positions_are_utf16`: a text with "𝔄" (astral) before the name shifts `start` by 2.
  - `test_attested_entry_not_found_is_reported`: listed in the report's `unmatched`.
- [ ] **Step 2: Run** `python -m unittest test_extract_mentions -v`. Expected: FAIL.
- [ ] **Step 3: Implement.** Longest form first at each position; a person/place pair sharing a form counts as
  shared. Only `attested` (cited) counts for settling, not `mentioned` (Task 5).
- [ ] **Step 4: Run:** PASS. Commit (`feat(mentions): find each name in every verse`).

### Task 4: Generate and validate the mentions file

**Files:** Create `data/mentions/nvbse.json`, `data/mentions/nvbse_curated.json` (empty `units`); modify
`scripts/validate.py`, `scripts/test_validate.py`, `docs/schema.md`, `README.md`.

- [ ] **Step 1: Failing tests** in `test_validate.py`: `test_mention_needs_entry_xor_candidates`,
  `test_mention_ids_must_exist`, `test_mention_span_inside_text` (`end > start`, `start >= 0`),
  `test_curated_unit_wins` (helper `merged_mentions(generated, curated) -> dict` in `extract_mentions.py`).
- [ ] **Step 2: Run:** FAIL. **Step 3:** implement the checks and `merged_mentions`.
- [ ] **Step 4: Export from staging** (hashes must match the target): open the tunnel
  `ssh -N -L 15432:127.0.0.1:5432 ubuntu@catholicdigitalcommons.org &` (save `$!`), run `export_texts.py --plain NVBSE`
  with `PSQL` built from the server's `.env.staging` sourced inside the command (never printed), kill the tunnel by
  PID. Then `python scripts/extract_mentions.py` → public file + private report in `data-local/cbppedr/mentions/`.
  Expected: report prints settled / under-review / unmatched / crossing counts; `validate.py` clean.
- [ ] **Step 5:** `git grep` the new files for any run of 4+ consecutive Latin words (none: the file holds ids,
  numbers, hashes). Commit the data separately (`data(mentions): NVBSE mentions, <settled> settled, <n> under review`).

### Task 5: New attestations from settled mentions

**Files:** Modify `scripts/build_catalog.py`, `scripts/test_build_catalog.py`, `scripts/validate.py`, `docs/schema.md`;
regenerate `data/{persons,places,events}.json`, `docs/build-report.md`.

**Interfaces:** Produces an optional entry field `mentioned: [unit…]` (settled mentions in units not in
`attested`, in canonical unit order); `build(..., mentions: dict | None = None)`.

- [ ] **Step 1: Failing tests:** `test_settled_mention_outside_attested_is_mentioned`,
  `test_candidates_add_nothing`, `test_attested_unit_not_repeated_in_mentioned`, `test_esther_tradition_suffix_dropped`
  (`btu:est.1.1@HEBREW` → `btu:est.1.1`), `test_unattested_removal_also_removes_mentioned` (a reviewed removal in
  `unattested.json` wins).
- [ ] **Step 2–4:** run (FAIL), implement, run (PASS); `python scripts/build_catalog.py`; `validate.py` clean.
- [ ] **Step 5:** commit code, then data. Push `feat/mentions`; open PR A (Tasks 1–5).

### Task 6: Card details

**Files:** Create `scripts/details.py`, `scripts/test_details.py`, `data/details.json`; modify `scripts/validate.py`,
`docs/schema.md`. Branch `feat/details` (from `main` after PR A merges).

**Interfaces:** `detail(entity: dict, wikidata_item: dict, commons: dict | None) -> dict | None`; file
`{"$comment", "entries": {"<id>": {"image"?: {file, author, license, license_url}, "wikipedia"?: {lang: title},
"coords"?: {lat, lon}}}}`, languages `la it en es fr de pt`.

- [ ] **Step 1: Failing tests:** `test_only_reviewed_or_adjudicated`, `test_image_from_p18_with_commons_credit`,
  `test_two_coordinates_give_none`, `test_wikipedia_titles_only_for_known_languages`, `test_empty_detail_omitted`.
- [ ] **Step 2–4:** FAIL, implement (fetch through `wikidata.py`'s cached, 1 request/s client; Commons
  `extmetadata` for `Artist` (HTML stripped), `LicenseShortName`, `LicenseUrl`), PASS; run `python scripts/details.py`;
  `validate.py` checks ids and `lat`/`lon` ranges.
- [ ] **Step 5:** commit code and data; PR B.

## Part B: endpoint (`~/development/BibleGet-I-O/endpoint`, branch `feat/cbppedr-mentions` from `development`)

### Task 7: Migration 073

**Files:** Create `migrations/073-cbppedr-mentions.sql`, `src/Migrations/Version073CbppedrMentions.php`; modify
`tests/Integration/Handlers/Ops/MigrateHandlerTest.php` (count), `CLAUDE.md` (the `bpe_*` line).

- `ALTER TABLE bpe_attested ADD COLUMN IF NOT EXISTS mentioned boolean NOT NULL DEFAULT false;`
- `bpe_mention (edition varchar(16), book smallint, chapter int, verse int, segment text NULL, tradition text NULL,
  unit text, plain_hash text, start_cp int, end_cp int, entry text NULL REFERENCES bpe_entry ON DELETE CASCADE,
  candidates text[] NULL, CHECK ((entry IS NULL) <> (candidates IS NULL)))`, index on `(edition, book, chapter)`.
- `bpe_detail (entry text PRIMARY KEY REFERENCES bpe_entry ON DELETE CASCADE, image jsonb, wikipedia jsonb,
  coords jsonb)`.
- `bpe_verse_count (edition varchar(16), entry text REFERENCES bpe_entry ON DELETE CASCADE, verses int,
  PRIMARY KEY (edition, entry))`.

- [ ] Steps: failing `MigrateHandlerTest` count → write SQL and class → `composer db:migrate` locally → tests PASS →
  commit (`feat(db): CBPPEDR mentions, details and verse counts (073)`).

### Task 8: `PlainTextMap`

**Files:** Create `src/Util/PlainTextMap.php`, `tests/Unit/Util/PlainTextMapTest.php`,
`tests/Integration/Util/PlainTextMapNvbseTest.php` (group `slow`).

**Interfaces:** `PlainTextMap::of(string $text): self`; `->plain(): string` (equals `bibleget_plain_text($text)`);
`->toText(int $startUtf16, int $endUtf16): ?array{0:int,1:int}` (code points of `$text`, snapped outward; null
when out of range).

- [ ] **Step 1: Failing tests:** `testDropsVariantSigns`, `testDropsInlineTags` (text `et <i>Pe</i>trus`: plain `et Petrus`, `toText(3, 9) === [3, 16]`, the whole
  `<i>Pe</i>trus`), `testLineTagsBecomeSpaces`,
  `testCollapsesWhitespaceAndTrims`, `testCountsUtf16In` (astral char), `testSnapsOutOfATag`, `testOutOfRangeIsNull`.
  Integration: `testEveryNvbseRowRoundTrips`: for every NVBSE row, `of($text)->plain() === $text_plain` and, for
  each word of the plain text, `PlainTextMap::of(mb_substr($text, a, b-a))->plain()` equals the word.
- [ ] **Step 2: Run** `vendor/bin/phpunit tests/Unit/Util/PlainTextMapTest.php`. Expected: FAIL (class not found).
- [ ] **Step 3: Implement** by walking `$text` once, applying migration 034's rules in their order (signs, inline
  tags, line tags/`speaker`/`<br>` to space, whitespace collapse, trim), recording for each plain code unit its source
  code point.
- [ ] **Step 4:** unit and integration PASS; `composer analyse`, `composer lint`. Commit.

### Task 9: Loader

**Files:** Modify `src/Cbppedr/CatalogReader.php`, `src/Repositories/EntityRepository.php` (`replaceAll`),
`scripts/load_cbppedr.php`; create `src/Cbppedr/MentionLoader.php`; tests `tests/Unit/Cbppedr/CatalogReaderTest.php`,
`tests/Integration/Cbppedr/MentionLoaderTest.php`, fixtures under `tests/fixtures/cbppedr/` (invented text).

**Interfaces:**
- `CatalogReader::read($dir)` also returns `mentions` (curated over generated, by unit key) and `details`; entries
  carry `mentioned`.
- `MentionLoader::load(\PDO $db, string $edition, array $mentions): array{loaded:int, stale:list<string>,
  bad_check:list<string>, no_row:list<string>}`; rows found through `btu_link` (status `rule`/`reviewed`) whose `units`
  contains the unit, tradition from the key suffix; reuses `EntityRepository::ref()` (made `public static`).
- After loading, `bpe_verse_count` is filled from `EntityRepository::index($edition, $type)` for each edition with
  mentions.

- [ ] **Step 1: Failing tests:** `testReadsCuratedOverGenerated`, `testReadsMentionedUnits`,
  `testSkipsAUnitWhoseHashDiffers`, `testSkipsASpanWhoseCheckDiffers`, `testReportsAUnitWithNoRow`,
  `testConvertsPositionsToTextCodePoints`, `testLoadsEstherTraditionsSeparately`, `testMentionedUnitsAreInTheIndex`,
  `testCountsVersesPerEntry`, `testReplacesEverythingInOneTransaction`.
- [ ] **Step 2–4:** FAIL, implement, PASS; the script prints the four counts and lists. Commit.

### Task 10: `mentions=1` on the quote

**Files:** Create `src/Services/QuoteMentions.php`, `src/Repositories/MentionRepository.php`,
`tests/Unit/Services/QuoteMentionsTest.php`, `tests/Integration/Handlers/QuoteMentionsTest.php`; modify
`src/Handlers/QuoteHandler.php` (after notes), `openapi.json`.

**Interfaces:**
- `QuoteMentions::requested(array $params): bool` (`mentions=1|true`); JSON only (other formats ignore it).
- `QuoteMentions::attach(list<array> $results, MentionRepository $repo): array{0: list<array>, 1: array<string,
  array>}`: each row of an edition with mentions gets `mentions: list<{start:int,end:int,entry?:string,
  candidates?:list<string>}>`; rows whose current `encode(sha256(convert_to(text_plain,'UTF8')),'hex')` differs from
  `plain_hash` get none; `entities` keyed by id: `{type, kind, names, description, uncertain, verse_count,
  image?, wikipedia?, coords?}` (`verse_count` from `bpe_verse_count` for the row's edition).
- Response body: `entities` (object, even empty) only when requested.

- [ ] **Step 1: Failing tests:** `testAddsMentionsToNvbseRows`, `testOtherEditionsGetNone`,
  `sendsOnlyTheEntitiesOfTheRowsGiven` (a 30-row visitor cap), `dropsTheMentionsOfARowWhoseTextChanged`,
  `testWithoutTheParameterNothingChanges`, `testCandidatesEntitiesAreIncluded`.
- [ ] **Step 2–4:** FAIL, implement, PASS. `openapi.json`: parameter `mentions`, row `mentions`, top-level
  `entities` schemas. Full `composer test`, `analyse`, `lint`. Push; PR (Tasks 7–10).

## Part C: website (worktree `wt-docs`, branch `feat/mentions` from `main`)

### Task 11: Data

**Files:** Modify `lib/types.ts`, `lib/api.ts`, `lib/__tests__/api.test.ts`; create `lib/mentions.ts`.

**Interfaces:** `type Mention = { start: number; end: number; entry?: string; candidates?: string[] }`;
`VerseRow.mentions?: Mention[]`; `type MentionEntity = { id; type: "person"|"place"; kind; names; description;
uncertain; verseCount; image?: {file, author, license, licenseUrl}; wikipedia?: Record<string,string>;
coords?: {lat, lon} }`; `Chapter.entities?: Record<string, MentionEntity>`; `ChapterParams.mentions?: boolean`;
`MENTION_EDITIONS = new Set(["NVBSE"])`.

- [ ] Tests: `asksForMentionsOnlyWhenTheEditionHasThem`, `keepsARowsMentions`, `mapsTheEntities`,
  `dropsAMentionWhoseEntityIsMissing`. FAIL → implement → PASS → commit.

### Task 12: Marks

**Files:** Modify `lib/formatted.tsx` (`renderVerse` gains `mentions?: Mention[]`), `components/VerseLines.tsx`,
`components/BookPage.tsx`; tests in `lib/__tests__/formatted.test.tsx`, `components/__tests__/BookPage.test.tsx`.

**Interfaces:** a mark piece is `<span class="bg-mention" data-mention="<chapter>.<verse>|<i>" data-review?>`, the
first piece with `tabIndex=0 role="button" aria-haspopup="dialog"`; a review mark's last piece is followed by
`<sup class="bg-mention-review" aria-label="…">?</sup>`. Mark boundaries use private-use code points in a range
after the notes' (U+E100 open / U+E101 close are not enough for nesting: use U+E100+n open and U+E900+n close, n the
mention's index).

- [ ] Tests: `marksASettledName`, `marksAReviewNameWithAQuestionMark`, `splitsAMarkAcrossALineAndANoteMarker`,
  `nestsALabelAroundAName`, `noMentionsRendersAsBefore` (snapshot of an existing verse unchanged). FAIL → implement →
  PASS → commit.

### Task 13: The Annotations switch

**Files:** Create `lib/annotations.ts` (`loadAnnotations(): boolean`, `saveAnnotations(on: boolean): void`,
`subscribeAnnotations(cb): () => void`, as `lib/note-panel.ts`), `components/AnnotationsSwitch.tsx`; modify
`components/ReaderBar.tsx` (`annotations?: boolean` prop: draw the switch), the chapter page (pass it when any row
has mentions), messages `Reader.annotations.label` ("Annotations") and `.title` in six locales, `app/globals.css` (`.bg-mention` tint and `.bg-mention-review` shown only under
`[data-annotations="on"]`); tests.

- [ ] Tests: `isOffByDefault`, `remembersTheChoice`, `followsAnotherTab`, `staysOffWhenStorageThrows`,
  `isNotDrawnWithoutMentions`, `setsTheReaderAttribute`. FAIL → implement → PASS → commit.

### Task 14: The card

**Files:** Create `components/MentionLayer.tsx` (client: event delegation on `.bg-mention` inside the reader,
timers, pin, Escape, outside click, focus return, positioning beside the mark, a portal), `components/MentionCard.tsx`;
the chapter page passes `entities` and the edition language; messages `Reader.mentions.*` in six locales.

- [ ] Tests (fake timers): `opensAfter300msOfHover`, `closes200msAfterLeaving`, `tapPinsAndSecondTapUnpins`,
  `escapeClosesAndReturnsFocus`, `doesNothingWhenSwitchedOff`, `showsTheReviewLineAndEachCandidate`,
  `showsNoImageOrWikipediaWithoutDetails`, `linksToTheIndexEntryWithItsLetter` (`/read/nvbse/persons?letter=P#bpers:petrus`).
  FAIL → implement → PASS → commit.

### Task 15: Map, comparisons, index anchors, docs

**Files:** `package.json` (`leaflet`, `@types/leaflet`), `components/MentionMap.tsx` (dynamic import, Esri World
Street Map tiles, compact attribution as the martyrology's `MentionMap.tsx`, circle marker, zoom 8, "site uncertain"
label when `uncertain`); `components/Spread.tsx`, `components/Interlinear.tsx` and the chapter page (mentions for the
NVBSE side only); `components/EntityIndex.tsx` (`id={entity.id}` on each entry); `content/docs/en/persons-places-events.mdx`
(an "Annotations" section: the switch, marks, the (?), the review status, where data comes from).

- [ ] Tests: `loadsTheMapOnlyForAPlaceWithCoords`, `marksOnlyTheNovaVulgataSide` (NVBSE second in side-by-side and
  in interlinear), `anchorsEachIndexEntry`, docs registry test unchanged count. FAIL → implement → PASS; `npx vitest
  run`, `npx tsc --noEmit`, `npx eslint .`; push; PR.

## Part D: staging

### Task 16: Load, deploy, check

- [ ] After all PRs merge: deploy the endpoint to staging (migration 073 applies); load CBPPEDR through the tunnel
  (`php scripts/load_cbppedr.php <cbppedr>`; expect `stale` and `no_row` near zero); deploy the website.
- [ ] As a visitor, open NVBSE Genesis 12, Exodus 3 and Acts 9, alone, side by side with DRB and interlinear: switch
  off by default; on, marks appear; one settled and one (?) card open and read correctly; a place card shows its map.
- [ ] Close the Playwright browser; report counts and anything stale.
