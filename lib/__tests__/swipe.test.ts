import { describe, it, expect, afterEach } from "vitest";
import { canStartAt, decideAxis, releaseOutcome, sideOf, singleTouch } from "@/lib/swipe";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("swipe", () => {
  it("aMostlyVerticalDragIsAScroll", () => {
    expect(decideAxis(3, 4)).toBe("pending");
    expect(decideAxis(12, 10)).toBe("scroll");
    expect(decideAxis(-16, 10)).toBe("turn");
  });

  it("twoFingersAreNeverATurn", () => {
    expect(singleTouch({ length: 2 })).toBe(false);
    expect(singleTouch({ length: 1 })).toBe(true);
  });

  it("theScreenEdgesBelongToTheBrowser", () => {
    const p = document.createElement("p");
    document.body.append(p);
    expect(canStartAt(p, 20, 400, "")).toBe(false);
    expect(canStartAt(p, 380, 400, "")).toBe(false);
    expect(canStartAt(p, 200, 400, "")).toBe(true);
  });

  it("aTouchOnAControlIsNotASwipe", () => {
    document.body.innerHTML = `<a href="/x"><span id="in">x</span></a><select id="s"></select><div role="menu"><i id="m"></i></div>`;
    for (const id of ["in", "s", "m"]) expect(canStartAt(document.getElementById(id), 200, 400, "")).toBe(false);
  });

  it("aSidewaysScrollerKeepsItsOwnSwipes", () => {
    document.body.innerHTML = `<div id="w" style="overflow-x:auto"><span id="t">x</span></div>`;
    const w = document.getElementById("w")!;
    Object.defineProperty(w, "scrollWidth", { value: 900 });
    Object.defineProperty(w, "clientWidth", { value: 300 });
    expect(canStartAt(document.getElementById("t"), 200, 400, "")).toBe(false);
  });

  it("selectedTextIsNotTurned", () => {
    expect(canStartAt(document.body, 200, 400, "In principio")).toBe(false);
  });

  it("aThirdOfThePageCompletes", () => {
    expect(releaseOutcome({ dx: -140, dy: 0, w: 400, vx: 0, reducedMotion: false })).toBe("complete");
    expect(releaseOutcome({ dx: -120, dy: 0, w: 400, vx: 0, reducedMotion: false })).toBe("back");
  });

  it("aFlickCompletesButNotBelowTheMinimum", () => {
    expect(releaseOutcome({ dx: -60, dy: 0, w: 400, vx: -0.6, reducedMotion: false })).toBe("complete");
    expect(releaseOutcome({ dx: -40, dy: 0, w: 400, vx: -2, reducedMotion: false })).toBe("back");
    expect(releaseOutcome({ dx: -60, dy: 0, w: 400, vx: 0.6, reducedMotion: false })).toBe("back");
  });

  it("withReducedMotionASwipeIsEnough", () => {
    expect(releaseOutcome({ dx: 60, dy: 20, w: 400, vx: 0, reducedMotion: true })).toBe("complete");
    expect(releaseOutcome({ dx: 60, dy: 50, w: 400, vx: 0, reducedMotion: true })).toBe("back");
  });

  it("leftIsNextRightIsPrevious", () => {
    expect(sideOf(-1)).toBe("next");
    expect(sideOf(1)).toBe("prev");
  });
});
