# Speaker tags explained Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A speaker tag in the text (`W`, `M`, `D`, `D?`, VGCL's `Sponsa`…) explains who speaks, on tap (popover) and on hover (tooltip).

**Architecture:** `renderVerse` (lib/formatted.tsx, used by server components) renders the `speaker` tag through a small client component, `SpeakerTag`, which looks the tag up in a fixed table and uses the native `popover` attribute (no JavaScript needed to open it) plus a `title` for hover. Meanings are next-intl strings.

**Tech Stack:** Next.js 16, React 19, next-intl 4, Vitest + Testing Library.

**Spec:** endpoint `docs/superpowers/specs/2026-11-23-footnotes-design.md`, Part 1.

## Global Constraints

- Meanings (spec Part 1): NABRE W = the woman, M = the man, D = the Daughters of Jerusalem; a trailing `?` reads "probably … (the attribution is uncertain)". VGCL: Sponsa = the bride, Sponsus = the bridegroom, Chorus = the chorus, Chorus Fratrum = the chorus of the brothers, Chorus Adolescentularum = the chorus of the maidens. An unknown tag renders exactly as today (a plain `span.bg-speaker`, no popover).
- Six locales: strings in `messages/en.json`, `npm run sync-messages`, then translated in it/es/fr/de/pt.
- The tag's look (`.bg-speaker`) and the line indentation rule (`bg-has-speaker`) stay as they are.

## Review Focus

- A verse rendered twice on one page (a comparison, the Esther spread) must not give two popovers the same id. (Test `eachTagHasItsOwnPopover`.)
- Keyboard users can open it (a real `<button>`), and screen readers hear the meaning, not only "D?". (Test `theButtonCarriesTheMeaning`.)

---

### Task 1: The speaker table and `SpeakerTag`

**Files:**
- Create: `lib/speakers.ts`, `components/SpeakerTag.tsx`
- Modify: `lib/formatted.tsx` (render `speaker` through `SpeakerTag`), `app/globals.css` (button reset for `.bg-speaker`, popover style), `messages/*.json` (namespace `Speakers`)
- Test: `lib/__tests__/speakers.test.ts`, `components/__tests__/SpeakerTag.test.tsx`, `lib/__tests__/formatted.test.tsx`

**Interfaces:**
- `speakerOf(tag: string): { who: SpeakerKey; uncertain: boolean } | null` with `SpeakerKey = "woman" | "man" | "daughters" | "bride" | "bridegroom" | "chorus" | "brothers" | "maidens"`.
- `SpeakerTag({ tag }: { tag: string })`: client component; known tag → `<button type="button" class="bg-speaker" popovertarget={id} title={meaning} aria-label="{tag}: {meaning}">{tag}</button>` + `<span popover="auto" id={id} role="tooltip">{meaning}</span>`; unknown → `<span class="bg-speaker">{tag}</span>`.
- Strings `Speakers.who.{SpeakerKey}` ("the woman", …), `Speakers.certain` ("{who}"), `Speakers.uncertain` ("probably {who} (the attribution is uncertain)").

- [ ] **Step 1: Failing tests**: `speakerOf("D?")` → `{ who: "daughters", uncertain: true }`, `speakerOf("Chorus Fratrum")` → `brothers`, `speakerOf("X")` → null; `SpeakerTag tag="D?"` → button named "D?: probably the Daughters of Jerusalem (the attribution is uncertain)" whose `popovertarget` is the id of an element with that text; unknown tag → no button; `renderVerse("<pof><speaker>W</speaker> text</pof>")` contains a button named /^W: the woman$/ and keeps `bg-has-speaker` on the line; two `SpeakerTag`s get different ids.
- [ ] **Step 2: Run** `npx vitest run lib/__tests__/speakers.test.ts components/__tests__/SpeakerTag.test.tsx lib/__tests__/formatted.test.tsx` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement**; strings in six languages.
- [ ] **Step 4: Run** `npx vitest run && npm run lint && npm run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(reader): speaker tags explain who speaks`.
