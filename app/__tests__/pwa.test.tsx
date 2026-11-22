import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import manifest from "@/app/manifest";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SignOutButton } from "@/components/SignOutButton";
import { config } from "@/proxy";

let pathname = "/en/read/nabre/john/3";
let search = "";
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<object>("next/navigation")),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
}));

/** A browser with a service worker: `controller` is the worker already running the page (none on first install). */
function worker(controller: { postMessage: ReturnType<typeof vi.fn> } | null) {
  const active = { postMessage: vi.fn() };
  const register = vi.fn(async () => ({}));
  const sw = Object.assign(new EventTarget(), { register, controller, ready: Promise.resolve({ active }) });
  vi.stubGlobal("navigator", { ...navigator, serviceWorker: sw });
  /** The worker takes over the page (clients.claim()). */
  const claim = () => {
    sw.controller = active;
    sw.dispatchEvent(new Event("controllerchange"));
  };
  return { register, active, claim };
}

afterEach(() => {
  pathname = "/en/read/nabre/john/3";
  search = "";
  window.history.replaceState(null, "", "/");
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
    const { register } = worker({ postMessage: vi.fn() });
    render(<ServiceWorkerRegister />);
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("onFirstInstallAsksTheWorkerToKeepThisPageAndEveryFileItLoadedBeforeTheWorkerTookOver", () => {
    vi.stubEnv("NODE_ENV", "production");
    window.history.replaceState(null, "", "/en/read/nabre/john/3?with=DRB");
    const entries = [{ name: "http://localhost:3000/_next/static/chunks/app.js" }, { name: "http://localhost:3000/api/search/suggest" }];
    vi.spyOn(performance, "getEntriesByType").mockImplementation(() => entries as unknown as PerformanceEntryList);
    const { active, claim } = worker(null);
    render(<ServiceWorkerRegister />);
    // A file the page loads after it rendered, while the worker is still installing.
    entries.push({ name: "http://localhost:3000/_next/static/chunks/late.js" });
    expect(active.postMessage).not.toHaveBeenCalled();
    claim();
    expect(active.postMessage).toHaveBeenCalledWith({
      type: "keep",
      urls: ["/en/read/nabre/john/3?with=DRB", "/_next/static/chunks/app.js", "/_next/static/chunks/late.js"],
    });
  });

  it("aPageReachedInTheAppIsSentToTheWorkerToKeep", () => {
    vi.stubEnv("NODE_ENV", "production");
    const controller = { postMessage: vi.fn() };
    worker(controller);
    const { rerender } = render(<ServiceWorkerRegister />);
    // The worker kept the page it loaded itself.
    expect(controller.postMessage).not.toHaveBeenCalled();
    pathname = "/en/read/nabre/john/4";
    window.history.replaceState(null, "", pathname);
    rerender(<ServiceWorkerRegister />);
    expect(controller.postMessage).toHaveBeenCalledWith({ type: "keep", urls: ["/en/read/nabre/john/4"] });
  });

  it("aComparisonAddedInTheAppIsSentToTheWorkerToKeep", () => {
    vi.stubEnv("NODE_ENV", "production");
    const controller = { postMessage: vi.fn() };
    worker(controller);
    const { rerender } = render(<ServiceWorkerRegister />);
    search = "with=DRB";
    window.history.replaceState(null, "", "/en/read/nabre/john/3?with=DRB");
    rerender(<ServiceWorkerRegister />);
    expect(controller.postMessage).toHaveBeenCalledWith({ type: "keep", urls: ["/en/read/nabre/john/3?with=DRB"] });
  });

  it("dropsTheSignedOutMarkAfterASignOutInTheAppToo", () => {
    vi.stubEnv("NODE_ENV", "production");
    const controller = { postMessage: vi.fn() };
    worker(controller);
    const { rerender } = render(<ServiceWorkerRegister />);
    pathname = "/en";
    search = "signed-out";
    window.history.replaceState(null, "", "/en?signed-out");
    rerender(<ServiceWorkerRegister />);
    expect(window.location.pathname + window.location.search).toBe("/en");
    // The home page reached by signing out is not worth a keep message for the marked address.
    expect(controller.postMessage).not.toHaveBeenCalledWith({ type: "keep", urls: ["/en?signed-out"] });
  });

  it("dropsTheSignedOutMarkFromTheAddress", () => {
    vi.stubEnv("NODE_ENV", "production");
    worker({ postMessage: vi.fn() });
    pathname = "/en";
    window.history.replaceState(null, "", "/en?signed-out");
    render(<ServiceWorkerRegister />);
    expect(window.location.pathname + window.location.search).toBe("/en");
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

  it("tellsTheWorkerSoAPageStillLoadingIsNotKept", () => {
    vi.stubGlobal("caches", { delete: vi.fn(async () => true) });
    const controller = { postMessage: vi.fn() };
    worker(controller);
    render(
      <form onSubmit={(e) => e.preventDefault()}>
        <SignOutButton label="Sign out" className="x" />
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(controller.postMessage).toHaveBeenCalledWith({ type: "signed-out" });
  });
});

describe("signing out", () => {
  it("redirectsToTheHomePageMarkedSoTheWorkerForgetsThePagesKept", () => {
    expect(readFileSync("components/AuthStatus.tsx", "utf8")).toContain("redirectTo: `/${locale}?signed-out`");
  });
});
