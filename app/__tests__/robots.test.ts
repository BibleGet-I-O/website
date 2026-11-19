import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";

describe("robots", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("disallows everything when SITE_NOINDEX=1", () => {
    vi.stubEnv("SITE_NOINDEX", "1");
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("allows everything otherwise", () => {
    vi.stubEnv("SITE_NOINDEX", "");
    expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/" } });
  });
});
