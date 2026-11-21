/**
 * Per-visitor limits for the site's costly calls (suggestions, semantic and hybrid searches): the site's read key is
 * exempt from the API's rate limits, so the site counts per client IP itself. In memory, in this one Node process:
 * a restart resets the counts, which is fine for a guard against floods.
 */

export type Limiter = {
  readonly limit: number;
  readonly windowMs: number;
  /** Counts one call for `key`; `retryAfter` (seconds) says when the next window opens. */
  hit(key: string, now?: number): { ok: boolean; retryAfter: number };
  /** How many keys are being counted (for tests). */
  size(): number;
};

/** A fixed window per key: at most `limit` calls from `windowStart` to `windowStart + windowMs`. */
export function createLimiter(o: { limit: number; windowMs: number }): Limiter {
  const windows = new Map<string, { start: number; count: number }>();
  let lastSweep = 0;
  return {
    limit: o.limit,
    windowMs: o.windowMs,
    hit(key, now = Date.now()) {
      // Drop the keys whose window has passed, at most once per window, so the map stays small.
      if (now - lastSweep >= o.windowMs) {
        for (const [k, w] of windows) if (now - w.start >= o.windowMs) windows.delete(k);
        lastSweep = now;
      }
      let w = windows.get(key);
      if (!w || now - w.start >= o.windowMs) {
        w = { start: now, count: 0 };
        windows.set(key, w);
      }
      w.count++;
      const retryAfter = Math.ceil((w.start + o.windowMs - now) / 1000);
      return { ok: w.count <= o.limit, retryAfter };
    },
    size: () => windows.size,
  };
}

/**
 * The visitor's address as the server's proxy states it: Plesk's nginx sets X-Real-IP to the connection's address
 * (replacing any the client sent) before Apache/Passenger. Without it, the last X-Forwarded-For entry, the one the
 * proxy appended; never the first, which the client controls.
 */
export function clientIp(h: Headers): string {
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return forwarded[forwarded.length - 1] ?? "unknown";
}

export const suggestLimiter = createLimiter({ limit: 60, windowMs: 60_000 });
export const semanticLimiter = createLimiter({ limit: 10, windowMs: 60_000 });
