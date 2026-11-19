import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { ThemeSwitch } from "@/components/ThemeSwitch";

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {ui}
  </NextIntlClientProvider>
);

beforeEach(() => {
  delete document.documentElement.dataset.theme;
  document.cookie = "theme=; Path=/; Max-Age=0";
});

describe("ThemeSwitch", () => {
  it("startsFromTheServersChoice", () => {
    render(wrap(<ThemeSwitch initial="system" />));
    expect(screen.getByRole("combobox", { name: "Theme" })).toHaveValue("system");
  });

  it("choosingDarkSetsThePageAndTheCookie", () => {
    render(wrap(<ThemeSwitch initial="system" />));
    fireEvent.change(screen.getByRole("combobox", { name: "Theme" }), { target: { value: "dark" } });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.cookie).toContain("theme=dark");
  });

  it("choosingSystemClearsBoth", () => {
    document.documentElement.dataset.theme = "light";
    render(wrap(<ThemeSwitch initial="light" />));
    fireEvent.change(screen.getByRole("combobox", { name: "Theme" }), { target: { value: "system" } });
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.cookie).not.toContain("theme=");
  });
});
