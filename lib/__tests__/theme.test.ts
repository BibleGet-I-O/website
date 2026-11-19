import { describe, it, expect } from "vitest";
import { THEME_COOKIE, parseTheme, themeCookie } from "@/lib/theme";

describe("theme", () => {
  it("readsOnlyLightOrDarkAndOtherwiseFollowsTheSystem", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme(undefined)).toBe("system");
    expect(parseTheme("purple")).toBe("system");
  });

  it("keepsAChoiceForAYearAndForgetsSystem", () => {
    expect(THEME_COOKIE).toBe("theme");
    expect(themeCookie("dark")).toBe("theme=dark; Path=/; Max-Age=31536000; SameSite=Lax");
    expect(themeCookie("system")).toBe("theme=; Path=/; Max-Age=0; SameSite=Lax");
  });
});
