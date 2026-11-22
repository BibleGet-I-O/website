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

  it("foldsLanguageThemeAndSignInIntoTheMenu", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <SiteHeader auth={<span>auth</span>} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
    const nav = within(screen.getByRole("navigation", { hidden: true }));
    expect(nav.getByRole("button", { name: "Language", hidden: true })).toBeInTheDocument();
    expect(nav.getByRole("button", { name: /Switch to (dark|light) theme/, hidden: true })).toBeInTheDocument();
    expect(nav.getByText("auth")).toBeInTheDocument();
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
