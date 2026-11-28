import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<object>("next/navigation")),
  useRouter: () => ({ push: vi.fn() }),
}));
const { ReaderBar } = await import("@/components/ReaderBar");
const { AnnotationsSwitch } = await import("@/components/AnnotationsSwitch");

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    <main data-testid="reader">
      {ui}
      <p>
        <span className="bg-mention" data-mention="1.1|0" data-mention-first="">Petrus</span>
        <span className="bg-mention" data-mention="1.1|0">bis</span>
      </p>
    </main>
  </NextIntlClientProvider>
);
const props = {
  locale: "en", edition: "NVBSE", editions: [{ sigla: "NVBSE", fullname: "Nova Vulgata" }],
  books: [{ slug: "tobit", name: "Tobit", chapters: 14, bookNum: 17 }], book: "tobit", bookNum: 17, chapter: 3,
  withSiglas: [] as string[], view: "side-by-side" as const, esther: false,
};
const sw = () => screen.queryByRole("switch", { name: "Annotations" });

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("annotations switch", () => {
  it("isOffByDefault", () => {
    render(wrap(<AnnotationsSwitch />));
    expect(sw()).not.toBeChecked();
  });

  it("remembersTheChoice", () => {
    const first = render(wrap(<AnnotationsSwitch />));
    fireEvent.click(sw()!);
    expect(localStorage.getItem("reader.annotations")).toBe("1");
    first.unmount();
    render(wrap(<AnnotationsSwitch />));
    expect(sw()).toBeChecked();
    fireEvent.click(sw()!);
    expect(localStorage.getItem("reader.annotations")).toBe("0");
  });

  it("followsAnotherTab", () => {
    render(wrap(<AnnotationsSwitch />));
    act(() => {
      localStorage.setItem("reader.annotations", "1");
      window.dispatchEvent(new StorageEvent("storage", { key: "reader.annotations", newValue: "1" }));
    });
    expect(sw()).toBeChecked();
  });

  it("keepsTheChoiceWhenStorageThrows", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
    render(wrap(<AnnotationsSwitch />));
    expect(sw()).not.toBeChecked();
    // Not remembered, but kept as chosen while the page lasts, either way.
    fireEvent.click(sw()!);
    expect(sw()).toBeChecked();
    expect(screen.getByTestId("reader")).toHaveAttribute("data-annotations", "on");
    fireEvent.click(sw()!);
    expect(sw()).not.toBeChecked();
    fireEvent.click(sw()!);
    expect(sw()).toBeChecked();
    // Once a write succeeds, storage is the choice again.
    get.mockRestore();
    set.mockRestore();
    fireEvent.click(sw()!);
    expect(sw()).not.toBeChecked();
    expect(localStorage.getItem("reader.annotations")).toBe("0");
  });

  it("followsAnotherTabAfterAFailedWrite", () => {
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
    render(wrap(<AnnotationsSwitch />));
    fireEvent.click(sw()!);
    expect(sw()).toBeChecked();
    set.mockRestore();
    act(() => {
      localStorage.setItem("reader.annotations", "0");
      window.dispatchEvent(new StorageEvent("storage", { key: "reader.annotations", newValue: "0" }));
    });
    expect(sw()).not.toBeChecked();
  });

  it("isNotDrawnWithoutMentions", () => {
    const { rerender } = render(wrap(<ReaderBar {...props} />));
    expect(sw()).toBeNull();
    rerender(wrap(<ReaderBar {...props} annotations={false} />));
    expect(sw()).toBeNull();
    rerender(wrap(<ReaderBar {...props} annotations />));
    expect(sw()).not.toBeNull();
  });

  it("setsTheReaderAttribute", () => {
    render(wrap(<AnnotationsSwitch />));
    expect(screen.getByTestId("reader")).toHaveAttribute("data-annotations", "off");
    fireEvent.click(sw()!);
    expect(screen.getByTestId("reader")).toHaveAttribute("data-annotations", "on");
    fireEvent.click(sw()!);
    expect(screen.getByTestId("reader")).toHaveAttribute("data-annotations", "off");
  });

  it("setsFocusTargetsOnlyWhenOn", async () => {
    render(wrap(<AnnotationsSwitch />));
    const [first, other] = Array.from(document.querySelectorAll<HTMLElement>(".bg-mention"));
    expect(first).not.toHaveAttribute("tabindex");
    fireEvent.click(sw()!);
    expect(first).toHaveAttribute("tabindex", "0");
    expect(first).toHaveAttribute("role", "button");
    expect(first).toHaveAttribute("aria-haspopup", "dialog");
    expect(other).not.toHaveAttribute("tabindex");
    // Text that arrives while on is made reachable too.
    const late = document.createElement("span");
    late.setAttribute("data-mention-first", "");
    screen.getByTestId("reader").append(late);
    await act(async () => { await Promise.resolve(); });
    expect(late).toHaveAttribute("role", "button");
    fireEvent.click(sw()!);
    for (const el of [first, late]) {
      expect(el).not.toHaveAttribute("tabindex");
      expect(el).not.toHaveAttribute("role");
      expect(el).not.toHaveAttribute("aria-haspopup");
    }
  });
});
