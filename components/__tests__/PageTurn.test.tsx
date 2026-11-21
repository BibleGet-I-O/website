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
afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
});

type Box = { left: number; top: number; width: number; height: number };
function mount(props: { prev?: string; next?: string } = { prev: PREV, next: NEXT }, extra?: React.ReactNode, box: Box = { left: 0, top: -1200, width: 400, height: 3000 }) {
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
  area.getBoundingClientRect = () => ({ ...box, right: box.left + box.width, bottom: box.top + box.height, x: box.left, y: box.top, toJSON() {} });
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

  it("theCurlStaysOnTheChaptersVisiblePart", () => {
    // At the top of the page the chapter starts 100px down, below the site header and the reader bar.
    const { area } = mount(undefined, undefined, { left: 0, top: 100, width: 400, height: 3000 });
    drag(area, [350, 300], [250, 300], 300, false);
    // The page is the chapter's part of the screen (y 100–800): the fold at x = 350, in the wrapper's own box.
    expect(clip(area)).toContain("350px 0px");
    expect(clip(area)).toContain("350px 700px");
    // The flap is drawn in screen coordinates, from the chapter's top (y = 100), never over the header.
    const f = flap()!.style.getPropertyValue("--flap-clip");
    expect(f).toContain("300px 100px");
    expect(f).not.toMatch(/ (?:[0-9]|[1-9][0-9])(?:\.\d+)?px[,)]/);
  });

  it("aZoomedInReaderPansInsteadOfTurning", () => {
    Object.defineProperty(window, "visualViewport", { configurable: true, value: { scale: 2 } });
    const { area } = mount();
    drag(area, [300, 300], [100, 300], 300);
    tick(600);
    expect(push).not.toHaveBeenCalled();
    expect(clip(area)).toBe("");
  });

  it("theTextCanStillBePinchedToZoom", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("components/page-turn.module.css", "utf8");
    expect(css).toMatch(/touch-action:\s*pan-y pinch-zoom/);
  });

  it("withReducedMotionASlowNeighbourShowsTheLoadingMark", () => {
    reduced = true;
    const { area } = mount();
    drag(area, [300, 300], [100, 300], 300);
    tick(600);
    expect(push).toHaveBeenCalledWith("/en/read/drb/mark/1");
    expect(screen.getByRole("status")).toHaveTextContent("Turning the page…");
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

  it("aZoomedInPageCanBePannedSideways", async () => {
    const vv = Object.assign(new EventTarget(), { scale: 1 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
    const { area } = mount();
    expect(area.dataset.zoomed).toBeUndefined();
    vv.scale = 2;
    act(() => { vv.dispatchEvent(new Event("resize")); });
    expect(area.dataset.zoomed).toBe("");
    vv.scale = 1;
    act(() => { vv.dispatchEvent(new Event("resize")); });
    expect(area.dataset.zoomed).toBeUndefined();
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("components/page-turn.module.css", "utf8");
    expect(css).toMatch(/\.area\[data-zoomed\]\s*\{[^}]*touch-action:\s*auto/);
  });

  it("withReducedMotionACancelledTurnDoesNotCurlBack", () => {
    reduced = true;
    const { area } = mount();
    drag(area, [300, 300], [200, 300], 300, false);
    fireEvent.touchCancel(document.getElementById("text")!, { touches: [], changedTouches: [pt(200, 300)] });
    tick(50);
    expect(clip(area)).toBe("");
    expect(flap()!.style.getPropertyValue("--flap-clip")).toBe("");
    expect(area.dataset.state).toBe("idle");
  });

  it("aSecondFingerCancelsTheTurn", () => {
    const { area } = mount();
    const t = document.getElementById("text")!;
    drag(area, [300, 300], [140, 300], 300, false);
    fireEvent.touchStart(t, { touches: [pt(140, 300), pt(200, 400)], changedTouches: [pt(200, 400)] });
    fireEvent.touchEnd(t, { touches: [pt(140, 300)], changedTouches: [pt(200, 400)] });
    tick(600);
    fireEvent.touchEnd(t, { touches: [], changedTouches: [pt(140, 300)] });
    tick(600);
    expect(push).not.toHaveBeenCalled();
    expect(clip(area)).toBe("");
  });

  it("aFlickThenAPauseIsNotAFlick", () => {
    const { area } = mount();
    drag(area, [300, 300], [240, 300], 80, false);
    tick(1000);
    fireEvent.touchEnd(document.getElementById("text")!, { touches: [], changedTouches: [pt(240, 300)] });
    tick(600);
    expect(push).not.toHaveBeenCalled();
  });

  it("aDragThatEndsTheOtherWayDoesNotTurn", () => {
    const { area } = mount();
    const t = document.getElementById("text")!;
    fireEvent.touchStart(t, { touches: [pt(200, 300)], changedTouches: [pt(200, 300)] });
    tick(16);
    fireEvent.touchMove(t, { touches: [pt(180, 300)], changedTouches: [pt(180, 300)] });
    for (let x = 200; x <= 360; x += 20) {
      tick(200);
      fireEvent.touchMove(t, { touches: [pt(x, 300)], changedTouches: [pt(x, 300)] });
    }
    tick(200);
    fireEvent.touchEnd(t, { touches: [], changedTouches: [pt(360, 300)] });
    tick(600);
    expect(push).not.toHaveBeenCalled();
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
