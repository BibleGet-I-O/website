import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

vi.mock("next/navigation", async (orig) => ({ ...(await orig<object>()), usePathname: () => "/en", useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

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
  });

  it("keepsLanguageAndThemeInTheBarAndFoldsPagesAndSignInIntoTheMenu", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <SiteHeader auth={<span>auth</span>} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
    const panel = screen.getByRole("navigation", { hidden: true });
    // Actions, not pages: always in the bar, never behind the hamburger.
    const language = screen.getByRole("button", { name: "Language" });
    const theme = screen.getByRole("button", { name: /Switch to (dark|light) theme/ });
    expect(panel).not.toContainElement(language);
    expect(panel).not.toContainElement(theme);
    expect(within(panel).getByText("auth")).toBeInTheDocument();
  });

  it("linksTheApiReference", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <SiteHeader auth={<span>auth</span>} />
      </NextIntlClientProvider>,
    );
    const nav = within(screen.getByRole("navigation", { hidden: true }));
    expect(nav.getByRole("link", { name: "API", hidden: true })).toHaveAttribute("href", "/en/scalar");
  });
});
