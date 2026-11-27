import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { AccessInfo } from "@/lib/access";

vi.mock("server-only", () => ({}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, v?: { edition: string }) => (v ? `${key}:${v.edition}` : key),
  setRequestLocale: () => {},
}));
const access = vi.fn<() => Promise<AccessInfo>>();
vi.mock("@/lib/access", () => ({ getAccess: () => access() }));
vi.mock("@/components/SignInButton", () => ({
  SignInButton: async ({ redirectTo }: { redirectTo?: string }) => <button data-redirect={redirectTo}>sign in</button>,
}));
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<object>()),
  getEditions: async () => [
    { sigla: "NVBSE", fullname: "Nova Vulgata", language: "la", copyright: true },
    { sigla: "VGCL", fullname: "Vulgata Clementina", language: "la", copyright: false },
  ],
  getIndex: async () => ({ books: [] }),
}));
const getEntityIndex = vi.fn(async () => []);
vi.mock("@/lib/entities", async (orig) => ({ ...(await orig<object>()), getEntityIndex: (...a: unknown[]) => getEntityIndex(...(a as [])) }));

const { EntityIndexPage } = await import("@/components/EntityIndexPage");

const wrap = (ui: React.ReactNode) => <NextIntlClientProvider locale="en" messages={en}>{ui}</NextIntlClientProvider>;
const visitor: AccessInfo = { access: "visitor", signedIn: false, emailVerified: false };
const unverified: AccessInfo = { access: "visitor", signedIn: true, emailVerified: false };
const reader: AccessInfo = { access: "reader", signedIn: true, emailVerified: true };
const page = async (edition: string, back?: string) =>
  render(wrap(await EntityIndexPage({ params: Promise.resolve({ locale: "en", edition }), searchParams: Promise.resolve(back ? { back } : {}), type: "person" })));

beforeEach(() => {
  access.mockReset();
  getEntityIndex.mockClear();
});

describe("EntityIndexPage", () => {
  it("asksAVisitorToSignInForACopyrightedEditionsIndex", async () => {
    access.mockResolvedValue(visitor);
    await page("nvbse", "/en/read/nvbse/genesis/12");
    expect(screen.getByRole("heading", { level: 1, name: "Persons in Nova Vulgata" })).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(en.Reader.indices.signIn);
    expect(screen.getByRole("button", { name: "sign in" })).toHaveAttribute("data-redirect", "/en/read/nvbse/persons?back=%2Fen%2Fread%2Fnvbse%2Fgenesis%2F12");
    expect(screen.getByRole("link", { name: "Back to the reader" })).toHaveAttribute("href", "/en/read/nvbse/genesis/12");
    expect(getEntityIndex).not.toHaveBeenCalled();
  });

  it("asksASignedInReaderWithoutAVerifiedEmailToVerifyIt", async () => {
    access.mockResolvedValue(unverified);
    await page("nvbse");
    expect(screen.getByRole("note")).toHaveTextContent(en.Reader.indices.verify);
    expect(screen.queryByRole("button")).toBeNull();
    expect(getEntityIndex).not.toHaveBeenCalled();
  });

  it("showsACopyrightedEditionsIndexToAReader", async () => {
    access.mockResolvedValue(reader);
    await page("nvbse");
    expect(screen.queryByRole("note")).toBeNull();
    expect(getEntityIndex).toHaveBeenCalledWith("NVBSE", "person");
  });

  it("showsAPublicDomainEditionsIndexToEveryone", async () => {
    access.mockResolvedValue(visitor);
    await page("vgcl");
    expect(screen.queryByRole("note")).toBeNull();
    expect(getEntityIndex).toHaveBeenCalledWith("VGCL", "person");
  });
});
