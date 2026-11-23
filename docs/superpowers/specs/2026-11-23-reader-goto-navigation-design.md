# Reader navigation: the go-to panel, the last chapter read, the edition index

**Date:** 2026-11-23 · **Status:** draft for approval (builder check done 2026-11-23) · **Size:** a project (website only; no endpoint change)

## Intent

On a phone, getting from one place in the Bible to another is clunky today. The edition page lists every
book with every chapter number (the Psalms alone are 150 boxes), and the reader bar has three native
selects: edition, book and chapter. The book select becomes a long, ungrouped OS list.

The goal is navigation that is pleasant, modern, intuitive and immediate: the fewest taps to the
destination. The model is the CEI 2008 app (a go-to sheet with chapter → books → testaments levels and a
breadcrumb), improved where it falls short:

- the CEI breadcrumb only shows where you are; ours also takes you there;
- the CEI books screen has no way up but the back arrow; ours has a home icon.

A clickable mockup was reviewed on 2026-11-23. Its choices are recorded below.

## Goals

- From the reader, another chapter of the same book in **2 taps** (go-to, number).
- Another book in **4 taps** (go-to, back or breadcrumb to the testament, book, chapter).
- Choosing an edition on the home shelf opens the **reader directly**, on the chapter last read in that
  edition (Genesis 1 the first time).
- The edition's index page (every book, every chapter) **stays**, and is reachable by people and by
  search engines.
- Staging is never presented as canonical to search engines.

## Non-goals

- Syncing the last chapter read across devices or to the signed-in account (later, if wanted).
- Changing the edition select, the search lens, the ⚙ settings, the page turn or the previous / next links.
- Book introductions (the CEI app has them; our editions do not).
- Swipe-down to close the panel (can be added later).

## Anti-goals

- A panel that loads anything from the server between levels: moving between levels must be instant.
- Losing the reader's state on a jump: the comparison (`with`), its `view` and Esther's `tradition` must
  carry over exactly as `ReaderBar.go()` carries them today.
- Indexable staging: no staging URL in a sitemap, `robots.txt` or canonical link.

## Constraints

- Next.js 16 App Router, React 19, next-intl (en, it, es, fr, de, pt), Tailwind 4. No new dependency.
- Book numbers 1–73 are stable across editions (endpoint wiki, *Book Numbering*). Protestant editions
  lack books 17, 18, 20, 21, 27, 28 and 32; the index lists only the books the edition has.
- The edition index is already fetched by the chapter page and passed to `ReaderBar` (`books`, with
  `chapters` per book).
- Staging sets `SITE_NOINDEX=1` (robots disallow-all, `X-Robots-Tag: noindex`).

## Approaches considered

- **A. Native `<dialog>` in one client component (chosen).** The panel's levels are component state; the
  data is the index the reader bar already has. The browser gives focus trapping and return, Esc,
  the backdrop, and, on Android Chrome, closing on the system back gesture. No new dependency.
- **B. Intercepting routes (`@modal`), a URL per level.** Shareable levels and browser Back climbing them,
  but a server round-trip per level (slower) and much more machinery, for levels nobody needs to share.
- **C. A drawer library (Vaul / Radix).** Swipe-to-close and polished animation, at the cost of a
  dependency for one panel on a deliberately lean site.

Chosen: **A**, for instant level changes and no dependency.

## Decided

### 1. The go-to button

In `ReaderBar`, the book and chapter selects are replaced by **one button** showing where the reader is
(`Genesis 1`, the book's name in the edition's language as today, then the chapter). The edition select,
the search lens and ⚙ stay. Tapping the button opens the panel **at the chapter level of the current
book**.

### 2. The panel: three levels

Full screen on phones; on wider screens a **centered dialog about 640px wide** with the same levels and
breadcrumb (can be refined later). Header: back arrow (left), the level's title with the edition's name
under it (centre), **Close** (right).

**Chapters** (title: the book's name). A square grid of chapter numbers, 5 across on a phone (more on wider
screens), the current chapter highlighted. A number navigates to that chapter and closes the panel.

**Books of a testament** (title: *Old Testament* / *New Testament*). The testament's books in tiles,
3 across on a phone, grouped under section headings; the current book highlighted. A book shows **its
chapter grid** (it does not navigate). Sections with none of the edition's books are left out.

**The Bible** (title: *The Bible*). **Two columns**, Old Testament left, New Testament right, each with
its section boxes (name, number of books). A section box opens that testament's books **scrolled to that
section** (the section briefly highlighted); a testament's heading opens its books at the top. The box of
the current book's section is outlined. This level also carries the link **All chapters** to the
edition's index page (§5).

**Back arrow:** chapters → the books of the book's testament (scrolled to its section) → The Bible. Hidden
at The Bible.

