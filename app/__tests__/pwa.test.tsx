import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import manifest from "@/app/manifest";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SignOutButton } from "@/components/SignOutButton";
import { config } from "@/proxy";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the web app manifest", () => {
  it("makesTheSiteAnInstallableAppThatOpensOnItsHome", () => {
    const m = manifest();
    expect(m).toMatchObject({ name: "BibleGet", short_name: "BibleGet", start_url: "/", scope: "/", display: "standalone" });
    expect(m.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }),
        expect.objectContaining({ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }),
        expect.objectContaining({ src: "/icons/icon-maskable-512.png", sizes: "512x512", purpose: "maskable" }),
      ]),
    );
    for (const icon of m.icons ?? []) expect(existsSync(`public${icon.src}`)).toBe(true);
  });

  it("andTheWorkerAndTheOfflinePageAreNotRoutedThroughTheI18nProxy", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    for (const path of ["/sw.js", "/offline.html", "/manifest.webmanifest", "/icons/icon-192.png"]) expect(matcher.test(path)).toBe(false);
  });
});

describe("the offline page", () => {
  it("speaksTheSixLanguagesAndListsTheChaptersKept", () => {
    const html = readFileSync("public/offline.html", "utf8");
    for (const lang of ["en", "it", "es", "fr", "de", "pt"]) expect(html).toContain(`lang="${lang}"`);
    expect(html).toContain('caches.open("bg-pages")');
  });
});

describe("ServiceWorkerRegister", () => {
  it("registersTheWorkerInProduction", () => {
    vi.stubEnv("NODE_ENV", "production");
    const register = vi.fn(async () => ({}));
    vi.stubGlobal("navigator", { ...navigator, serviceWorker: { register } });
    render(<ServiceWorkerRegister />);
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("leavesDevelopmentAlone", () => {
    vi.stubEnv("NODE_ENV", "development");
    const register = vi.fn(async () => ({}));
    vi.stubGlobal("navigator", { ...navigator, serviceWorker: { register } });
    render(<ServiceWorkerRegister />);
    expect(register).not.toHaveBeenCalled();
  });
});

describe("SignOutButton", () => {
  it("forgetsTheChaptersKeptForOfflineReading", () => {
    const del = vi.fn(async () => true);
    vi.stubGlobal("caches", { delete: del });
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <form onSubmit={(e) => e.preventDefault()}>
          <SignOutButton label="Sign out" className="x" />
        </form>
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(del).toHaveBeenCalledWith("bg-pages");
  });
});
