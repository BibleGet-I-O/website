import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { markPhrase, markWords, queryWords } from "@/components/SearchResults";

const marks = (text: string, phrase: string) =>
  Array.from(render(<p>{markPhrase(text, phrase)}</p>).container.querySelectorAll("mark")).map((m) => m.textContent);

describe("ligatures", () => {
  const words = (text: string, w: string) =>
    Array.from(render(<p>{markWords(text, [w])}</p>).container.querySelectorAll("mark")).map((m) => m.textContent);

  it("markEitherSpellingAsTheSearchFindsIt", () => {
    expect(words("arcam fœderis et cælum", "foederis")).toEqual(["fœderis"]);
    expect(words("Œconomus", "oeconomus")).toEqual(["Œconomus"]);
    expect(words("arcam foederis", "fœderis")).toEqual(["foederis"]);
    expect(words("cælum et terram", "caelum")).toEqual(["cælum"]);
    expect(words("Straße", "strasse")).toEqual(["Straße"]);
    expect(marks("arcam fœderis Domini", "arcam foederis")).toEqual(["arcam fœderis"]);
  });
});

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

  it("keepsDecomposedAccentsInsideTheWord", () => {
    // "Señor" stored as "Sen" + U+0303 + "or": one word, marked whole, its accent kept.
    expect(marks("el Sen\u0303or es mi pastor", "el señor")).toEqual(["el Sen\u0303or"]);
  });

  it("anEmptyPhraseMarksNothing", () => {
    expect(marks("pastor de ovejas", "  ")).toEqual([]);
  });
});

describe("markWords", () => {
  it("keepsDecomposedAccentsInsideTheWord", () => {
    const marked = Array.from(render(<p>{markWords("el Sen\u0303or es mi pastor", ["señor"])}</p>).container.querySelectorAll("mark")).map((m) => m.textContent);
    expect(marked).toEqual(["Sen\u0303or"]);
  });
});

describe("queryWords", () => {
  it("keeps a decomposed accent inside its word", () => {
    expect(queryWords("Señor mío")).toEqual(["Señor", "mío"]);
  });
});
