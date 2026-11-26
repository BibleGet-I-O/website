import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...p }: { href: string; children?: React.ReactNode }) => <a href={href} {...p}>{children}</a>,
}));

import { ReaderLink, readerHref } from "@/components/docs/ReaderLink";

describe("ReaderLink", () => {
  it("linksToTheVerseThroughTheBooksPage", () => {
    expect(readerHref({ edition: "NABRE", book: 27, chapter: 11, verse: 26 })).toBe("/read/nabre?book=27&chapter=11#v11.26");
    expect(readerHref({ edition: "NABRE", book: 27, chapter: 11 })).toBe("/read/nabre?book=27&chapter=11");
  });

  it("keepsTheComparison", () => {
    expect(readerHref({ edition: "NABRE", book: 27, chapter: 11, verse: 26, with: ["VGCL"], view: "interlinear" }))
      .toBe("/read/nabre?book=27&chapter=11&with=VGCL&view=interlinear#v11.26");
    expect(readerHref({ edition: "CEI2008", book: 23, chapter: 23, with: ["VGCL"], tradition: "HEBREW" }))
      .toBe("/read/cei2008?book=23&chapter=23&with=VGCL&tradition=HEBREW");
  });

  it("keepsTheInterlinearViewOfEsthersTwoTexts", () => {
    expect(readerHref({ edition: "NABRE", book: 19, chapter: 4, view: "interlinear", twoTexts: true }))
      .toBe("/read/nabre?book=19&chapter=4&view=interlinear");
  });

  it("rendersALink", () => {
    render(<ReaderLink edition="DRB" book={19} chapter={1}>Esther 1</ReaderLink>);
    expect(screen.getByRole("link", { name: "Esther 1" })).toHaveAttribute("href", "/read/drb?book=19&chapter=1");
  });
});
