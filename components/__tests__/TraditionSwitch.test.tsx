import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

vi.mock("server-only", () => ({}));
const { TraditionSwitch } = await import("@/components/TraditionSwitch");

describe("TraditionSwitch", () => {
  it("offersBothTextsAndMarksTheCurrentOne", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        {await TraditionSwitch({ tradition: "HEBREW", hrefFor: (t) => (t === "HEBREW" ? "/x?tradition=HEBREW" : "/x") })}
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("navigation", { name: "Esther text" })).toBeInTheDocument();
    const lxx = screen.getByRole("link", { name: "Septuagint" });
    const mt = screen.getByRole("link", { name: "Masoretic text" });
    expect(lxx).toHaveAttribute("href", "/en/x");
    expect(lxx).not.toHaveAttribute("aria-current");
    expect(mt).toHaveAttribute("href", "/en/x?tradition=HEBREW");
    expect(mt).toHaveAttribute("aria-current", "true");
    // Both read at full contrast (small text needs 4.5:1): the current one is marked by weight and underline.
    for (const link of [lxx, mt]) expect(link.className).not.toMatch(/text-red-\d+\/\d+/);
    expect(mt).toHaveClass("font-bold", "underline");
    expect(lxx).not.toHaveClass("font-bold");
  });

  it("everyLocaleHasTheFourLabels", () => {
    const want: Record<string, [string, string, string, string]> = {
      en: ["Septuagint", "Masoretic text", "LXX", "MT"],
      it: ["Settanta", "Testo masoretico", "LXX", "TM"],
      es: ["Septuaginta", "Texto masorético", "LXX", "TM"],
      fr: ["Septante", "Texte massorétique", "LXX", "TM"],
      de: ["Septuaginta", "Masoretischer Text", "LXX", "MT"],
      pt: ["Septuaginta", "Texto massorético", "LXX", "TM"],
    };
    for (const [locale, [lxx, mt, lxxShort, mtShort]] of Object.entries(want)) {
      const r = JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")).Reader;
      expect([r.septuagint, r.masoretic, r.septuagintShort, r.masoreticShort], locale).toEqual([lxx, mt, lxxShort, mtShort]);
      // The ⚙ menu's Greek / Hebrew select is gone, and its labels with it.
      expect(r.greek, locale).toBeUndefined();
      expect(r.hebrew, locale).toBeUndefined();
    }
  });
});
