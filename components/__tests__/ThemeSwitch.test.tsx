import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { ThemeSwitch } from "@/components/ThemeSwitch";

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {ui}
  </NextIntlClientProvider>
);
const systemDark = (matches: boolean) => {
  window.matchMedia = vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() });
};
const button = () => screen.getByRole("button", { name: /theme/ });
const saved = () => document.cookie.match(/(?:^|; )theme=([^;]*)/)?.[1] ?? null;

beforeEach(() => {
  delete document.documentElement.dataset.theme;
  document.cookie = "theme=; Path=/; Max-Age=0";
});

describe("ThemeSwitch", () => {
  it("followsTheSystemUntilClickedThenRemembersTheOtherTheme", () => {
    systemDark(false);
    render(wrap(<ThemeSwitch />));
    expect(saved()).toBeNull();
    fireEvent.click(button());
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(saved()).toBe("dark");
  });

  it("onADarkSystemTheFirstClickGoesLight", () => {
    systemDark(true);
    render(wrap(<ThemeSwitch />));
    fireEvent.click(button());
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(saved()).toBe("light");
  });

  it("clickingBackToTheSystemsThemeForgetsTheChoice", () => {
    systemDark(false);
    document.documentElement.dataset.theme = "dark";
    document.cookie = "theme=dark; Path=/";
    render(wrap(<ThemeSwitch />));
    fireEvent.click(button());
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(saved()).toBeNull();
  });

  it("twoClicksFromTheSystemComeBackToFollowingIt", () => {
    systemDark(true);
    render(wrap(<ThemeSwitch />));
    fireEvent.click(button());
    fireEvent.click(button());
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(saved()).toBeNull();
  });

  it("saysWhereItWillSwitchTo", () => {
    render(wrap(<ThemeSwitch />));
    // Which label shows is CSS's (the dark: variant), so the page is right before any script runs.
    expect(screen.getByText("Switch to dark theme")).toHaveClass("dark:hidden");
    expect(screen.getByText("Switch to light theme")).toHaveClass("hidden", "dark:inline");
  });
});
