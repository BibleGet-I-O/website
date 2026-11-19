import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "@/proxy";

describe("/api/version", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reports the release the build was made for, read once when the module loads", async () => {
    vi.stubEnv("BIBLEGET_RELEASE", "12345-1");
    const { GET, dynamic } = await import("@/app/api/version/route");
    // A later change (an overwritten tree under a still-running process) does not change the answer.
    vi.stubEnv("BIBLEGET_RELEASE", "67890-1");
    const res = GET();
    expect(dynamic).toBe("force-dynamic");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ release: "12345-1", commit: null });
  });

  it("reports dev for a build without a release id", async () => {
    vi.stubEnv("BIBLEGET_RELEASE", "");
    const { GET } = await import("@/app/api/version/route");
    expect(await GET().json()).toEqual({ release: "dev", commit: null });
  });

  it("is not routed through the i18n proxy", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    expect(matcher.test("/api/version")).toBe(false);
    expect(matcher.test("/en/read/nabre/john/3")).toBe(true);
  });
});
