import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import it_ from "@/messages/it.json";

const { nav } = vi.hoisted(() => ({ nav: { pathname: "/read/nabre/genesis/1", replace: vi.fn() } }));
vi.mock("@/i18n/navigation", () => ({ usePathname: () => nav.pathname, useRouter: () => ({ replace: nav.replace }) }));

import { LocalePicker, writeLocaleCookie } from "@/components/LocalePicker";

function picker(locale: "en" | "it" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : it_}>
      <LocalePicker />
    </NextIntlClientProvider>,
  );
}

const open = () => fireEvent.click(screen.getByRole("button", { expanded: false }));

describe("LocalePicker", () => {
  beforeEach(() => {
    nav.replace.mockReset();
    document.cookie = "NEXT_LOCALE=; Max-Age=0; Path=/";
    window.history.replaceState(null, "", "/en/read/nabre/genesis/1?with=VGCLEM#v3");
  });

  it("isAGlobeButtonNamedForTheLanguageSetting", () => {
    picker("it");
    const button = screen.getByRole("button", { name: "Lingua" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveTextContent("it");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("listsTheSixLanguagesInTheirOwnNamesTheCurrentOneMarked", () => {
    picker("it");
    open();
    const items = within(screen.getByRole("list")).getAllByRole("button");
    expect(items.map((o) => o.textContent)).toEqual(["English", "Italiano", "Español", "Français", "Deutsch", "Português"]);
    expect(items.map((o) => o.getAttribute("lang"))).toEqual(["en", "it", "es", "fr", "de", "pt"]);
    expect(screen.getByRole("button", { name: "Italiano" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "English" })).not.toHaveAttribute("aria-current");
  });

  it("theListFloatsOverThePageAtEveryWidth", () => {
    // In the header bar (not a menu panel), an open list in the flow would push the bar apart on a phone.
    picker();
    open();
    expect(screen.getByRole("list")).toHaveClass("absolute", "right-0", "top-full");
    expect(screen.getByRole("list").className).not.toMatch(/sm:absolute/);
  });

  it("savesTheChoiceAndOpensTheSamePageQueryAndHashInThatLanguage", () => {
    picker();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Deutsch" }));
    expect(document.cookie).toContain("NEXT_LOCALE=de");
    expect(nav.replace).toHaveBeenCalledWith("/read/nabre/genesis/1?with=VGCLEM#v3", { locale: "de" });
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("closesWithoutNavigatingWhenTheCurrentLanguageIsChosen", () => {
    picker();
    open();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(nav.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("closesOnEscapeWithoutTheEscapeReachingThePage", () => {
    const onDocKey = vi.fn();
    document.addEventListener("keydown", onDocKey);
    picker();
    open();
    fireEvent.keyDown(screen.getByRole("button", { name: "English" }), { key: "Escape" });
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Language" })).toHaveFocus();
    expect(onDocKey).not.toHaveBeenCalled();
    document.removeEventListener("keydown", onDocKey);
  });

  it("closesOnAClickOutside", () => {
    picker();
    open();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("writesASiteWideYearLongLaxCookie", () => {
    expect(writeLocaleCookie("fr", false)).toBe("NEXT_LOCALE=fr; Path=/; Max-Age=31536000; SameSite=Lax");
    expect(writeLocaleCookie("fr", true)).toBe("NEXT_LOCALE=fr; Path=/; Max-Age=31536000; SameSite=Lax; Secure");
  });
});
