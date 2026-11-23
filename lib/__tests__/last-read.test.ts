import { describe, it, expect, vi, afterEach } from "vitest";
import { loadLastRead, resumeHref, saveLastRead } from "@/lib/last-read";

describe("last read", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("roundTripsPerEdition", () => {
    saveLastRead("NVBSE", { bookNum: 50, chapter: 3 });
    expect(loadLastRead("NVBSE")).toEqual({ bookNum: 50, chapter: 3 });
    expect(loadLastRead("DRB")).toBeNull();
    expect(resumeHref("NVBSE")).toBe("/read/nvbse?book=50&chapter=3");
  });

  it("badStorageFallsBackToGenesisOne", () => {
    localStorage.setItem("bibleget.lastRead.DRB", "{oops");
    expect(resumeHref("DRB")).toBe("/read/drb?book=1&chapter=1");
    localStorage.setItem("bibleget.lastRead.DRB", JSON.stringify({ bookNum: 80, chapter: 2 }));
    expect(resumeHref("DRB")).toBe("/read/drb?book=1&chapter=1");
    localStorage.setItem("bibleget.lastRead.DRB", JSON.stringify({ bookNum: 3, chapter: 0 }));
    expect(resumeHref("DRB")).toBe("/read/drb?book=1&chapter=1");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(resumeHref("DRB")).toBe("/read/drb?book=1&chapter=1");
  });

  it("savingSwallowsStorageErrors", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    expect(() => saveLastRead("DRB", { bookNum: 1, chapter: 1 })).not.toThrow();
  });
});
