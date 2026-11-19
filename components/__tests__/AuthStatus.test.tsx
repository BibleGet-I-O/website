import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth(), signIn: vi.fn(), signOut: vi.fn() }));
let requestHeaders = new Headers();
vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));

const { AuthStatus } = await import("@/components/AuthStatus");
const { safeRedirect } = await import("@/components/SignInButton");

beforeEach(() => {
  auth.mockReset();
  requestHeaders = new Headers();
});

describe("AuthStatus", () => {
  it("shows a sign-in button to a visitor", async () => {
    auth.mockResolvedValue(null);
    render(await AuthStatus());
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows the signed-in user and a sign-out button", async () => {
    auth.mockResolvedValue({ user: { email: "dev@bibleget.localhost" }, expires: "2099", emailVerified: true, admin: false });
    render(await AuthStatus());
    expect(screen.getByText("dev@bibleget.localhost")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("asks to sign in again when the session's refresh was rejected", async () => {
    auth.mockResolvedValue({ user: { email: "a@b.c" }, expires: "2099", emailVerified: true, admin: false, error: "RefreshAccessTokenError" });
    render(await AuthStatus());
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });
});

describe("AuthStatus sign-in return target", () => {
  const returnTo = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[name="redirectTo"]')?.value;

  it("returns to the current page and query that the proxy forwarded", async () => {
    auth.mockResolvedValue(null);
    requestHeaders = new Headers({ "x-bibleget-return-to": "/en/read/NABRE/john/3?with=VGCL" });
    const { container } = render(await AuthStatus());
    expect(returnTo(container)).toBe("/en/read/NABRE/john/3?with=VGCL");
  });

  it("falls back to the locale's home page without one, or for an unsafe one", async () => {
    auth.mockResolvedValue(null);
    const { container, unmount } = render(await AuthStatus());
    expect(returnTo(container)).toBe("/en");
    unmount();
    requestHeaders = new Headers({ "x-bibleget-return-to": "//evil.test/x" });
    const second = render(await AuthStatus());
    expect(returnTo(second.container)).toBe("/en");
  });
});

describe("safeRedirect", () => {
  it("keeps a same-origin path and falls back on anything else", () => {
    expect(safeRedirect("/en/read/NABRE/john/3", "/en")).toBe("/en/read/NABRE/john/3");
    for (const bad of ["https://evil.test/", "//evil.test", "/\\evil.test", "", undefined, null]) {
      expect(safeRedirect(bad, "/en")).toBe("/en");
    }
  });
});

describe("AuthStatus admin link", () => {
  it("shows Admin only to an admin", async () => {
    auth.mockResolvedValue({ user: { email: "a@b.c" }, expires: "2099", emailVerified: true, admin: true });
    const wrap = (ui: React.ReactNode) => (
      <NextIntlClientProvider locale="en" messages={en}>
        {ui}
      </NextIntlClientProvider>
    );
    const { unmount } = render(wrap(await AuthStatus()));
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", expect.stringContaining("/admin/editions"));
    unmount();
    auth.mockResolvedValue({ user: { email: "a@b.c" }, expires: "2099", emailVerified: true, admin: false });
    render(wrap(await AuthStatus()));
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
  });
});
