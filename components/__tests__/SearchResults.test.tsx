import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { markPhrase } from "@/components/SearchResults";

const marks = (text: string, phrase: string) =>
  Array.from(render(<p>{markPhrase(text, phrase)}</p>).container.querySelectorAll("mark")).map((m) => m.textContent);

describe("markPhrase", () => {
  it("marksOnlyThePhraseNotItsWordsElsewhere", () => {
    // BLPD: "pastor de ovejas" — the other "de" in the verse is not part of the phrase.
    expect(marks("Abel fue pastor de ovejas y Caín agricultor de la tierra.", "pastor de ovejas")).toEqual(["pastor de ovejas"]);
  });

  it("comparesWithoutCaseOrAccentsAndKeepsTheVersesSpelling", () => {
    expect(marks("Y Caín dijo: «PASTOR de ovejas»", "pastor de ovéjas")).toEqual(["PASTOR de ovejas"]);
  });

  it("marksEveryOccurrenceOfThePhrase", () => {
    expect(marks("pastor de ovejas, y otro pastor de ovejas", "pastor de ovejas")).toEqual(["pastor de ovejas", "pastor de ovejas"]);
  });

  it("matchesWholeWordsOnly", () => {
    expect(marks("los pastores de ovejas", "pastor de ovejas")).toEqual([]);
  });

  it("marksASingleWordPhraseAsAWholeWord", () => {
    expect(marks("Israël and Israelites", "israel")).toEqual(["Israël"]);
  });

  it("anEmptyPhraseMarksNothing", () => {
    expect(marks("pastor de ovejas", "  ")).toEqual([]);
  });
});
