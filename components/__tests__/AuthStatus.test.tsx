import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth(), signIn: vi.fn(), signOut: vi.fn() }));

const { AuthStatus } = await import("@/components/AuthStatus");
const { safeRedirect } = await import("@/components/SignInButton");

beforeEach(() => auth.mockReset());

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

describe("safeRedirect", () => {
  it("keeps a same-origin path and falls back on anything else", () => {
    expect(safeRedirect("/en/read/NABRE/john/3", "/en")).toBe("/en/read/NABRE/john/3");
    for (const bad of ["https://evil.test/", "//evil.test", "/\\evil.test", "", undefined, null]) {
      expect(safeRedirect(bad, "/en")).toBe("/en");
    }
  });
});
