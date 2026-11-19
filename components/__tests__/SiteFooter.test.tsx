import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import en from "@/messages/en.json";

vi.mock("server-only", () => ({}));
const getApiVersion = vi.fn();
vi.mock("@/lib/api", () => ({ getApiVersion: () => getApiVersion() }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async (namespace: string) => createTranslator({ locale: "en", messages: en, namespace: namespace as "Footer" }),
  };
});
vi.mock("@/lib/release", () => ({ RELEASE: "12345-1", COMMIT: "0123456789abcdef0123456789abcdef01234567" }));

const { SiteFooter } = await import("@/components/SiteFooter");

beforeEach(() => getApiVersion.mockReset());

const SHA = "8afaf1d1234567890abcdef1234567890abcdef0";

async function footer(version: string | null) {
  getApiVersion.mockResolvedValue(version);
  const view = render(await SiteFooter());
  return { ...view, el: screen.getByRole("contentinfo") };
}

describe("SiteFooter", () => {
  it("linksAReleaseTagToItsGitHubRelease", async () => {
    const { el } = await footer("v4.0.0");
    const a = screen.getByRole("link", { name: "API v4.0.0" });
    expect(a).toHaveAttribute("href", "https://github.com/BibleGet-I-O/endpoint/releases/tag/v4.0.0");
    expect(el).toHaveTextContent("API v4.0.0");
  });

  it("linksAFullShaToItsCommitShowingSevenCharacters", async () => {
    await footer(SHA);
    const a = screen.getByRole("link", { name: "API 8afaf1d" });
    expect(a).toHaveAttribute("href", `https://github.com/BibleGet-I-O/endpoint/commit/${SHA}`);
  });

  it("linksTheDescribeFormToTheCommitAfterG", async () => {
    await footer("v3.0.0-673-g8afaf1d");
    const a = screen.getByRole("link", { name: "API v3.0.0-673-g8afaf1d" });
    expect(a).toHaveAttribute("href", "https://github.com/BibleGet-I-O/endpoint/commit/8afaf1d");
  });

  it("showsAMalformedVersionAsPlainTextWithoutLink", async () => {
    const hostile = '<img src=x onerror="alert(1)">../x';
    const { el, container } = await footer(hostile);
    expect(el).toHaveTextContent(`API ${hostile}`);
    expect(screen.queryByRole("link", { name: /^API / })).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("linksTheSiteCommit", async () => {
    await footer("v4.0.0");
    const a = screen.getByRole("link", { name: "Site 0123456" });
    expect(a).toHaveAttribute("href", "https://github.com/BibleGet-I-O/website/commit/0123456789abcdef0123456789abcdef01234567");
  });

  it("showsNoApiVersionWhenTheHeaderIsAbsent", async () => {
    const { el } = await footer(null);
    expect(el).not.toHaveTextContent("API v");
    expect(screen.queryByRole("link", { name: /^API / })).toBeNull();
    expect(el).toHaveTextContent("Site 0123456");
  });

  it("linksTheSourceRepositories", async () => {
    await footer(null);
    expect(screen.getByRole("link", { name: "Website" })).toHaveAttribute("href", "https://github.com/BibleGet-I-O/website");
    expect(screen.getByRole("link", { name: "API" })).toHaveAttribute("href", "https://github.com/BibleGet-I-O/endpoint");
  });

  it("carriesTheFoundationsCopyrightForTheCurrentYear", async () => {
    const { el } = await footer(null);
    expect(el).toHaveTextContent(`© ${new Date().getFullYear()} Catholic Digital Commons Foundation. All rights reserved.`);
    expect(screen.getByRole("link", { name: "Catholic Digital Commons Foundation" })).toHaveAttribute(
      "href",
      "https://catholicdigitalcommons.org",
    );
    expect(el).toHaveTextContent("The texts of each edition belong to their rights holders, named on the back of each book.");
  });
});
