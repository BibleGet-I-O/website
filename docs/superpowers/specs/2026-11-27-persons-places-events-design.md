# Persons, places and events in the reader

Status: design approved in conversation 2026-11-27 (approach and order); this document awaits the user's review.

## Intent

Readers of a Bible edition should be able to find every person, place and event of the Bible in that edition, and, while
reading the Nova Vulgata, see who or what a name refers to without leaving the page. The model is the martyrology
project (CatholicOS/martyrology-frontend with CatholicOS/crmedr): per-edition indices of names and places, and, in the
text, marked mentions that open a card on hover or tap, Wikipedia-style, with a map for a place.

The data comes from **CBPPEDR** (CatholicOS/cbppedr, public): 3,185 persons, 1,098 places and 22 events, each with
names (Latin, Italian, English), a short description of our own (Italian, English), the CBTUDR units where it is
attested (about 17,000 in all), relations, a Wikidata item where one is settled, and per-verse labels (other names and
designations, per edition). Edition verses are reached from units through the CBTUDR maps, already loaded into the
endpoint's `btu_link` table.

The documentation should also describe CBPPEDR properly, as it does CBTUDR (`textual-units.mdx`); today two pages name
it in one line each.

## Goals

Delivery 1 (this design, to be planned and built now):

1. The endpoint loads a CBPPEDR checkout and serves, for an edition, its index of persons, places or events, with each
   entry's verses in that edition's numbering.
2. The website's reader cog menu (ReaderSettings) offers the three indices of the current edition; each is a page, A–Z,
   each entry with its name, description and its verses linked into the reader.
3. A documentation page on CBPPEDR, in part III (the project), after *Textual units and CBTUDR*.

Delivery 2 (outlined here, designed and planned after delivery 1 ships):

4. Mentions of persons and places in the NVBSE text, with offsets, stored in CBPPEDR; the reader marks them, and hover or
   tap opens a card (person: name, description, image, verses, Wikipedia link, index link; place: the same with a map).

## Non-goals

