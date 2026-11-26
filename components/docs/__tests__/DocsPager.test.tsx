import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...p }: { href: string; children?: React.ReactNode }) => <a href={href} {...p}>{children}</a>,
}));

import { DocsPager } from "@/components/docs/DocsPager";

describe("DocsPager", () => {
  it("linksThePreviousAndNextPages", () => {
    render(<DocsPager slug="why-editions-differ" />);
    expect(screen.getByRole("link", { name: /How the Bible reached us/ })).toHaveAttribute("href", "/docs/how-the-bible-reached-us");
    expect(screen.getByRole("link", { name: /The Hebrew text/ })).toHaveAttribute("href", "/docs/hebrew-text");
  });

  it("theFirstPageHasNoPrevious", () => {
    render(<DocsPager slug="how-the-bible-reached-us" />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("isInTheInterfaceLanguage", () => {
    render(<DocsPager slug="qumran" />, { locale: "it" });
    expect(screen.getByRole("link", { name: /Successiva: La Settanta/ })).toBeInTheDocument();
  });
});
