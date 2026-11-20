import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

const push = vi.fn();
const prefetch = vi.fn();
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<object>("next/navigation")),
  useRouter: () => ({ push, prefetch, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn() }),
}));
const { PageTurn, TurnLink } = await import("@/components/PageTurn");

const NEXT = "/read/drb/mark/1";
const PREV = "/read/drb/matthew/27";

let reduced = false;
beforeEach(() => {
  vi.useFakeTimers();
  push.mockReset();
  prefetch.mockReset();
  reduced = false;
  window.matchMedia = ((q: string) => ({ matches: reduced && q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} })) as never;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 400 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
});
afterEach(() => vi.useRealTimers());

function mount(props: { prev?: string; next?: string } = { prev: PREV, next: NEXT }, extra?: React.ReactNode) {
  const r = render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PageTurn {...props}>
        <article>
          <p id="text">In the beginning</p>
        </article>
        {extra}
      </PageTurn>
    </NextIntlClientProvider>,
  );
  const area = r.container.querySelector("[data-page-turn]") as HTMLElement;
  area.getBoundingClientRect = () => ({ left: 0, top: -1200, width: 400, height: 3000, right: 400, bottom: 1800, x: 0, y: -1200, toJSON() {} });
  return { ...r, area };
}

const pt = (x: number, y: number) => ({ clientX: x, clientY: y, identifier: 0 });
const clip = (el: HTMLElement) => el.style.getPropertyValue("--clip");
const flap = () => document.querySelector("[data-testid=page-turn-flap]") as HTMLElement | null;
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

/** Touch down at `from`, move in steps to `to` over `ms`, optionally lift. */
function drag(el: HTMLElement, from: [number, number], to: [number, number], ms: number, lift = true) {
  const target = document.getElementById("text") ?? el;
  fireEvent.touchStart(target, { touches: [pt(...from)], changedTouches: [pt(...from)] });
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    tick(ms / steps);
    const x = from[0] + ((to[0] - from[0]) * i) / steps;
    const y = from[1] + ((to[1] - from[1]) * i) / steps;
    fireEvent.touchMove(target, { touches: [pt(x, y)], changedTouches: [pt(x, y)] });
  }
  tick(16);
  if (lift) fireEvent.touchEnd(target, { touches: [], changedTouches: [pt(...to)] });
}

describe("PageTurn", () => {
  it("swipingLeftTurnsToTheNextChapter", () => {
    const { area } = mount();
    drag(area, [300, 300], [100, 300], 300);
    tick(600);
    expect(push).toHaveBeenCalledWith("/en/read/drb/mark/1");
  });

  it("swipingRightTurnsToThePreviousChapter", () => {
    const { area } = mount();
    drag(area, [100, 300], [300, 300], 300);
    tick(600);
    expect(push).toHaveBeenCalledWith("/en/read/drb/matthew/27");
  });

  it("nothingBeforeGenesis", () => {
    const { area } = mount({ next: "/read/drb/genesis/2" });
    drag(area, [100, 300], [300, 300], 300);
    tick(600);
    expect(push).not.toHaveBeenCalled();
    expect(clip(area)).toBe("");
  });

  it("aShortDragSpringsBack", () => {
    const { area } = mount();
    drag(area, [300, 300], [240, 300], 600);
    tick(600);
    expect(push).not.toHaveBeenCalled();
    expect(clip(area)).toBe("");
    expect(area.dataset.state).toBe("idle");
  });

  it("aVerticalDragNeverCurls", () => {
    const { area } = mount();
    drag(area, [200, 300], [215, 420], 300, false);
    expect(clip(area)).toBe("");
    fireEvent.touchEnd(document.getElementById("text")!, { touches: [], changedTouches: [pt(215, 420)] });
    tick(600);
    expect(push).not.toHaveBeenCalled();
  });

  it("aTouchStartingAtTheEdgeIsLeftToTheBrowser", () => {
    const { area } = mount();
    drag(area, [390, 300], [100, 300], 300);
    tick(600);
    expect(push).not.toHaveBeenCalled();
  });

  it("twoFingerTouchesDoNotCurl", () => {
    const { area } = mount();
    const t = document.getElementById("text")!;
    fireEvent.touchStart(t, { touches: [pt(300, 300), pt(200, 400)] });
    fireEvent.touchMove(t, { touches: [pt(100, 300), pt(50, 400)] });
    tick(32);
    expect(clip(area)).toBe("");
  });

  it("theClipIsTranslatedIntoTheWrappersBox", () => {
    const { area } = mount();
    drag(area, [350, 300], [250, 300], 300, false);
    // The fold is at x = 350 (half of the 100px pull); the screen's top edge is 1200px into the wrapper.
    expect(clip(area)).toContain("0px 1200px");
    expect(clip(area)).toContain("350px 1200px");
  });

  it("aRestoredPageIsNotLeftClipped", () => {
    const { area } = mount();
    drag(area, [300, 300], [100, 300], 300);
    tick(600);
    expect(push).toHaveBeenCalled();
    act(() => { window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true })); });
    expect(area.dataset.state).toBe("idle");
    expect(clip(area)).toBe("");
  });

  it("aSlowNeighbourShowsTheLoadingMark", () => {
    const { area } = mount();
    drag(area, [300, 300], [100, 300], 300);
    tick(300);
    expect(screen.queryByRole("status")).toBeNull();
    tick(500);
    expect(screen.getByRole("status")).toHaveTextContent("Turning the page…");
  });

  it("theNeighboursArePrefetched", () => {
    mount();
    expect(prefetch).toHaveBeenCalledWith("/en/read/drb/mark/1", { kind: "full" });
    expect(prefetch).toHaveBeenCalledWith("/en/read/drb/matthew/27", { kind: "full" });
  });

  it("aPlainClickPlaysTheTurn", () => {
    mount(undefined, <TurnLink side="next" href={NEXT} rel="next">Next</TurnLink>);
    const notPrevented = fireEvent.click(screen.getByRole("link", { name: "Next" }));
    expect(notPrevented).toBe(false);
    expect(push).not.toHaveBeenCalled();
    tick(800);
    expect(push).toHaveBeenCalledWith("/en/read/drb/mark/1");
  });

  it("aModifiedClickIsALink", () => {
    mount(undefined, <TurnLink side="next" href={NEXT} rel="next">Next</TurnLink>);
    // Seen after React's handlers (the document is above the root); then kept from jsdom's navigation.
    let prevented: boolean | undefined;
    const seen = (e: Event) => {
      prevented = e.defaultPrevented;
      e.preventDefault();
    };
    document.addEventListener("click", seen);
    fireEvent.click(screen.getByRole("link", { name: "Next" }), { ctrlKey: true });
    document.removeEventListener("click", seen);
    tick(800);
    expect(prevented).toBe(false);
    expect(push).not.toHaveBeenCalled();
    expect(flap()?.style.getPropertyValue("--flap-clip") ?? "").toBe("");
  });

  it("withReducedMotionTheLinkGoesAtOnce", () => {
    reduced = true;
    mount(undefined, <TurnLink side="next" href={NEXT} rel="next">Next</TurnLink>);
    fireEvent.click(screen.getByRole("link", { name: "Next" }));
    expect(push).toHaveBeenCalledWith("/en/read/drb/mark/1");
  });

  it("aTurnIgnoresNewGestures", () => {
    const { area } = mount();
    drag(area, [300, 300], [100, 300], 300);
    drag(area, [100, 300], [300, 300], 100);
    tick(800);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/en/read/drb/mark/1");
  });
});
