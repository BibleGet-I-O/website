import { describe, it, expect } from "vitest";
import { clampCorner, curl, restCorner, type Point } from "@/lib/page-curl";

/** A polygon as a sorted set of rounded points: any start and order compare equal. */
const norm = (ps: Point[]) => ps.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`.replace(/-0\.00/g, "0.00")).sort();

describe("curl", () => {
  it("aStraightPullFoldsAVerticalLine", () => {
    const c = curl("next", { x: 200, y: 0 }, 400, 800);
    expect(norm(c.stay)).toEqual(norm([{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 800 }, { x: 0, y: 800 }]));
    expect(norm(c.flap)).toEqual(norm([{ x: 200, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 800 }, { x: 200, y: 800 }]));
    expect(c.progress).toBeCloseTo(0.25);
  });

  it("aCornerPullFoldsATriangle", () => {
    const c = curl("next", { x: 300, y: 100 }, 400, 800);
    expect(norm(c.flap)).toEqual(norm([{ x: 300, y: 0 }, { x: 300, y: 100 }, { x: 400, y: 100 }]));
    expect(norm(c.lifted)).toEqual(norm([{ x: 300, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 100 }]));
    expect(norm(c.stay)).toEqual(norm([{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 400, y: 100 }, { x: 400, y: 800 }, { x: 0, y: 800 }]));
  });

  it("atRestNothingLifts", () => {
    const c = curl("next", restCorner("next", 400), 400, 800);
    expect(c.flap).toEqual([]);
    expect(c.progress).toBe(0);
  });

  it("theCornerCannotTearFromTheSpine", () => {
    expect(clampCorner("next", { x: -600, y: 0 }, 400)).toEqual({ x: -400, y: 0 });
    expect(clampCorner("prev", { x: 1000, y: 0 }, 400)).toEqual({ x: 800, y: 0 });
  });

  it("aFullTurnLeavesNothingStanding", () => {
    expect(curl("next", { x: -400, y: 0 }, 400, 800).stay).toEqual([]);
    expect(curl("next", { x: -400, y: 0 }, 400, 800).progress).toBe(1);
  });

  it("theFlapStaysOnThePage", () => {
    // Pulled past the middle: the reflected flap would reach beyond the spine; it is cut at the page's edge.
    const c = curl("next", { x: -200, y: 0 }, 400, 800);
    expect(norm(c.flap)).toEqual(norm([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 800 }, { x: 0, y: 800 }]));
  });

  it("previousMirrorsNext", () => {
    const c = curl("prev", { x: 100, y: 100 }, 400, 800);
    expect(norm(c.flap)).toEqual(norm([{ x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]));
  });
});
