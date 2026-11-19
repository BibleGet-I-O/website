import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

const reviewLink = vi.fn();
vi.mock("@/app/[locale]/review/actions", () => ({ reviewLink: (...a: unknown[]) => reviewLink(...a), acceptChapter: vi.fn() }));
vi.mock("next/navigation", async () => ({ ...(await vi.importActual<object>("next/navigation")), useRouter: () => ({ refresh: vi.fn() }) }));
const { ReviewLink } = await import("@/components/ReviewLink");

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {ui}
  </NextIntlClientProvider>
);
const draft = { id: 2, ref: "5:2", units: ["btu:tb.5.2"], kind: "corresponding" as const, status: "draft" as const, confidence: 0.45, stretch: "1", note: null };
const stretch = [
  { id: "btu:tb.5.2", ref: "5:2", text: "NV two" },
  { id: "btu:tb.5.3", ref: "5:3", text: "NV three" },
];

beforeEach(() => reviewLink.mockReset());

describe("ReviewLink", () => {
  it("relinkOffersOnlyTheStretchsUnits", async () => {
    reviewLink.mockResolvedValue({ ok: true, link: { ...draft, units: ["btu:tb.5.2", "btu:tb.5.3"], status: "reviewed" } });
    render(wrap(<ReviewLink link={draft} text="Quo modo" units={[stretch[0]]} stretch={stretch} />));
    fireEvent.click(screen.getByRole("button", { name: "Relink" }));
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes.map((b) => b.getAttribute("value"))).toEqual(["btu:tb.5.2", "btu:tb.5.3"]);
    expect(boxes[0]).toBeChecked();
    fireEvent.click(boxes[1]);
    fireEvent.click(screen.getByRole("button", { name: "Save links" }));
    await waitFor(() => expect(reviewLink).toHaveBeenCalledWith(2, { action: "relink", units: ["btu:tb.5.2", "btu:tb.5.3"] }));
    expect(await screen.findByText("Reviewed")).toBeInTheDocument();
  });

  it("acceptSendsAccept", async () => {
    reviewLink.mockResolvedValue({ ok: true, link: { ...draft, status: "reviewed" } });
    render(wrap(<ReviewLink link={draft} text="Quo modo" units={[stretch[0]]} stretch={stretch} />));
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(reviewLink).toHaveBeenCalledWith(2, { action: "accept" }));
  });

  it("aRuleLinkHasNoActions", () => {
    render(wrap(<ReviewLink link={{ ...draft, status: "rule", confidence: null, stretch: null }} text="x" units={[stretch[0]]} stretch={[]} />));
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText("By rule")).toBeInTheDocument();
  });

  it("aFailedChangeSaysSo", async () => {
    reviewLink.mockResolvedValue({ ok: false, status: 422 });
    render(wrap(<ReviewLink link={draft} text="x" units={[stretch[0]]} stretch={stretch} />));
    fireEvent.click(screen.getByRole("button", { name: "No counterpart" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The change could not be saved.");
  });

  it("aNewLinkFromTheServerReplacesTheShownOne", () => {
    const { rerender } = render(wrap(<ReviewLink link={draft} text="x" units={[stretch[0]]} stretch={stretch} />));
    expect(screen.getByText("Draft")).toBeInTheDocument();
    rerender(wrap(<ReviewLink link={{ ...draft, status: "reviewed" }} text="x" units={[stretch[0]]} stretch={stretch} />));
    expect(screen.getByText("Reviewed")).toBeInTheDocument();
  });

  it("aConflictAsksToReloadTheChapter", async () => {
    reviewLink.mockResolvedValue({ ok: false, status: 409 });
    render(wrap(<ReviewLink link={draft} text="x" units={[stretch[0]]} stretch={stretch} />));
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This link changed meanwhile");
    expect(screen.getByRole("button", { name: "Reload the chapter" })).toBeInTheDocument();
  });

  it("eachRowIsARegionNamedByItsVerse", () => {
    render(wrap(<ReviewLink link={draft} text="x" units={[stretch[0]]} stretch={stretch} />));
    expect(screen.getByRole("region", { name: "5:2" })).toBeInTheDocument();
  });
});
