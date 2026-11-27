import { describe, it, expect } from "vitest";
import { popupPosition } from "@/lib/popup-position";

const view = { width: 400, height: 600 };
const size = { width: 300, height: 200 };
const box = (top: number, left: number) => ({ top, bottom: top + 20, left, right: left + 50 });

describe("card position", () => {
  it("goesBelowTheMark", () => {
    expect(popupPosition(box(100, 40), size, view)).toEqual({ top: 126, left: 40 });
  });

  it("flipsAboveNearTheBottom", () => {
    expect(popupPosition(box(500, 40), size, view)).toEqual({ top: 294, left: 40 });
  });

  it("staysInsideTheWindowSideways", () => {
    expect(popupPosition(box(100, 350), size, view).left).toBe(92);
    expect(popupPosition(box(100, -20), size, view).left).toBe(8);
  });
});