**Breadcrumb**, at the bottom, **centered**: `⌂ › Old Testament › Genesis`. Every element but the last is
a link to its level; the last is where you are (`aria-current`, no action). On the books level:
`⌂ › Old Testament`; on The Bible: `⌂` alone. The start icon is a **house** (home).

Sections, by book number (the endpoint's `section` numbering, wiki *Book Numbering*):

| Testament | Section (en) | Books |
|---|---|---|
| OT | Pentateuch | 1–5 |
| OT | Historical Books | 6–21 |
| OT | Wisdom Books | 22–28 |
| OT | Prophets | 29–46 |
| NT | Gospels | 47–50 |
| NT | Acts of the Apostles | 51 |
| NT | Letters of Paul | 52–64 |
| NT | Catholic Letters | 65–72 (Hebrews is 65, as in the endpoint) |
| NT | Revelation | 73 |

The names are new strings in `messages/en.json` (namespace `GoTo`), translated into the other five
locales (Italian: Pentateuco, Libri storici, Libri sapienziali, Profeti; Vangeli, Atti degli Apostoli,
Lettere di Paolo, Lettere cattoliche, Apocalisse).

Every book tile and chapter number is a **real link** (`<a href>`), not a button: long-press offers "open
in new tab", and it is the same URL the reader would navigate to (with the reader's kept query, below).
A plain click navigates client-side and closes the dialog.

*Builder's notes (settled after review):* `ReaderBar`'s `books` prop gains `bookNum` (the chapter page has
it) so books can be grouped by section. The URL-building part of `go()` is split out: the panel renders each
`href` with it, and a plain click calls `go()` so the pending-change rule still applies.

### 3. Carrying the reader's state

A jump from the panel builds its URL exactly as `ReaderBar.go()` does today (the comparison, its view,
Esther's tradition kept only within the same book, the pending-change rule). The panel calls the same
function; it does not duplicate the logic.

### 4. The last chapter read

When a chapter page is shown, a small client component stores, per edition, `{bookNum, chapter}` in
`localStorage` (key per edition sigla; the book number, not the slug, because it is stable across editions), wrapped in try/catch: storage may be unavailable, and
then the default applies. Only reading pages store it (not review pages).

### 5. The home shelf and the edition index

- Each book on the shelf **stays a link to the edition's index page** (`/read/{edition}`): crawlers and
  visitors without JavaScript follow it. A click handler on the client sends a person instead to the last
  chapter read in that edition through the existing redirect `/read/{edition}?book={bookNum}&chapter={n}`
  (the server resolves the slug); with nothing stored, `?book=1&chapter=1` (Genesis 1). Modified clicks (new
  tab, middle click) keep the link as is.
- The index page keeps its address and its function (every chapter linked), with a lighter layout for
  phones (the builder's call: e.g. books collapsed by section, chapters shown on demand, as long as every
  chapter remains a link in the HTML).
- The index page is linked from the panel's The Bible level (**All chapters**).
- Its existing behaviour stays: `?book=&chapter=` from the edition switch redirects to that chapter.

### 6. Sitemap and canonical origin

- A `sitemap.xml` (Next `app/sitemap.ts`, split per edition if it grows large) lists each edition's index
  page and every chapter, for each locale.
- URLs are built from a **canonical origin** environment variable (production's), never from the request's
  host, so a staging build can never emit staging URLs.
- With `SITE_NOINDEX=1`, **or with the canonical origin unset**, the sitemap is **not served** (404) and
  `robots.txt` names no sitemap; otherwise `robots.txt` adds `Sitemap: {canonical origin}/sitemap.xml`.
  There is never a fallback to the request's host.
- The sitemap is dynamic (`force-dynamic`, like `robots.ts`): `proxy.ts` does not see files with an
  extension, so the route checks `SITE_NOINDEX` itself. Editions × about 1,189 chapters × 6 locales exceeds
  the 50,000-URL limit of one sitemap, so it is **split per edition** under a sitemap index.

## Left to the builder

- Component names and file layout (e.g. `GoToPanel`, `lib/sections.ts`, `LastRead`).
- Exact styling within the site's existing look (slate palette, red accents), and dark mode.
- The canonical-origin variable's name, and whether `rel=canonical` links are added to pages in the same
  change.
- The index page's lighter layout (within §5).
- Tests: the panel's levels, back arrow and breadcrumb; state carried on a jump; last-read storage and
  the shelf redirect; sitemap absent under `SITE_NOINDEX=1`.

## Mockup

The reviewed prototype (variants A/B for The Bible level, book-tap behaviour, four start icons) was a
throwaway page in the brainstorming session; the choices above are what it settled: two columns with
sections, a book shows its chapters, the home icon, a centered breadcrumb.
