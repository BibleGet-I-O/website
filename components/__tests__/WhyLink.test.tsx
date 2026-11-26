import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...p }: { href: string; children?: React.ReactNode }) => <a href={href} {...p}>{children}</a>,
}));

import { WhyLink } from "@/components/WhyLink";

describe("WhyLink", () => {
  it("opensItsSectionWithANameAndATooltip", () => {
    render(<WhyLink topic="esther" />);
    const a = screen.getByRole("link", { name: "Why do the Greek and Hebrew texts differ?" });
    expect(a).toHaveAttribute("href", "/docs/why-editions-differ#esther");
    expect(a).toHaveAttribute("title", "Why do the Greek and Hebrew texts differ?");
  });

  it("isReadableInBothThemes", () => {
    // slate-400 on white (2.6:1) failed WCAG's 3:1 for icons and 4.5:1 for the "Why?" text.
    render(<WhyLink topic="esther" />);
    const a = screen.getByRole("link");
    expect(a).toHaveClass("text-slate-500", "dark:text-slate-400");
    expect(a).not.toHaveClass("text-slate-400");
  });

  it("aShortOneReadsWhy", () => {
    render(<WhyLink topic="missing-verses" short />, { locale: "it" });
    const a = screen.getByRole("link", { name: "Perché questa edizione non ha questo versetto?" });
    expect(a).toHaveTextContent("Perché?");
    expect(a).toHaveAttribute("href", "/docs/why-editions-differ#missing-verses");
  });
});
