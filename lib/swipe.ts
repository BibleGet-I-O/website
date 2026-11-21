import type { Side } from "@/lib/page-curl";

/** A swipe moves at least this far sideways (as in the Martyrology reader). */
export const SWIPE_PX = 50;
/** The axis is decided once the finger has moved this far. */
export const AXIS_PX = 10;
/** A touch starting this close to the screen's left or right edge is the browser's (back / forward). */
export const EDGE_PX = 24;
/** A release at least this fast sideways completes the turn. */
export const FLICK_PX_PER_MS = 0.5;
/** Sideways must exceed vertical by this much. */
const RATIO = 1.5;

const CONTROLS = "a, button, select, input, textarea, [role=menu], [contenteditable]";

function scrollsSideways(el: Element): boolean {
  const o = getComputedStyle(el).overflowX;
  return (o === "auto" || o === "scroll") && el.scrollWidth > el.clientWidth;
}

/** Whether a touch at `clientX` on `target` may start a turn: not at the edges, on a control, in a sideways scroller, or with text selected. */
export function canStartAt(
  target: Element | null,
  clientX: number,
  viewportWidth: number,
  selection: string = typeof window === "undefined" ? "" : (window.getSelection()?.toString() ?? ""),
): boolean {
  if (clientX < EDGE_PX || clientX > viewportWidth - EDGE_PX) return false;
  if (selection.trim() !== "") return false;
  if (!target) return true;
  if (target.closest(CONTROLS)) return false;
  for (let el: Element | null = target; el; el = el.parentElement) if (scrollsSideways(el)) return false;
  return true;
}

export function decideAxis(dx: number, dy: number): "pending" | "scroll" | "turn" {
  if (Math.hypot(dx, dy) < AXIS_PX) return "pending";
  return Math.abs(dx) > RATIO * Math.abs(dy) ? "turn" : "scroll";
}

/** Swiping left turns to the next chapter, swiping right to the previous one. */
export function sideOf(dx: number): Side {
  return dx < 0 ? "next" : "prev";
}

/**
 * `vx` is the sideways speed (px/ms) over the last movement; `side` is the turn the drag started. A drag that has
 * come back past where it started, to the other side, never turns.
 */
export function releaseOutcome(o: { dx: number; dy: number; w: number; vx: number; reducedMotion: boolean; side: Side }): "complete" | "back" {
  if (o.dx === 0 || sideOf(o.dx) !== o.side) return "back";
  const far = Math.abs(o.dx) >= SWIPE_PX;
  if (o.reducedMotion) return far && Math.abs(o.dx) > RATIO * Math.abs(o.dy) ? "complete" : "back";
  const flick = Math.sign(o.vx) === Math.sign(o.dx) && Math.abs(o.vx) >= FLICK_PX_PER_MS;
  return far && (Math.abs(o.dx) >= o.w / 3 || flick) ? "complete" : "back";
}

export function singleTouch(touches: { length: number }): boolean {
  return touches.length === 1;
}
