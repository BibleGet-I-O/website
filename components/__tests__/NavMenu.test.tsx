import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import de from "@/messages/de.json";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn(() => "/") }));
vi.mock("@/i18n/navigation", () => ({ usePathname: pathnameMock }));

import { NavMenu } from "@/components/NavMenu";

function tree(locale: "en" | "de" = "en") {
  return (
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : de}>
      <div>
        <NavMenu>
          <a href="#admin" onClick={(e) => e.preventDefault()}>Admin</a>
          <button type="button">Sign in</button>
        </NavMenu>
        <p>outside</p>
      </div>
    </NextIntlClientProvider>
  );
}

const openButton = () => screen.getByRole("button", { name: "Open menu" });

describe("NavMenu", () => {
  beforeEach(() => pathnameMock.mockReturnValue("/"));

  it("startsClosedWithAButtonThatControlsThePanel", () => {
    render(tree());
    expect(openButton()).toHaveAttribute("aria-expanded", "false");
    const nav = screen.getByRole("navigation", { hidden: true });
    expect(openButton()).toHaveAttribute("aria-controls", nav.id);
    // Closed below the breakpoint, a row from `sm` up.
    expect(nav).toHaveClass("hidden", "sm:flex", "sm:flex-row");
  });

  it("opensTheItemsAsAVerticalPanel", () => {
    render(tree());
    fireEvent.click(openButton());
    const nav = screen.getByRole("navigation");
    expect(nav).toHaveClass("flex", "flex-col");
    expect(nav).not.toHaveClass("hidden");
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  it("closesOnEscapeAndReturnsFocus", () => {
    render(tree());
    fireEvent.click(openButton());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(openButton()).toHaveAttribute("aria-expanded", "false");
    expect(openButton()).toHaveFocus();
  });

  it("closesOnAClickOutsideNotInside", () => {
    render(tree());
    fireEvent.click(openButton());
    fireEvent.pointerDown(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("button", { name: "Close menu" })).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByText("outside"));
    expect(openButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("closesWhenOneOfItsLinksIsFollowed", () => {
    render(tree());
    fireEvent.click(openButton());
    fireEvent.click(screen.getByRole("link", { name: "Admin" }));
    expect(openButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("closesOnNavigationAndOnBackForward", () => {
    const { rerender } = render(tree());
    fireEvent.click(openButton());
    pathnameMock.mockReturnValue("/read/nabre");
    rerender(tree());
    expect(openButton()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(openButton());
    fireEvent(window, new PopStateEvent("popstate"));
    expect(openButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("closesWhenTheLanguageChanges", () => {
    const { rerender } = render(tree("en"));
    fireEvent.click(openButton());
    rerender(tree("de"));
    expect(screen.getByRole("button", { name: "Menü öffnen" })).toHaveAttribute("aria-expanded", "false");
  });
});
