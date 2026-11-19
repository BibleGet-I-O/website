# Reader: compare up to three editions from a settings menu

Short design, approved in conversation on 2026-11-19.

## Why

The reader's toolbar holds edition, book, chapter, an "Interlinear" checkbox and a second-edition select. On a phone they don't fit. The checkbox really means "compare", and whether the comparison is side by side or stacked depends on the screen width, not on the reader. The Android app *Bibbia cattolica* shows the model we want: comparison is an option in a menu, editions are chosen in a popup, the layout is a choice, and a third edition can be added.

## Goals

- **Toolbar.** It keeps edition, book and chapter, plus a ⚙ settings button. The interlinear checkbox and the second-edition select are removed. On Esther, the Greek/Hebrew choice moves into the settings.
- **Settings menu.** It closes on Escape, a click outside, and Back/Forward, like the header's NavMenu. Its items depend on what's open:
  - One edition: "Compare with another edition…".
  - Two editions: "Change second edition…", "Add a third edition…", the "Interlinear" switch and "Stop comparing".
  - Three editions: "Change second edition…", "Change third edition…", "Remove the third edition", the "Interlinear" switch and "Stop comparing".
  - On Esther, whatever is open: the Esther text (Greek/Hebrew).
- **Popup.** Each "…" item opens a small popup with an edition dropdown. Picking an edition navigates at once; Cancel or Escape closes it. The dropdown never offers the main edition or the edition already in the other slot.
- **Address.**
  - `with` holds one or two edition siglas, comma-separated: `?with=CEI2008` or `?with=CEI2008,VGCL`.
  - `view=interlinear` selects the interlinear layout. It is present only while comparing; side by side is the default and has no parameter.
  - Existing `?with=X` links keep working. Unknown, repeated or main-edition siglas are dropped, and anything after two is ignored.
  - Switching the main edition, book, chapter or Esther text keeps the compared editions (minus a compared edition that becomes the main one) and the view.
  - The chapter navigation and the books page's same-chapter redirect pass the parameters on.
- **Side by side.** The default layout: two or three columns at every width, with each edition's name over its column and each verse level with its counterparts. Today's automatic stacking on upright phones goes away.
- **Interlinear.** One column: each verse of the main edition, then the compared editions' verses under it, each tagged with its edition's sigla.
- **Section headings** keep their own row in both layouts, so the verses stay level.
- **Gaps.** A verse missing from one edition gets the "Not in {edition}" note on its empty side, as today, with the same exceptions:
  - the rest of an edition after another edition's cap;
  - a verse of another chapter that the main edition prints on this page.
- **Editions that divide the chapter differently.** Each such compared edition is shown whole below, with today's note, while the others stay aligned. The Psalms keep aligning by the Hebrew reference.
- **Missing and unavailable editions.** A compared edition that lacks the book or chapter gets today's note. So does one that can't be loaded; if every compared edition is unavailable, the page falls back to the book view with the notes.
- **The 30-verse cap notice** shows for each edition it applies to.
- **Translations.** All new strings in en, it, es, fr, de, pt.

## Non-goals

- Verse mapping across versifications (the Nova Vulgata reference): a separate design.
- More than three editions.
- Remembering the layout across visits (a cookie): the address carries it.

## Approaches

1. **(Chosen) Settings in a ⚙ menu in the reader toolbar.** Reading settings stay next to the text they act on. The site's hamburger menu stays site navigation.
2. **Settings in the header's hamburger menu.** That menu shows on every page and holds site links, so reader-only items would appear and disappear with the page. Rejected.
3. **A cookie for the view.** A shared link then wouldn't open what the sender saw, and server rendering would need the cookie on every request. Rejected in favour of the address.

## Builder's calls

- **Alignment.** `buildRows` takes the main edition's rows and a list of compared editions' rows, and each list is merged in the same way as today's second edition. A compared edition's row joins the first row with its key that has no row of that edition yet. Otherwise it gets a row of its own after the row of its previous match. Rows from two compared editions with the same key therefore share a row even when the main edition lacks the verse.
- **Page width.** Side by side: `max-w-6xl` with two editions, `max-w-7xl` with three. Interlinear: `max-w-3xl`, the reading width of a single edition.
- **Text size.** Three columns use a smaller text size below the `sm` breakpoint.
- **The popup** is a positioned `role="dialog"` element rendered inside the settings root, not a native `<dialog>`, which jsdom does not fully support.
