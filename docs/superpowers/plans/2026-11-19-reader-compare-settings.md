# Reader compare settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move comparison into a ⚙ settings menu, compare up to three editions, side by side or interlinear.

**Architecture:**
- A pure module, `lib/compare.ts`, owns the address format.
- `buildRows` and `Spread` generalise from one compared edition to a list of them.
- `Interlinear` places each compared edition (aligned, whole below, missing or unavailable).
- A client component, `ReaderSettings`, holds the menu and the popup. `ReaderBar` drops the checkbox and select.

**Tech Stack:** Next.js 16, next-intl 4, Tailwind 4, vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-19-reader-compare-settings-design.md`

## Global Constraints

- `with` is a comma-separated list of at most 2 siglas, never the main edition and never repeated.
- `view=interlinear` is the only view parameter, present only when `with` is non-empty.
- Side by side is the default, at every width.
- New strings go in all 6 locales (en, it, es, fr, de, pt), and `i18n/__tests__/messages.test.ts` must stay green.
- `npm test`, `npx tsc --noEmit` and `npm run lint` must all be clean.

## Review Focus

- `?with=nabre,NABRE,xx` on a NABRE page: lowercase, duplicate, main and unknown siglas are dropped, and no comparison shows (tested in Task 1).
- A third edition that divides the chapter differently while the second aligns: the second stays in the spread and the third goes below (Task 3).
- A compared edition's verse that the main edition lacks, also present in the third edition: one row, not two (Task 2).
- Removing the second edition when three are open: the third becomes the second (Task 4).
- Switching the main edition to one that is compared: it drops out of `with` (Task 4).

---

### Task 1: Address format (`lib/compare.ts`)

**Files:**
- Create: `lib/compare.ts`
- Test: `lib/__tests__/compare.test.ts`

**Interfaces:**
- Produces:
  - `MAX_COMPARED = 2`
  - `type View = "side-by-side" | "interlinear"`
  - `parseWith(raw: string | undefined, main: string, known: string[]): string[]`
  - `parseView(raw: string | undefined): View`
  - `compareQuery(o: { with: string[]; view: View; tradition?: string }): string`, which returns `""` or `"?..."` with literal commas and sets `tradition` only for `"HEBREW"`.

- [ ] Tests:
  - `parseWith("cei2008,VGCL", "NABRE", known)` returns `["CEI2008","VGCL"]`.
  - `parseWith("NABRE,CEI2008,CEI2008,XX,VGCL,DRB", "NABRE", known)` returns `["CEI2008","VGCL"]`.
  - `parseWith(undefined, …)` returns `[]`.
  - `parseView("interlinear")` returns `"interlinear"`; anything else returns `"side-by-side"`.
  - `compareQuery({with:["CEI2008","VGCL"], view:"interlinear", tradition:"HEBREW"})` returns `"?with=CEI2008,VGCL&view=interlinear&tradition=HEBREW"`.
  - `compareQuery({with:[], view:"interlinear"})` returns `""`.
- [ ] Run them and watch them fail, implement, then watch them pass. Commit.

### Task 2: N-way alignment and Spread

**Files:**
- Modify: `lib/parallel.ts` (`ParallelRow`, `buildRows`)
- Modify: `components/Spread.tsx`
- Test: `lib/__tests__/parallel.test.ts`, `components/__tests__/Spread.test.tsx`

**Interfaces:**
- Produces:
  - `type ParallelRow = { key: string; a?: VerseRow; others: (VerseRow | undefined)[] }`
  - `buildRows(a: VerseRow[], others: VerseRow[][], book: number): ParallelRow[]`
  - `Spread({ sides: SpreadSide[]; rows; chapter; truncated?: boolean[]; view?: View })`, where `sides[0]` is the main edition.

- [ ] Tests:
  - Existing tests are ported to the new signatures.
  - `twoComparedEditionsShareTheRowOfAVerseTheMainLacks`.
  - `threeEditionsSideBySideHaveThreeColumnsAtEveryWidth`: the class contains `grid-cols-3` and no `md:` or `landscape:` grid classes, and there are three edition-name headers.
  - `twoEditionsSideBySideHaveTwoColumns`.
  - `interlinearStacksEachComparedVerseUnderTheMainOneWithItsSigla`: `grid-cols-1`, the cell order a, b, c, sigla tags on b and c, and no column headers.
  - The gap and cap rules for the third edition.
- [ ] Watch them fail, implement, then watch them pass. Commit.

### Task 3: Interlinear places each compared edition

**Files:**
- Modify: `components/Interlinear.tsx`
- Test: `components/__tests__/Interlinear.test.tsx`

**Interfaces:**
- Produces: `InterlinearProps = { heading; main: SpreadSide; others: { side: SpreadSide; second: Second; notice?: NoticeKind | null }[]; rows; bookNum; bookName; chapter; truncated; view: View; redirectTo }`

- [ ] Tests:
  - Existing tests are ported.
  - `alignedSecondStaysInTheSpreadWhileAWholeChapterThirdGoesBelow`: the spread has 2 sides and the note names the third.
  - `oneUnavailableOfTwoKeepsTheSpreadOfTheOther`.
  - `allUnavailableShowsTheBookViewWithANotePerEdition`.
  - `eachCappedComparedEditionShowsItsNotice`.
- [ ] Watch them fail, implement, then watch them pass. Commit.

### Task 4: ReaderSettings and ReaderBar

**Files:**
- Create: `components/ReaderSettings.tsx`
- Modify: `components/ReaderBar.tsx`, `messages/*.json`
- Test: `components/__tests__/ReaderSettings.test.tsx`, plus the ReaderBar part of `components/__tests__/BookPage.test.tsx`

**Interfaces:**
- Consumes: `compareQuery`, `View`.
- Produces:
  - ReaderBar props: `withSiglas: string[]` (replaces `withSigla`), `view: View`.
  - `ReaderSettings({ editions; main; withSiglas; view; esther; tradition; onChange(o: { with?: string[]; view?: View; tradition?: Tradition }) })`
- New `Reader` keys: `settings`, `compare`, `changeSecond`, `addThird`, `changeThird`, `removeThird`, `stopComparing`, `thirdEdition`, `cancel`.

- [ ] Tests:
  - `toolbarHasNoInterlinearCheckboxOrSecondSelect`.
  - `singleEditionMenuOffersOnlyCompare`.
  - `choosingAnEditionInThePopupComparesWithIt`: it pushes `?with=CEI2008`.
  - `addThirdAppendsToWith`.
  - `removeThirdKeepsTheSecond`.
  - `changeSecondReplacesOnlyTheSecond`.
  - `popupNeverOffersTheMainOrTheOtherSlotEdition`.
  - `interlinearSwitchSetsView`.
  - `stopComparingClearsWithAndView`.
  - `menuClosesOnEscapeAndOutsideClick`.
  - `estherTextLivesInTheMenu`.
  - `switchingMainEditionDropsItFromWithAndKeepsView`.
- [ ] Watch them fail, implement, then watch them pass. Translate the new keys into all 6 locales, then run the messages test. Commit.

### Task 5: Pages pass the list and the view

**Files:**
- Modify: `app/[locale]/read/[edition]/[book]/[chapter]/page.tsx`, `app/[locale]/read/[edition]/page.tsx`
- Test: `app/__tests__/pages.test.tsx`

- [ ] Tests:
  - `twoComparedEditionsLoadBothAndAlignThree`: `?with=NABRE,LUZZI` on DRB shows 3 column headers.
  - `interlinearViewIsPassedToTheLayoutAndTheChapterLinks`: the next-chapter link keeps `with=…&view=interlinear`.
  - `theBooksPageRedirectKeepsTheView`.
  - Existing tests stay green.
- [ ] Watch them fail, implement (loading the compared editions with `Promise.all`), then watch them pass. Commit.

### Task 6: Verify in a browser and open the PR

- [ ] Run the full `npm test`, `npx tsc --noEmit` and `npm run lint`.
- [ ] Take Playwright screenshots at 390px and 1280px of: a single edition, the open menu, two editions side by side, three editions, and interlinear. Staging data comes after the deploy; locally, use mocked pages through the tests.
- [ ] Push and open the PR.
