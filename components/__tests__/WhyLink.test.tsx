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

  it("aShortOneReadsWhy", () => {
    render(<WhyLink topic="missing-verses" short />, { locale: "it" });
    const a = screen.getByRole("link", { name: "Perché questa edizione non ha questo versetto?" });
    expect(a).toHaveTextContent("Perché?");
    expect(a).toHaveAttribute("href", "/docs/why-editions-differ#missing-verses");
  });
});
