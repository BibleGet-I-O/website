import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import { createFormatter, createTranslator } from "next-intl";
import en from "@/messages/en.json";

// Server components call getTranslations(); in tests they read the English messages.
vi.mock("next-intl/server", () => ({
  getTranslations: async (o?: string | { namespace?: string }) =>
    createTranslator({ locale: "en", messages: en, namespace: (typeof o === "string" ? o : o?.namespace) as never }),
  getFormatter: async () => createFormatter({ locale: "en", timeZone: "UTC" }),
  getLocale: async () => "en",
  setRequestLocale: () => {},
}));

// jsdom has <dialog> but not its modal methods: open and close it as the browser would (close fires `close`).
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}
