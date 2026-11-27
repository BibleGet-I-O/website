# Mentions and cards in the reader (persons, places, events: delivery 2)

Status: approach and decisions approved in conversation 2026-11-27; this document awaits the user's review.
Delivery 1 (indices) is `2026-11-27-persons-places-events-design.md`, shipped.

## Intent

While reading the Nova Vulgata, a reader should see who or what a name refers to without leaving the page: the
names of persons and places are marked in the text, and hovering or tapping one opens a card, as in the martyrology
(CatholicOS/martyrology-frontend with CatholicOS/crmedr). An **Annotations** switch turns all of it on or off.

## Goals

1. **CBPPEDR** gains the mentions of its persons and places in the NVBSE text (positions, never words) and the card
   details of its entries (image, Wikipedia titles, coordinates).
2. **The endpoint** loads both and sends a chapter's mentions with the quote, at positions in the formatted text the
   reader already renders, and the card data of the entries they name.
3. **The website** marks the mentions on the chapter page and in both comparisons (side by side, interlinear), opens a
   card on hover or tap, and offers the Annotations switch.

## Non-goals

- Search results (keyword, semantic, passage): no marks (the user's decision: cards would crowd short excerpts).
- Events marked in the text (they stay at the verse level, as in delivery 1); editions other than NVBSE; notes and
  headings (mentions are in the verse text only).
- Editing or reviewing mentions from the website.
- Jev or other model assistance for the unsettled mentions in this delivery: they ship marked as under review.

## Anti-goals

- No copyrighted text in public repositories: CBPPEDR stores positions and hashes only; the NVBSE text the matcher
  reads stays in the private working area (`data-local/cbppedr`).
- No unflagged guess: a mention the matcher cannot settle is shown, but always with the red (?) and the "under
  review" line (the user's decision); only settled mentions become attestations, so the indices never list a guess.
- No image, Wikipedia link or map from an unreviewed Wikidata match (as the index's Wikidata links, delivery 1).
- No confident pin on an uncertain or disputed site.

## Decisions (the user's)

- **Ship the settled mentions now; mark the unsettled ones too**, with a small red (?) after the name and, at the
  top of the card, "This identification is still under review", then the proposed entry or, for homonyms, each
  candidate's card.
- **Where:** the chapter page and both comparisons; not search results.
- **Everywhere a name appears** in the Nova Vulgata, not only in the verses CBPPEDR attests (the user's decision):
  attested verses are the sources' citations (a person's median is one), so marking only those would leave David,
  Moses or Paul unmarked in most of their verses.
- **Positions (approach 1 of 3):** CBPPEDR counts a mention's position in the verse's **plain text** (`text_plain`);
  the **endpoint converts** it to a position in the formatted `text` and sends it ready to use. Rejected: positions in
  the formatted text (CBPPEDR would depend on BibleGet's tags, and a re-layout would invalidate mentions); conversion
  in the website (every client would repeat it).
- **The switch** is like the martyrology's: "Annotations", off by default, remembered in the browser, drawn only
  where the edition has mentions.

## Design

### CBPPEDR

- **`data/mentions/nvbse.json`**, keyed by CBTUDR unit, with `@GREEK`/`@HEBREW` for Esther's two texts
  (`btu:est.1.1@HEBREW`: the builder's call, so that Esther is marked like the other books):

  ```json
  {"$comment": "…", "edition": "NVBSE", "units": {
     "btu:gn.12.1": {"hash": "<sha256 hex of the verse's text_plain>",
                     "mentions": [{"start": 10, "end": 15, "check": "1a2b3c4d", "entry": "bpers:abraham"},
                                  {"start": 40, "end": 46, "check": "…", "candidates": ["bpers:x", "bpers:y"]}]}}}
  ```

  `start`/`end` in UTF-16 code units of `text_plain` (crmedr's convention); `check` the first 8 hex digits of SHA-256
  over the UTF-8 words of the span. A mention has `entry` (settled) or `candidates` (two or more: under review); a
  single proposed but unconfirmed entry is `candidates` of one. `data/mentions/nvbse_curated.json`, same shape,
  holds hand corrections and wins over the generated file, unit by unit.
- **Forms** `data/curated/forms.json` (the builder's call): by entry, the Latin forms to look for. Proposed by
  `scripts/forms.py` from `names.la` and the NVBSE `labels` (second- and third-declension endings for names that
  decline, e.g. *Petrus, Petri, Petro, Petrum*; indeclinable Hebrew names as they are), then hand-corrected in the
  file, which the script never overwrites for an entry already there.
- **Matcher** `scripts/extract_mentions.py` (stdlib only, tested): reads a private export of NVBSE's `text_plain` by
  unit (`export_texts.py --plain`, one string per row, from the database's column as stored, so the hash matches the
  endpoint's) and looks for every entry's forms in **every verse**: whole words only, case-sensitive on the initial
  capital for names (a label may start lower-case).
  - **Settled:** the form belongs to one entry only; or it is shared and exactly one of its entries is attested in
    that unit. Every occurrence in the verse is marked.
  - **Under review (`candidates`):** the form is shared by several entries and none, or more than one, is attested in
    the unit (homonyms: 499 Latin names are shared); or the form matched only through a case ending that is also a
    common Latin word (a stop list kept with the script): a `candidates` of one. Persons and places sharing a form
    (a people and its land) are candidates too.
  - Overlapping spans: a label containing a name (*rex Aegypti*, *Aegypti*) nests; crossing spans are dropped and
    reported.
  - An attested entry whose forms are not found in its unit is not marked, and is listed in the private report.
  - Output: the public file, plus a private report (counts, unmatched attestations, review cases with their words) in
    `data-local/cbppedr/mentions/`.
- **New attestations** (the builder's call): a settled mention in a unit the entry does not yet attest is added to
  its `attested` by the build (`build_catalog.py` reads the mentions file), marked as coming from the mentions
  (`"by": "mentions"`, so it can be told from a source citation), so the index and the card's verse count grow with
  the marks. Under-review mentions add nothing until settled in `nvbse_curated.json`.
- **`data/details.json`**, keyed by entry id, only for entries whose `qid_status` is `reviewed` or `adjudicated` (today
  about 365 persons and 291 places), built by `scripts/details.py` from Wikidata (cached like `wikidata.py`):
  `image` `{file, author, license, license_url}` (P18, author and licence from Commons), `wikipedia` `{la, it, en,
  es, fr, de, pt}` titles where they exist, and for places `coords` `{lat, lon}` (P625) only when the item has exactly
  one coordinate.
- `docs/schema.md` documents both files; `validate.py` checks them (ids exist, spans inside the text length by the
  recorded hash's verse, `entry` xor `candidates`).

### Endpoint

- **Migration** `073-cbppedr-mentions.sql`:
  - `bpe_mention (edition text, book int, chapter int, verse int, segment text NULL, tradition text NULL, unit text,
    plain_hash text, start int, "end" int, entry text NULL, candidates text[] NULL)`: positions already converted to
    code points of the row's formatted `text`; `plain_hash` the hash the conversion was made against.
  - `bpe_detail (entry text PK REFERENCES bpe_entry ON DELETE CASCADE, image jsonb NULL, wikipedia jsonb NULL, coords
    jsonb NULL)`.
- **Loader**: `scripts/load_cbppedr.php` also reads `data/mentions/*.json` (curated over generated) and
  `data/details.json`, in the same transaction. For each unit it finds the edition's row through `btu_link` (rule or
  reviewed; a unit with no row or several rows is skipped and reported), checks SHA-256 of the row's `text_plain`
  against `hash` (mismatch: the unit's mentions are skipped and reported), checks each span's `check`, and converts
  the positions.
- **Conversion** `PlainTextMap` (new, in `src/Util/`): mirrors `bibleget_plain_text()` (migration 034: drop `⌈⌉⊥`,
  drop `sm|i|sup` tags, line tags, `speaker` and `<br>` to spaces, collapse whitespace, trim) while recording, for
  each plain-text position, its position in `text`. UTF-16 units in, code points out (what the website's
  `renderVerse` counts). A span whose ends fall inside a tag or in collapsed space snaps outward to the nearest
  characters. Test: over every NVBSE row of the local database, the plain function applied to the mapped slice of
  `text` gives back the plain slice.
- **Quote response**: `mentions=1` on `/v3/quote` (for an edition with mentions; ignored otherwise) adds to each row
  `mentions: [{start, end, entry} | {start, end, candidates}]` in `text` code points, only when the row's current
  `text_plain` still hashes to `plain_hash`; and at the top level `entities: {<id>: {type, kind, names,
  description, uncertain, verse_count, image?, wikipedia?, coords?}}` for the ids named. `verse_count` is the
  number of the edition's verses in the entry's index entry. Same keys and caps as the quote today (visitors' 30
  verses carry their mentions). `openapi.json` documents it.

### Website

- **Data**: `getChapter` asks for `mentions=1` when the edition has mentions (NVBSE); `toRow` keeps `mentions`; the
  chapter's `entities` travel with the rows.
- **Marks**: `renderVerse` inserts mark boundaries as it inserts note markers (private-use code points at `text`
  positions, then swapped for elements). A mark split by a tag, line or note marker becomes several pieces; the
  first is focusable (`role=button`, `aria-haspopup=dialog`, Enter or Space opens). Unsettled marks end with a small red
  (?).
- **Switch**: "Annotations" on the reader bar (a `role=switch` toggle as in the martyrology), shown only when the
  chapter has mentions; off by default; kept in `localStorage` (`reader.annotations`), synced across tabs. Marks are
  rendered by the server always and shown or hidden by a class on the reader (tints, the (?), and the cards answer
  only when on), so turning it on needs no reload.
- **Card** (client): opens after 300 ms of hover, closes 200 ms after leaving; tap or click pins it, a second
  tap unpins; Escape or a click outside closes it and returns focus. A non-modal `role=dialog` placed beside the mark.
  Content: the name in the edition's language with the interface-language name in brackets (as the index), the
  description in the interface language, the "uncertain" mark where CBPPEDR has it, the image with author and licence
  linked to Commons, the Wikipedia link in the interface language (else `en`), "All N verses in the index", linked to
  the entry on the index page. Under review: the line "This identification is still under review" at the top, then
  one card per candidate.
- **Place map**: Leaflet (new dependency, loaded only when a place card opens), Esri World Street Map tiles with the
  martyrology's compact attribution; a circle marker at zoom 8. No map when the entry has no `coords`; with
  `uncertain`, the map shows with a "site uncertain" label.
- **Index anchors**: each entry on the index pages gets an `id` so the card's link lands on it (the index pages show
  one letter at a time: the link carries `?letter=`).
- **Messages** in the six locales; the docs page `persons-places-events.mdx` gains a section on annotations, the (?)
  and the review status.

### Error handling

- An endpoint error or a response without `entities`: the chapter renders without marks; the switch is not drawn.
- A mention whose entry is missing from `entities`: not marked.

### Testing

- CBPPEDR: matcher unit tests on small invented Latin verses (no NVBSE text in the repo): declension forms,
  homonyms to `candidates`, stop-list words, nesting and crossing spans, UTF-16 positions; `validate.py` on the files.
- Endpoint: `PlainTextMap` unit tests (each rule of the plain function, snapping) plus the whole-NVBSE property test;
  loader tests (hash mismatch, bad `check`, unit with no row, curated over generated); the quote route with and
  without `mentions=1`, a stale `plain_hash`, the 30-verse cap.
- Website: marks across tags and note markers, the switch (default off, persisted, hidden without mentions), the card
  (timing, pin, Escape, focus, review line, candidates, no image without details), the map loaded only for places.
- Staging: load CBPPEDR, open Genesis 12, Exodus 3, Acts 9 in NVBSE, alone and compared, and check a settled and an
  unsettled mention.

## Order of work

1. CBPPEDR: matcher and mentions file; details file (two PRs).
2. Endpoint: migration, conversion, loader, quote parameter (one PR).
3. Website: marks, switch, card, map, docs (one PR, or two: marks and switch, then card and map).
4. Load on staging, deploy, check.

## Left to the builder

- Component and file names beyond those fixed above, the exact wording of messages, the stop list's contents, the
  card's look (follow the martyrology's cards and the site's style).
