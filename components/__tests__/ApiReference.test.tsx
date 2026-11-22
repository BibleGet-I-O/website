import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render } from "@testing-library/react";
import { useEffect } from "react";

const { scalar } = vi.hoisted(() => ({ scalar: vi.fn((_props: { configuration: Record<string, unknown> }) => null) }));
vi.mock("@scalar/api-reference-react", () => ({ ApiReferenceReact: scalar }));
vi.mock("@scalar/api-reference-react/style.css", () => ({}));

import ApiReference from "@/components/ApiReference";
import scalarIt from "@/messages/scalar/it.json";

const config = () => scalar.mock.calls.at(-1)![0].configuration;
const systemDark = (matches: boolean) => {
  window.matchMedia = vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() });
};

beforeEach(() => {
  scalar.mockClear();
  delete document.documentElement.dataset.theme;
});

describe("ApiReference", () => {
  it("pointsScalarAtThisSitesDocumentWithoutScalarsHostedServices", () => {
    systemDark(false);
    render(<ApiReference locale="en" title="API reference" />);
    expect(config()).toMatchObject({
      url: "/scalar/openapi.json",
      hideDarkModeToggle: true,
      telemetry: false,
      withDefaultFonts: false,
      agent: { disabled: true },
      mcp: { disabled: true },
      authentication: { preferredSecurityScheme: "ApiKey" },
      metaData: { title: "API reference" },
    });
    // The API answers CORS for X-Api-Key itself: no proxy, so no request carries the site's keys.
    expect(config()).not.toHaveProperty("proxyUrl");
  });

  it("followsTheSitesThemeChoiceOverTheSystems", () => {
    systemDark(false);
    document.documentElement.dataset.theme = "dark";
    render(<ApiReference locale="en" title="API reference" />);
    expect(config().forceDarkModeState).toBe("dark");
  });

  it("followsTheSystemWhenTheSiteHasNoChoice", () => {
    systemDark(true);
    render(<ApiReference locale="en" title="API reference" />);
    expect(config().forceDarkModeState).toBe("dark");
  });

  it("aThemeChangeKeepsTheSameScalarSoARequestBeingEditedSurvives", async () => {
    systemDark(false);
    const mounts = vi.fn();
    scalar.mockImplementation(() => {
      useEffect(() => mounts(), []);
      return null;
    });
    render(<ApiReference locale="en" title="API reference" />);
    expect(document.body).toHaveClass("light-mode");
    await act(async () => {
      document.documentElement.dataset.theme = "dark";
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(mounts).toHaveBeenCalledTimes(1);
    expect(document.body).toHaveClass("dark-mode");
    expect(document.body).not.toHaveClass("light-mode");
    scalar.mockImplementation(() => null);
  });

  it("switchesWhenTheReaderChangesTheTheme", async () => {
    systemDark(false);
    render(<ApiReference locale="en" title="API reference" />);
    expect(config().forceDarkModeState).toBe("light");
    await act(async () => {
      document.documentElement.dataset.theme = "dark";
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(config().forceDarkModeState).toBe("dark");
  });

  it("speaksThePagesLanguage", () => {
    systemDark(false);
    const { unmount } = render(<ApiReference locale="it" title="Riferimento API" />);
    expect(config().localization).toEqual({ locale: "it", translations: scalarIt });
    unmount();
    render(<ApiReference locale="de" title="API-Referenz" />);
    expect(config().localization).toEqual({ locale: "de" });
  });
});
