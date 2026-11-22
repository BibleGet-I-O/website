"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import scalarIt from "@/messages/scalar/it.json";
import styles from "@/components/ApiReference.module.css";

// The site's scheme: the reader's choice on <html data-theme>, else the system's (as the dark: variant in globals.css).
const DARK = "(prefers-color-scheme: dark)";
const subscribe = (onChange: () => void) => {
  const mq = window.matchMedia(DARK);
  mq.addEventListener("change", onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    mq.removeEventListener("change", onChange);
    observer.disconnect();
  };
};
const isDark = () => {
  const chosen = document.documentElement.dataset.theme;
  return chosen === "dark" || (chosen !== "light" && window.matchMedia(DARK).matches);
};

// The site's red (rubrics) as the accent, its page backgrounds and its faces.
const CUSTOM_CSS = `
.light-mode { --scalar-color-accent: #b91c1c; --scalar-background-1: #fff; }
.dark-mode { --scalar-color-accent: #f87171; --scalar-background-1: #020617; }
.scalar-app { --scalar-font: ui-sans-serif, system-ui, sans-serif; --scalar-font-code: ui-monospace, SFMono-Regular, Menlo, monospace; }
`;

/**
 * The API reference (Scalar): the endpoint's OpenAPI document, served by this site at /scalar/openapi.json. Its
 * "Test request" goes straight to the API (which answers CORS for X-Api-Key) with the key the reader enters.
 */
export default function ApiReference({ locale, title }: { locale: string; title: string }) {
  // null while rendering on the server: Scalar mounts once the scheme is known, and again when it changes.
  const dark = useSyncExternalStore(subscribe, isDark, () => null);
  // Scalar marks the body light-mode or dark-mode; leaving the reference, the rest of the site has its own scheme.
  useEffect(() => () => document.body.classList.remove("light-mode", "dark-mode"), []);
  // A theme change restyles the same Scalar (its light-mode / dark-mode body class) rather than replacing it, which
  // would lose a test request being edited, and the key typed for it.
  useEffect(() => {
    if (dark === null) return;
    document.body.classList.toggle("dark-mode", dark);
    document.body.classList.toggle("light-mode", !dark);
  }, [dark]);
  if (dark === null) return <div className={styles.reference} />;
  return (
    <div className={styles.reference}>
      <ApiReferenceReact
        key={locale}
        configuration={{
          url: "/scalar/openapi.json",
          theme: "default",
          layout: "modern",
          // Italian is not among Scalar's built-in locales: ours (from the Roman Martyrology's site); the others are built in
          localization: locale === "it" ? { locale, translations: scalarIt } : { locale },
          customCss: CUSTOM_CSS,
          forceDarkModeState: dark ? "dark" : "light",
          hideDarkModeToggle: true,
          withDefaultFonts: false,
          telemetry: false,
          // no "Ask AI" (Scalar's hosted agent) and no "Generate MCP" (Scalar's hosted MCP service)
          agent: { disabled: true },
          mcp: { disabled: true },
          showDeveloperTools: "never",
          documentDownloadType: "json",
          defaultHttpClient: { targetKey: "shell", clientKey: "curl" },
          // the data routes take a project key or an installation token in X-Api-Key
          authentication: { preferredSecurityScheme: "ApiKey" },
          // the page's localized title (Scalar applies this client-side, over the server-rendered one)
          metaData: { title },
        }}
      />
    </div>
  );
}
