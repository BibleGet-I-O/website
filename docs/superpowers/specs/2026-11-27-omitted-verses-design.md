# Omitted verses in the reader

## Intent

The Nova Vulgata keeps the number of a verse its critical text omits and prints it in brackets without text
("(7)" in Acts 24). The reader printed nothing, so the numbers jumped (6, 8) and a reader could think the site had lost
a verse. Other editions skip numbers for the same reason (*El Libro del Pueblo de Dios* has no Mark 9:44).

## Design (approved 2026-11-27)

- In the book view, where an edition skips a number inside a chapter, print the number as usual followed by a red
  rubric `[omissis]` (Latin in every interface language, `lang="la"`) and the ⓘ Why? link to
  *Why editions differ* `#missing-verses`.
- Consecutive skipped numbers make one line: `10–11 [omissis]` (Sir 9).
- Not shown: a chapter that only ends sooner (NABRE Ps 2), or starts later because its first verse is printed in the
  previous chapter (NABRE Wis 12:1), and no number that appears anywhere among the chapter's rows (transposed verses).
- The line has the verse's anchor (`v24.7`), so a link to the verse lands on it.
- Comparisons keep their existing `GapNote`.
- The docs section `missing-verses` says how the Nova Vulgata prints these numbers and what the reader shows.

## Approaches

Empty brackets as printed ("(7)") were the alternative: faithful to the page but unexplained to most readers. The user
chose the rubric, in Latin.

## Plan

1. `lib/why.ts`: `omittedAfter(rows, chapter): Map<number, [number, number]>`: for the row index after which a gap
   falls, the first and last skipped numbers. Tests in `lib/__tests__/why.test.ts`: Acts 24 (6, 8 → 7–7), Sir 9 (9, 12 →
   10–11), no gap at the start or end, none for a number printed among the rows (1, 2, 5, 6, 3, 4), none across rows of
   another chapter, Ez 40:42a/43a/42b/43b order gives none.
2. `components/BookPage.tsx` renders the line after that row; `BookPage.test.tsx`: the sup "7", the text `[omissis]`
   with `lang="la"`, the Why? link to `/docs/why-editions-differ#missing-verses`, the id `v24.7`.
3. `content/docs/en/why-editions-differ.mdx`: one sentence in `missing-verses`.
