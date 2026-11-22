# Search modes: reference search, one semantic mode, placeholders

**Date:** 2026-11-22 · **Status:** approved 2026-11-22 (placeholders and the single semantic mode added the same day) · **Size:** a small change (website only; no endpoint change)

## Intent

Three changes to the reader's search, approved together on 2026-11-22.

Beside keyword and semantic search, a reader can search by **Bible reference**: typing
`Jonah 1:1-2:2;3:2` shows exactly those verses of the edition. Someone who already knows the reference
gets the passage directly, without paging through chapters or searching for words.

## Decided

### Modes: Keyword, Semantic, Reference

- The lens offers **Keyword** (the default, as today), **Semantic** and **Reference**. There is no Hybrid tab any
  more: **Semantic is served by the endpoint's hybrid route** (`/search/hybrid`, default weights), which a
  measurement on staging showed is never worse than `/search/semantic` and sometimes better (below).
- An old link with `mode=hybrid` opens as `mode=semantic` (the same search), so bookmarks keep working.
- A natural-language mode using the reranker is planned separately; it will join these three later.

**Measurement (2026-11-22, staging, LaBSE, DRB and LUZZI, top 10).** The 18 questions of the semantic
experiment, and 10 short topical queries (e.g. `pray always`, `tributo Cesare`), were asked of both routes.
A hit is an expected verse, or one verse either side.

| Queries | `/search/semantic` | `/search/hybrid` |
|---|---|---|
| 18 natural questions | 9 / 180 expected verses | 9 / 180, the same 180 results |
| 10 short topical queries | 15 / 100 | 19 / 100 (better on 4, never worse) |

On questions, hybrid's keyword half matches nothing (it requires every word), so hybrid equals semantic. On
short queries, its keyword matches lift verses semantic ranks lower. Pure semantic adds nothing over hybrid.

### A placeholder for each mode

Each mode's field shows a hint of the search it is for, in the UI locale:

| Mode | en | it |
|---|---|---|
| Keyword | `Words in the verse, e.g. shepherd` | `Parole del versetto, es. pastore` |
| Semantic | `A theme or idea, e.g. trust in God` | `Un tema o un'idea, es. fiducia in Dio` |
| Reference | `Jonah 1:1-2:2; 3:2` | `Giona 1,1-2,2; 3,2` |

The other locales (es, fr, de, pt) follow the same pattern, with the locale's book names and notation in the
reference example. The placeholder is a hint only; the field keeps its visible label.

### Reference search

- A fourth mode, **Reference**, in the search lens and on the results page, beside the other three.
- The reference is looked up in the **main** edition.
- **Comparison (approach A):** while CBTUDR's verse mapping is not yet available to the reader, a
  reference search shows the main edition only. When the reader is comparing, a short note says that
  compared editions will be matched once the verse mapping is ready. Compared editions are never paired
  by chapter:verse numbers, because those pairings are wrong wherever numbering differs (e.g. Malachi 4,
  Joel 3, the deuterocanonical additions).

## Anti-goals

- Never show a compared edition's verses next to verses they don't correspond to.
- Don't invent a second reference grammar: the endpoint's `/quote` parser is the only one, so the website
  accepts exactly what every other BibleGet client accepts.

## Approaches considered

1. **The website calls `/quote` (chosen).** `/quote?query=…&version=…` already parses multi-range
   references, book names in each supported language, and both notations (ENGLISH `1:1-2:2;3:2`,
   EUROPEAN `1,1-2,2;3,2`). The reader already calls it for chapters (`quoteRequest` in `lib/api.ts`).
2. *A new `/search/reference` endpoint route:* it would duplicate `/quote` and add nothing until the mapping
   exists. Dropped.
3. *Parse the reference in the browser and open the reader at the first verse:* it shows a chapter, not
   "just those verses", and it adds a second grammar. Dropped.

## Design

- `SearchMode` becomes `"keyword" | "semantic" | "reference"`; `searchEdition` sends `semantic` to
  `/search/hybrid` (the semantic rate limit and the 503 "semantic unavailable" handling stay as they are).
- Reference comes last in `SEARCH_MODES`. The label is "Reference" in all six
  locales (it: "Riferimento", es: "Referencia", fr: "Référence", de: "Bibelstelle", pt: "Referência").
- **Form:** with Reference selected, the field is labelled "Bible reference" and its placeholder is an
  example in the UI locale's book names and notation (the table above).
  There is no "exact words" box and no word suggestions.
- **Results:** `searchEdition` with `mode: "reference"` calls `/quote` with `numbering=edition`, using the
  same key and cache rules as `quoteRequest` (reader: no-store; read key: revalidate 3600). The page shows
  the verses as a passage, not a hit list:
  - grouped by book and chapter, each group with a heading (`Jonah 1`) that links to that chapter in the
    reader with the comparison kept (`from`'s `with`/`view`), at the group's first verse anchor
    (`verseAnchor`);
  - verse numbers and section titles as in the reader;
  - no paging and no semantic rate limit, since the endpoint decides how many verses a request may return.
- **Bad references:** when `/quote` answers with errors and no verses, the page says it couldn't read the
  reference and shows the locale's example. It shows no raw endpoint message, which is English only.
- **Capped editions:** when `/quote` returns a `VERSES_CAPPED` notice (a copyrighted edition with a read
  key), the existing `CappedNotice` (`about="search"`) offers to sign in and comes back to this search.
- **Comparison note:** when the search started from a comparison (its `from` carries `with=`), a note above
  the results explains that only the main edition is shown for now.

## Left to the builder

- Where the passage component lives (a new `ReferenceResults`, or a variant of `SearchResults`).
- How a passage that crosses books (`Jonah 4; Micah 1`) is headed: one heading per book and chapter is
  enough.
- The note's exact wording, in six locales.

## Later (not in this change)

- Compared editions through the CBTUDR mapping. This needs a public endpoint route that maps a main
  edition's verses to each compared edition's verses, and the switch from the note to real columns.
- Recognising a reference typed in keyword mode and offering "Did you mean the passage?".