- Events marked in the text: events stay at the verse level (CBPPEDR's `attested`); they have no single word to mark.
- Mentions in editions other than NVBSE (later, edition by edition).
- Editing CBPPEDR from the website, or a review screen for mentions in delivery 1.
- Spanish (or other) names for BLPD: CBPPEDR has none yet.

## Anti-goals

- No copyrighted text in public repositories: CBPPEDR's mention data holds offsets and a hash of the printed words,
  never the words (as crmedr's `mentions.json`); review packets that quote the text stay private.
- No guessed identification: an index lists what CBPPEDR attests; drafted (unreviewed) unit links are not used.
- No confident pin on a disputed or lost site (delivery 2).

## Approaches considered

1. **Through the API** (chosen). The endpoint loads a CBPPEDR checkout into its own tables, as
   `scripts/load_cbtudr.php` loads CBTUDR, and serves the indices (and, in delivery 2, mentions with the quote
   response); the website renders. Other clients can use the same data; the delivery-2 hash check runs where the text is.
2. **Into the website at build time**, as the martyrology frontend reads crmedr. Simpler, no endpoint change, but the
   resolution from units to edition verses (in `btu_link`, on the server) and the hash check would have to be repeated
   in every client.

The user chose 1, and the order indices first, then mentions and cards.

## Design, delivery 1

### Endpoint

- **Migration** `072-cbppedr.sql` (+ `src/Migrations/Version072Cbppedr.php`):
  - `bpe_entry (id text PK, type text CHECK IN ('person','place','event'), kind text, names jsonb, description jsonb, qid text NULL, qid_status text NULL, uncertain boolean NOT NULL DEFAULT false)`
  - `bpe_attested (entry text REFERENCES bpe_entry ON DELETE CASCADE, unit text, ord int, PRIMARY KEY (entry, unit))`
  - `bpe_label (entry text, unit text, editions text[], PRIMARY KEY (entry, unit))`: only which editions carry a label
    (an edition missing from a labelled unit's `editions` does not name the entry there, so that unit is left out of
    that edition's index); the label's words are not needed for the index and are not loaded.
  - `bpe_release (loaded_at timestamptz, commit text, counts jsonb)`: the checkout's commit, one row per load.
- **Loader** `scripts/load_cbppedr.php <cbppedr-dir>`: reads `data/persons.json`, `places.json` and `events.json`, with their inline
  `labels` (`data/unnamed.json` is not loaded), and replaces the `bpe_*` rows in one transaction.
  Not deployed; run through an SSH tunnel like `load_cbtudr.php` (prints `APP_ENV` and `DB_NAME` first).
- **Route** `GET /v3/metadata/entities/{EDITION}/{persons|places|events}` (a data route: `X-Api-Key`, rate limited as
  the other metadata routes). Response:

  ```json
  {"edition": "NVBSE", "type": "person", "release": {"commit": "…", "loaded_at": "…"},
   "entries": [{"id": "bpers:abraham", "kind": "individual", "names": {"la": "…", "it": "…", "en": "…"},
                "description": {"it": "…", "en": "…"}, "qid": "Q9181", "qid_status": "reviewed", "uncertain": false,
                "refs": [{"book": 1, "chapter": 11, "verse": 26, "segment": null}, …]}]}
  ```

  `refs` are the edition's verses, in canonical order, for the entry's attested units, through `btu_link` rows of that
  edition with status `rule` or `reviewed` (a unit linked to several verses gives each; a unit the edition lacks gives
  none; a labelled unit whose `editions` lacks this edition is skipped). Entries with no refs in the edition are left
  out. An edition with no `btu_link` rows answers an empty `entries` (not 404). Unknown edition or type: 404 problem.
  Cached like the other metadata routes. `openapi.json` documents it.
- `ref` parsing reuses `BtuRepository`'s conventions (`"5:3"`, `"5:3@GREEK"`, segments). Each ref carries
  `tradition` (`"GREEK"`, `"HEBREW"` or null, from the `@` suffix), and the website's link adds `?tradition=` so
  Esther's verses open in the right text.

Calls made after the builder check (the builder's, open to the user's correction):

- **Labelled units in editions CBPPEDR has not audited** (BLPD, LUZZI: `labels` covers NVBSE, VGCL, CEI2008, NABRE,
  DRB only): left out of those editions' indices, about 1,100 verses each. Conservative, per "better unidentified than
  misidentified"; an audit of those two texts would bring them back.
- **`corresponding` links** (a verse of another recension or translation base, e.g. the Clementine's Tobit) count
  like `same` links: the reader's comparison already treats them as the edition's verse for the unit, and the name is
  almost always there; the docs page says the index follows the unit maps.
- **An empty `names.la`** (16 entries): the displayed name falls back to `en`, then `it`.
- `data/unnamed.json` is not loaded (already stated); the catalogs' inline `labels` are read instead of
  `data/curated/labels.json` (same data, already applied).

### Website

- **Cog menu** (`components/ReaderSettings.tsx`): a group "Indices" with three links: Persons, Places, Events, to
  `/read/[edition]/persons` etc., keeping the reader's `with` comparison in a `back` link as the martyrology does.
- **Pages** `app/[locale]/read/[edition]/(persons|places|events)/page.tsx` (one shared `EntityIndex` component):
  - Heading: "Persons in the Nova Vulgata" (interface language), a letter bar (A–Z, only letters with entries;
    `?letter=`, default the first), entries of that letter.
  - Each entry: the name in the edition's language (`la` for NVBSE and VGCL, `it` for CEI2008 and LUZZI, `en` for
    NABRE and DRB, `la` otherwise, e.g. BLPD), then in brackets the interface-language name where it differs and
    exists (`it`/`en`); the description in the interface language (`it`, else `en`); a small "uncertain" mark where
    CBPPEDR marks the entry `review: uncertain`; a Wikidata link only where `qid_status` is `reviewed` or
    `adjudicated` (the user's decision, 2026-11-27: the automatic matches stay hidden until reviewed);
    the verses as compact references in the edition's book abbreviations grouped by book ("Gn 11:26–27, 29; 12:1"),
    each linking to `/read/[edition]/[book]/[chapter]#v[chapter].[verse]`. An entry with more than 40 verses shows
    its books and count with the list in a `<details>`.
  - Sorting: by the displayed name, accents and case folded (Italian "Abanà" with "Abana"); homonyms (same displayed
    name) keep CBPPEDR's id order and their descriptions tell them apart.
  - Fetch through the existing server-side API client with the site's `read` key; revalidate daily.
  - Empty index: a sentence that this edition has no index yet.
- **Messages** in all six locales (`Reader.indices.*`, page titles and the empty sentence).
- **Docs** page `content/docs/en/persons-places-events.mdx` ("Persons, places and events and CBPPEDR"), part
  `project` after `textual-units`; registry entry in `lib/docs.ts`, `Docs.pages` title and description in six locales,
  test counts updated. Content, from CBPPEDR's README and docs: what it is and why (homonyms; one identifier serving every
  edition through CBTUDR units), the id scheme with examples, what an entry holds, the rule "better unidentified than
  misidentified", sources (the dictionary and the Jerusalem Bible as evidence, cited by location, no text; TIPNR only as
  a pointer; Catholic and peer-reviewed sources as authorities for conjectures), conjectures and their statuses,
  Wikidata matching, licences, drafts until v1.0.0, and how the reader's indices are built from it. The data-and-api
  and contributing pages link to it.

### Error handling

- API failure on an index page: the page shows the reader's existing error treatment (no partial list).
- A CBPPEDR unit with no CBTUDR unit row (stale id): skipped by the loader and reported in its summary.

### Testing

- Endpoint: unit tests for the ref resolution (several verses per unit, a missing unit, a labelled unit excluded for an
  edition, ordering), an integration test of the route against a loaded fixture (a small CBPPEDR directory under
  `tests/fixtures/`), and the loader's replace-in-one-transaction behaviour.
- Website: component tests for `EntityIndex` (letter bar, folding, name languages, compact references and links, the
  `<details>` threshold, empty), the cog menu links, the docs registry and counts.
- On staging: load CBPPEDR, open the three indices of NVBSE, NABRE and CEI2008, follow a few verse links.

## Delivery 2, outline

- CBPPEDR: `data/mentions/nvbse.json`: by unit, the edition text's hash (SHA-256 of the verse's `text_plain`) and its
  mentions `{entry, start, end, check}` in UTF-16 code units of `text_plain`, `check` a hash of the printed words
  (crmedr's convention); `data/details.json`: per entry, the Wikidata image (Commons file, author, licence), Wikipedia
  titles per interface language, and for places coordinates with a certainty flag.
- Extraction: per attested unit, find the entry's Latin forms (declension-aware) and its NVBSE labels in the verse;
  unsettled cases to a private review packet; model assistance as in crmedr's `suggest_mentions.py` where useful.
- Endpoint: loader extension, a verse's mentions in the quote response on request, the hash checked at load time.
- Website: marks in the book view mapped from `text_plain` offsets onto the formatted text, the card popup (hover with
  delays, tap to pin, keyboard), the place card's Leaflet map, a site marked uncertain or no map when disputed.

## Left to the builder

- Component and file names beyond those fixed above; the exact message wording; the letter bar's look (follow the
  martyrology's `LetterNav` and the site's style).
