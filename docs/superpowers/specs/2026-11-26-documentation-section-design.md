# Documentation section: design

**Date:** 2026-11-26 · **Status:** draft for the user's review · **Size:** a project, delivered in several PRs

## Intent

BibleGet shows several editions side by side. Readers meet differences they cannot explain from the page: Esther in
Greek and in Hebrew, a shorter Jeremiah, Daniel's additions, Psalms numbered two ways, a prologue to Sirach, 73 books
in one Bible and 66 in another. A documentation section, like the one on romanmartyrology.com
(`CatholicOS/martyrology-frontend`, design `docs/superpowers/specs/2026-10-08-documentation-section-design.md`), tells
how the text reached us: from the Hebrew scriptures and the Qumran scrolls, through the Septuagint and the great codices
and Jerome's Latin, to each edition on this site. It also explains the project's own work on identifying textual units
across editions.

## Readers and goals (decided by the user)

- **The general reader** gets the first page or two: a plain, short introduction.
- **Students** get pages that go further, one per manuscript or tradition.
- The history **carries on to the editions on this site**: what each was translated from, and so why two editions
  differ at a given verse. **More editions will be added**: adding one must mean adding one page.
- **A page on CBTUDR**: its unique identifiers for textual units, and the mappings between the editions' verses.
- **Languages:** everything is drafted in English and reviewed by the user, then translated into the site's other
  five languages (it, es, fr, de, pt).

Success: someone who sees two editions disagree in the reader can find, in a page or two, why; a student can follow
any edition back to the manuscripts it rests on; a developer can find what a `btu:` identifier is and how to use the
mappings.

## Non-goals and anti-goals

- No Bible text of a copyrighted edition (NABRE, CEI 2008, BLPD, NVBSE) in the pages, beyond what a citation needs.
  Facts about an edition (its sources, numbering, canon) are not its text and may be stated.
- No claims without a source. The section must not become a place where plausible-sounding history goes unchecked.
- No images of manuscripts in the first version (rights differ by library); the pages link to the libraries' digitized
  manuscripts instead. *(My call; images can follow once the rights of each are checked.)*
- No search within the docs; no comments or feedback forms.

## Sources and authority

- **Authoritative:** the Church's documents (*Dei Verbum*; Trent's decree *Sacrosancta* of 1546; *Divino afflante
  Spiritu*; Paul VI's and John Paul II's acts on the Nova Vulgata, incl. *Scripturarum thesaurus*, 1979; *Liturgiam
  authenticam*, 2001; the Pontifical Biblical Commission's *The Interpretation of the Bible in the Church*, 1993), the
  holding libraries' own descriptions of their manuscripts (Biblioteca Apostolica Vaticana for Vat. gr. 1209; the
  British Library for Royal MS 1 D V–VIII and for Sinaiticus with its partner libraries, codexsinaiticus.org; the Israel
  Antiquities Authority's Leon Levy Dead Sea Scrolls Digital Library; the National Library of Russia for the Leningrad
  Codex; the Israel Museum for the Aleppo Codex), and Catholic or peer-reviewed scholarship. As for the catalogs
  (CBPPEDR), other sources are leads to be checked, not authorities.
- **The editions' own front matter** for what each was translated from (NABRE's preface, the CEI 2008 presentation,
  the Nova Vulgata's *Praenotanda*, the Clementine's preface, Challoner's). Copyrighted front matter is paraphrased and
  cited, not quoted at length. **Placeholders for now** (decided by the user 2026-11-26): where the front matter of a
  copyrighted edition is not at hand (CEI 2008's presentation, BLPD's introduction), its page keeps a visible
  placeholder for "what it was translated from" (a `<Pending>` note, not a guess) until the user supplies it; NABRE's
  revised preface is in the private archive (`BibleGet-I-O/NABRE-source`, `html/nab-00-prefacerevised.html`; the
  front matter `nab-00-fm.html`) and may be used. **The site's own copy of a public edition** *(my call)*: its page
  names the printing and digital text this site imported, as recorded in `versions_available.notes` (LUZZI: SBBF 1925
  via LaParola.net, migration 016) and the source mirrors' READMEs (`BibleGet-I-O/Luzzi-Riveduta`,
  `BibleGet-I-O/Clementine-Vulgate`). Where the site's copy is not recorded (DRB: which Challoner revision), the page
  says what the edition is in general from public sources and keeps a `<Pending>` for this site's copy, as for the
  copyrighted editions.
