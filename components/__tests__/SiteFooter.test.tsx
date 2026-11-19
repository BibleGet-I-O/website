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
vi.mock("@/lib/release", () => ({ RELEASE: "12345-1" }));

const { SiteFooter } = await import("@/components/SiteFooter");

beforeEach(() => getApiVersion.mockReset());

describe("SiteFooter", () => {
  it("showsTheApiVersionFromTheHeaderAndTheSiteRelease", async () => {
    getApiVersion.mockResolvedValue("v3.0.1-412-g892935b");
    render(await SiteFooter());
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("BibleGet API v3.0.1-412-g892935b");
    expect(footer).toHaveTextContent("Site 12345-1");
  });

  it("showsNoApiVersionWhenTheHeaderIsAbsent", async () => {
    getApiVersion.mockResolvedValue(null);
    render(await SiteFooter());
    const footer = screen.getByRole("contentinfo");
    expect(footer).not.toHaveTextContent("BibleGet API");
    expect(footer).toHaveTextContent("Site 12345-1");
  });

  it("rendersTheHeaderValueAsTextNotMarkup", async () => {
    const hostile = '<img src=x onerror="alert(1)"><b>v4</b>';
    getApiVersion.mockResolvedValue(hostile);
    const { container } = render(await SiteFooter());
    expect(screen.getByRole("contentinfo")).toHaveTextContent(`BibleGet API ${hostile}`);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });
});
