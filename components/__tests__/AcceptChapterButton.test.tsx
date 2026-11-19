import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

const acceptChapter = vi.fn();
vi.mock("@/app/[locale]/review/actions", () => ({ acceptChapter: (...a: unknown[]) => acceptChapter(...a), reviewLink: vi.fn() }));
vi.mock("next/navigation", async () => ({ ...(await vi.importActual<object>("next/navigation")), useRouter: () => ({ refresh: vi.fn() }) }));
const { AcceptChapterButton } = await import("@/components/AcceptChapterButton");

describe("AcceptChapterButton", () => {
  it("aRejectedRequestSaysSoAndFreesTheButton", async () => {
    acceptChapter.mockRejectedValue(new Error("network"));
    render(<NextIntlClientProvider locale="en" messages={en}><AcceptChapterButton edition="VGCL" book={17} chapter={5} drafts={2} /></NextIntlClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: /Accept all drafts/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The change could not be saved.");
    expect(screen.getByRole("button", { name: /Accept all drafts/ })).toBeEnabled();
  });
});