- **This project's documents** for Part IV: CBTUDR's README and `docs/schema-proposal.md`; the endpoint wiki
  (`Versification-Differences`, `Esther-Greek-and-Hebrew-Variants`, `Jeremiah-Textual-Traditions`,
  `Daniel-Deuterocanonical-Additions`, `Psalms-Numbering`, `Deuterocanonical-Books`, `Book-Numbering`).
- Every page ends with **Sources**: what it relies on, with links where the source is online. Dates and figures (a
  codex's century, its leaf count, a discovery's year) are checked against an authoritative source before the page goes
  to review; where scholars disagree, the page says so.

## Pages

Slugs are English and the same in every language; titles are translated.

### Part I: The Bible and its text (the general reader)

1. **`how-the-bible-reached-us`: How the Bible reached us.** One page from the Hebrew scriptures to the editions on this
   site: the Hebrew and Aramaic books and their copyists; the Greek translation (the Septuagint) the early Church read;
   the New Testament's Greek; the great codices of the fourth and fifth centuries; Jerome's Latin; the Church's canon of
   73 books (and why other Bibles have 66); printing, critical editions and modern translations. Each step names its
   student page.
2. **`why-editions-differ`: Why editions differ.** What a reader sees in the reader and why: chapters and verses
   numbered differently (a verse that is 31:55 in one edition and 32:1 in another); the Psalms' two numberings; books
   with a Greek and a Hebrew form (Esther, Daniel's additions, Jeremiah); a verse one edition has and another lacks;
   Sirach's prologue; notes and introductions. Each with a link to the place in the reader where it shows.

### Part II: Manuscripts and traditions (students)

3. **`hebrew-text`: The Hebrew text.** The books and their three divisions (Torah, Prophets, Writings); the scribal
   tradition; the Masoretes and their vowels, accents and notes; the Aleppo Codex and the Leningrad Codex; the printed
   rabbinic Bibles and the critical editions (*Biblia Hebraica Stuttgartensia*, *Quinta*).
4. **`qumran`: The Qumran scrolls.** The discovery (1947 onwards) and the eleven caves; what they contain; the Great
   Isaiah Scroll; what they show about the text before the Masoretes, including Hebrew text close to the Septuagint's
   (Jeremiah's shorter form); Hebrew Sirach (Qumran, Masada, and the Cairo Genizah).
5. **`septuagint`: The Septuagint.** Its origin in Alexandria and the *Letter of Aristeas*; the books it contains beyond
   the Hebrew canon (the deuterocanonical books) and the Greek additions; its use by the New Testament writers and the
   Fathers; its numbering (the Psalms); its critical editions (Göttingen, Rahlfs–Hanhart).
6. **`new-testament-text`: The New Testament's text.** The papyri, the uncials, the minuscules and the versions; how a
   critical edition is made; Nestle–Aland and the UBS *Greek New Testament*; well-known variants and how editions print
   them (the ending of Mark, John 7:53–8:11). *(My call: the codices below carry the New Testament too, and NABRE's and
   CEI's New Testaments are translated from these critical editions.)*
7. **`codex-sinaiticus`: Codex Sinaiticus.** Fourth century; the complete New Testament with the *Epistle of Barnabas*
   and the *Shepherd* of Hermas; Tischendorf and St Catherine's Monastery; its four holders today (British Library,
   Leipzig University Library, St Catherine's, the National Library of Russia) and the joint digital edition; its
   correctors.
8. **`codex-vaticanus`: Codex Vaticanus.** Fourth century; in the Vatican Library since at least the fifteenth century
   (Vat. gr. 1209); what it lacks (the end of Hebrews, the Pastorals, Revelation; most of Genesis; some Psalms); its role
   in the Septuagint's and the New Testament's critical editions; the Vatican's facsimiles and digitization.
9. **`codex-alexandrinus`: Codex Alexandrinus.** Fifth century; given by Cyril Lucaris to Charles I in 1627; in the
   British Library; the *Epistles of Clement*; its Gospels' text type; its place in the history of printed editions.
10. **`vulgate`: The Vulgate.** The Old Latin (*Vetus Latina*); Jerome's work (from the Hebrew, and from the Greek), his
    letters and prefaces; the medieval Vulgate; Trent's decree on the Vulgate's authority; the Sixtine (1590) and the
    Clementine (1592) editions; the Stuttgart critical edition; the Nova Vulgata (1979, 1986) and its use as the
    reference for liturgical translations (*Liturgiam authenticam*).

### Part III: The editions on this site

11. **`editions`: The editions on this site.** All of them, with a **family tree** (a diagram) from the manuscripts and
    critical editions to each edition, and a table: language, year, nature (an *editio typica*, a bishops' conference's
    text, a private translation), what it was translated from, its canon.
12. **`editions/{edition}`: one page per edition**, today seven: Clementine Vulgate (VGCL), Nova Vulgata (NVBSE),
    Douay–Rheims Challoner (DRB), NABRE, CEI 2008, Riveduta–Luzzi (LUZZI), *El Libro del Pueblo de Dios* (BLPD). Each:
    what it is, who made it, when and by whose authority; what it was translated from, and which printed editions of
    those; its canon and arrangement; its numbering and peculiarities as the reader shows them (Psalms, Esther, Daniel,
    Jeremiah, verses printed in another chapter); what this site adds to it (notes and introductions for signed-in
    readers, the 30-verse limit on copyrighted editions); its rights (a link to `/copyright`). The edition's slug is the
    reader's (`editionSlug`).

### Part IV: The project (students and developers)

13. **`textual-units`: Textual units and CBTUDR.** Why "Tobit 5:4" is not the same text in every Bible; the textual
    unit and its identifier (`btu:tb.5.4`, its parts `btu:tb.5.4.1`, text the Nova Vulgata lacks `btu:tb.5.4+1`); why the
    Nova Vulgata seeds the units (*Liturgiam authenticam*); the edition maps, by rule (chapter boundaries, the Psalms,
    Esther, Daniel) or drafted and reviewed (Tobit, Job, Sirach, Greek Esther, Exodus 40); the comparison **as it
    works today** (verses paired by number, the Psalms by the Hebrew reference) and, said plainly as planned, lining
    editions up by unit once the maps are released *(my call: the reader does not do this yet; building it is not part
    of this project)*; the CDCF URI scheme (`cdcf:btu:…`); the licences (data CC0); a banner: **all identifiers
    are drafts pending committee review** until CBTUDR v1.0.0.
14. **`data-and-api`: Data and the API.** What the endpoint offers (quotes, metadata, search, notes for the website), the
    API reference (`/scalar`), API keys, and why copyrighted editions are served within limits; the related registries
    (CBTUDR, CBPPEDR).
15. **`contributing`: How to contribute.** The alignment review (`/review`, for reviewers); reporting errors in an
    edition's text, a misprint, a wrong link; the repositories.

`/{locale}/docs` is the index: a short introduction and the four parts, each page with its title and a one-line
description.

## How it is built

**Approaches considered.** (a) MDX pages in the website, as on romanmartyrology.com; (b) the endpoint's GitHub wiki;
(c) a shared document. Only (a) reaches the site's readers in their language and can link into the reader; the wiki is
for developers and English only. Chosen: (a), the Martyrology's framework adapted to this site.

- **Content:** `content/docs/{locale}/{slug}.mdx` (edition pages `content/docs/{locale}/editions/{sigla}.mdx`), plus
  `index.mdx`. MDX through `@next/mdx`, compiled at build time; `next.config.ts` keeps `output: "standalone"` and the
  next-intl plugin.
- **Registry** `lib/docs.ts`: the ordered pages, each with its part, slug, and title and description per locale; the
  sidebar, index, previous/next, language switch, `generateStaticParams` and `generateMetadata` read it.
- **Routes:** `app/[locale]/docs/page.tsx` (index), `app/[locale]/docs/[page]/page.tsx`,
  `app/[locale]/docs/editions/[edition]/page.tsx`; `generateStaticParams` and `dynamicParams = false`, the MDX compiled
  at build. *(My call: "prerendered" means a fixed list of pages compiled at build, not static HTML. The locale layout
  reads the theme cookie and the sign-in status per request, so every page on the site renders per request; the docs
  stay so too, and no site-wide layout change is part of this project.)*
- **Untranslated pages:** until a page is translated, its other locales show the English text in an
  `<article lang="en">` under a one-line notice ("This page is not yet available in Italian"). The registry marks
  which locales each page has. *(My call: the section can ship in English without five empty languages.)*
- **Components:** `DocsLayout` (sidebar by part, current page marked, the language switch, previous/next; a disclosure
  on phones); `mdx-components.tsx` (headings with anchor ids, internal links through `next/link`, `blockquote`, a
  `Rubric` in the rubric red); `<Sources>`; `<ReaderLink edition book chapter verse with view tradition>` *(my call)*: `book` is
  the universal number, and the link is `/{locale}/read/{edition}?book={n}&chapter={c}` (plus the comparison) with
  `#v{c}.{v}`, which the edition's books page already redirects to the chapter under that edition's own slug. So the
  docs need no index data at build, and a renamed book never breaks a link. A link keeps its edition in every language
  (the example is about that edition); a test checks each `ReaderLink`'s edition and book against a fixture of the
  editions' indexes; `<FamilyTree>` (an inline SVG, readable in both themes, with the same
  content as a nested list for screen readers); `<Drafts>` (the CBTUDR banner).
- **Header:** a "Docs" link in `SiteHeader`/`NavMenu`. *(My call: an edition's "About" on the home page could link to
  its edition page as well.)*
- **Editions** *(my call)*: a test fails if an edition in a committed fixture of `/metadata/bibleversions` has no page,
  so refreshing the fixture when an edition is added asks for its page. At run time, a link to an edition's page
  (the home page's "About", the editions index) is offered only where the registry has one, so an edition the API
  adds before its page exists never leads to a 404. A new edition is one MDX file and one registry entry.

## Links from the reader (decided by the user: all four)

A small "why?" mark in the reader at the four places where a difference shows, each opening its section of
`why-editions-differ` (anchor ids fixed in the English page and kept in every translation):

| Where in the reader | Mark | Opens |
|---|---|---|
| Esther's two texts side by side: beside each column's name (the rubric "Septuagint" / "Masoretic text" in `Spread`'s heads) | ⓘ | `#greek-and-hebrew`, at Esther |
| A gap in a comparison (`GapNote`, "[Not in NABRE]") | "Why?" after the note | `#missing-verses` |
| The Psalms: where the reader prints a psalm or verse numbered differently from the other count (see below) | ⓘ | `#psalm-numbering` |
| A verse printed in another chapter (`printedLabel` gives it a chapter prefix: "12:1" closing Wis 11, "7:53" opening John 8) | ⓘ after the number | `#printed-elsewhere` |

- **Look:** the site's muted icon grey, red on hover; a tooltip and an accessible name ("Why do these texts differ?",
  per place); the link goes to `/{locale}/docs/why-editions-differ#…` in the reader's language (the English text with the
  notice until translated). One component, `WhyLink({ topic })`, with the topic → anchor map in `lib/docs.ts`, so a test
  checks every topic's anchor exists in the English MDX.
- **Psalms** *(my call)*: the reader prints no double number today. A Greek/Latin-numbered edition's Psalm heading
  gains the Hebrew number in parentheses when the two differ ("Psalm 22 (23)", from the rows' `psalm_hebrew`), with the
  mark; in a comparison, a compared column whose verses carry another psalm's number ("9:22" beside NABRE Psalm 10)
  gets the mark in its head. A Hebrew-numbered edition alone (NABRE) shows nothing: its rows carry no Greek number.
- **Visitors and readers alike** see the marks; they are explanations, not edition text.
- **Switching them off** in the reading settings is left out of the first version *(my call)*.
- **Delivery:** with Part I (delivery 1), since they point to `why-editions-differ`.

## Testing

- `lib/docs` (test-first): every registered page has its English file; every locale it claims has its file; no MDX
  file is unregistered; slugs unique; `neighbours` at both ends; hrefs.
- `ReaderLink`: builds the reader's URL; a link to a book or edition the site lacks fails the test run (a scan of the
  MDX files' `ReaderLink`s against a fixture of the editions' indexes).
- `DocsLayout`: the current page marked, the language switch, the untranslated notice.
- `FamilyTree`: its list holds every edition in the registry.
- `WhyLink`: each topic's anchor exists in the English `why-editions-differ.mdx`; the four places render the mark
  (Esther's heads, `GapNote`, a Psalm whose Hebrew number differs, a verse with a chapter prefix) and only there.
- `npm run lint`, `npm test`, `npm run build` (every registered page and locale in the build's route list; an unregistered slug is a 404).
- **Content review by the user before each merge**; each date and figure checked against the source the page cites.

## Delivery

1. The framework, the index and Parts I–II in English, with the reader's "why?" links.
2. Part III: the edition pages and the family tree.
3. Part IV.
4. Translations, one language per PR (it, es, fr, de, pt), each reviewed.

## Left to the builder

The MDX toolchain's exact packages and versions; the layout's look within the site's style; the family tree's drawing;
the wording of each page (the user reviews it).
