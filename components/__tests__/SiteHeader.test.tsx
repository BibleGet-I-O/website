import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

import { SiteHeader } from "@/components/SiteHeader";

describe("SiteHeader", () => {
  it("linksHomeWithTheBibleGetLogo", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <SiteHeader auth={<span>auth</span>} />
      </NextIntlClientProvider>,
    );
    const home = screen.getByRole("link", { name: "BibleGet" });
    expect(home).toHaveAttribute("href", "/en");
    const logo = home.querySelector("img");
    expect(logo).toHaveAttribute("src", "/bibleget-logo.png");
    // The link text names it; the logo is decorative.
    expect(logo).toHaveAttribute("alt", "");
    expect(screen.getByRole("banner")).toHaveTextContent("auth");
  });
});
