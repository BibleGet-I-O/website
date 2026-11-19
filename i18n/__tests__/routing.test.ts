import { describe, it, expect } from "vitest";
import { LOCALE_COOKIE, routing } from "@/i18n/routing";

describe("routing", () => {
  it("keepsTheLanguageCookieForAYearWheneverNextIntlWritesIt", () => {
    // next-intl rewrites the cookie on a locale switch; without maxAge it would turn the picker's year-long cookie into a session one.
    expect(routing.localeCookie).toMatchObject({ name: LOCALE_COOKIE, maxAge: 31536000 });
  });
});
