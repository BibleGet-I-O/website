import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";

describe("proxy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sends X-Robots-Tag when SITE_NOINDEX=1", () => {
    vi.stubEnv("SITE_NOINDEX", "1");
    const res = proxy(new NextRequest("http://localhost/en"));
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("does not send it otherwise", () => {
    vi.stubEnv("SITE_NOINDEX", "");
    const res = proxy(new NextRequest("http://localhost/en"));
    expect(res.headers.get("X-Robots-Tag")).toBeNull();
  });

  it("forwards the requested path and query to the page, for the header's sign-in to return to", () => {
    const res = proxy(new NextRequest("http://localhost/en/read/NABRE/john/3?with=VGCL"));
    expect(res.headers.get("x-middleware-request-x-bibleget-return-to")).toBe("/en/read/NABRE/john/3?with=VGCL");
  });

  it("replaces a return target the client sent", () => {
    const res = proxy(new NextRequest("http://localhost/en", { headers: { "x-bibleget-return-to": "//evil.test" } }));
    expect(res.headers.get("x-middleware-request-x-bibleget-return-to")).toBe("/en");
  });
});
