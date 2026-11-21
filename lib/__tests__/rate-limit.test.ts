import { describe, expect, it } from "vitest";
import { clientIp, createLimiter, semanticLimiter, suggestLimiter } from "../rate-limit";

describe("createLimiter", () => {
  it("allowsUpToTheLimitInAWindow", () => {
    const l = createLimiter({ limit: 3, windowMs: 60_000 });
    expect([1, 2, 3].map(() => l.hit("a", 1000).ok)).toEqual([true, true, true]);
  });

  it("refusesBeyondItWithRetryAfter", () => {
    const l = createLimiter({ limit: 2, windowMs: 60_000 });
    l.hit("a", 0);
    l.hit("a", 10_000);
    expect(l.hit("a", 20_000)).toEqual({ ok: false, retryAfter: 40 });
  });

  it("startsAgainInTheNextWindow", () => {
    const l = createLimiter({ limit: 1, windowMs: 60_000 });
    expect(l.hit("a", 0).ok).toBe(true);
    expect(l.hit("a", 59_999).ok).toBe(false);
    expect(l.hit("a", 60_000).ok).toBe(true);
  });

  it("keysAreCountedSeparately", () => {
    const l = createLimiter({ limit: 1, windowMs: 60_000 });
    expect(l.hit("a", 0).ok).toBe(true);
    expect(l.hit("b", 0).ok).toBe(true);
    expect(l.hit("a", 1).ok).toBe(false);
  });

  it("forgetsKeysWhoseWindowHasPassed", () => {
    const l = createLimiter({ limit: 1, windowMs: 1000 });
    for (let i = 0; i < 100; i++) l.hit(`k${i}`, 0);
    l.hit("later", 5000);
    expect(l.size()).toBe(1);
  });

  it("theSiteLimitsAre60SuggestionsAnd10SemanticSearchesAMinute", () => {
    expect(suggestLimiter.limit).toBe(60);
    expect(semanticLimiter.limit).toBe(10);
    expect(suggestLimiter.windowMs).toBe(60_000);
  });
});

describe("clientIp", () => {
  it("clientIpTrustsTheAddressTheProxySetNotOneTheClientSent", () => {
    // nginx sets X-Real-IP to the connection's address, replacing any the client sent.
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2", "x-forwarded-for": "1.2.3.4, 198.51.100.2" }))).toBe("198.51.100.2");
    // Without it, the last forwarded address is the one the proxy appended; the first is whatever the client wrote.
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
