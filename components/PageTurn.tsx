"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { clampCorner, curl, restCorner, type Point, type Side } from "@/lib/page-curl";
import { canStartAt, cornerFor, decideAxis, releaseOutcome, sideOf, singleTouch } from "@/lib/swipe";
import styles from "./page-turn.module.css";

type State = "idle" | "dragging" | "turning" | "blank" | "fading";

const COMPLETE_MS = 250;
const PLAY_MS = 450;
const BACK_MS = 220;
const FADE_MS = 150;
const SLOW_MS = 400;
/** The release speed is measured over this last stretch of the drag. */
const VELOCITY_WINDOW_MS = 100;

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

const reducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const TurnContext = createContext<{ play: (side: Side) => void } | null>(null);

const polygon = (ps: Point[], dx = 0, dy = 0) => `polygon(${ps.map((p) => `${p.x + dx}px ${p.y + dy}px`).join(", ")})`;

type Rect = { left: number; top: number; w: number; h: number };

/** The page that turns: the chapter's part of the screen (never the header, the footer or the margins). */
function pageRect(el: HTMLElement): Rect {
  const box = el.getBoundingClientRect();
  const left = Math.max(0, box.left);
  const top = Math.max(0, box.top);
  const right = Math.min(window.innerWidth, box.right);
  const bottom = Math.min(window.innerHeight, box.bottom);
  return { left, top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) };
}

/** Pinched in, a sideways drag pans the enlarged page: it is not a turn. */
const zoomedIn = () => typeof window !== "undefined" && (window.visualViewport?.scale ?? 1) > 1.01;

/** Where the turned corner ends: at the far side, as far as the spine lets it go. */
const farCorner = (side: Side, w: number): Point => (side === "next" ? { x: -w, y: 0 } : { x: 2 * w, y: 0 });

/**
 * The chapter as a page that turns: a horizontal swipe curls it from the top corner of the screen (right for the
 * next chapter, left for the previous one) and, let go far enough, turns it; the TurnLinks inside play the same
 * turn. `prev` and `next` are locale-less hrefs, the same as the chapter links'.
 */
export function PageTurn({ prev, next, children }: { prev?: string; next?: string; children: ReactNode }) {
  const t = useTranslations("Reader");
  const router = useRouter();
  const area = useRef<HTMLDivElement>(null);
  const flap = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("idle");
  const stateRef = useRef<State>("idle");
  const [slow, setSlow] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const frame = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const drag = useRef<{
    x0: number; y0: number; axis: "pending" | "turn"; side?: Side; dx: number; dy: number; samples: { x: number; t: number }[];
  } | null>(null);

  const target = useCallback((side: Side) => (side === "next" ? next : prev), [next, prev]);

  const go = useCallback((s: State) => {
    stateRef.current = s;
    setState(s);
  }, []);

  useEffect(() => {
    for (const href of [prev, next]) if (href) router.prefetch(href, { kind: "full" } as never);
  }, [router, prev, next]);

  /** The width of the page that turns, for the corner's travel. */
  const pageWidth = useCallback(() => (area.current ? pageRect(area.current).w : window.innerWidth), []);

  /**
   * Draws the page with its corner at p (in the page's own coordinates): the page clipped to what stays, the flap
   * and the shade on the blank sheet. The page is the chapter's part of the screen; the overlays are drawn in
   * screen coordinates.
   */
  const paint = useCallback((side: Side, p: Point) => {
    const el = area.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const r = pageRect(el);
    if (r.w <= 0 || r.h <= 0) return;
    const c = curl(side, p, r.w, r.h);
    // Page coordinates → the wrapper's own box (for its clip-path), and → the screen (for the fixed overlays).
    el.style.setProperty("--clip", c.stay.length ? polygon(c.stay, r.left - box.left, r.top - box.top) : "inset(100% 0 0 0)");
    // Positions along the gradient line (CSS: it crosses the overlay's centre, its length covers the overlay).
    const W = window.innerWidth;
    const H = window.innerHeight;
    const rest = restCorner(side, r.w);
    const q = clampCorner(side, p, r.w);
    const a = (c.foldAngle * Math.PI) / 180;
    const u = { x: Math.sin(a), y: -Math.cos(a) };
    const len = Math.abs(W * Math.sin(a)) + Math.abs(H * Math.cos(a));
    const at = (x: number, y: number) => (x + r.left - W / 2) * u.x + (y + r.top - H / 2) * u.y + len / 2;
    const fold = at((rest.x + q.x) / 2, (rest.y + q.y) / 2);
    const tip = at(q.x, q.y);
    const spread = Math.min(60, Math.max(8, (tip - fold) / 2));
    const f = flap.current;
    if (f) {
      f.style.setProperty("--flap-clip", c.flap.length ? polygon(c.flap, r.left, r.top) : "");
      f.style.setProperty(
        "--flap-shine",
        `linear-gradient(${c.foldAngle}deg, rgba(0,0,0,0.10) ${fold}px, rgba(255,255,255,0.28) ${(fold + tip) / 2}px, rgba(0,0,0,0.08) ${tip}px)`,
      );
    }
    const s = shade.current;
    if (s) {
      s.style.setProperty("--shade-clip", c.lifted.length ? polygon(c.lifted, r.left, r.top) : "");
      s.style.setProperty(
        "--shade",
        `linear-gradient(${c.foldAngle}deg, rgba(0,0,0,0) ${fold - spread}px, rgba(0,0,0,${(0.3 * (1 - c.progress) + 0.08).toFixed(3)}) ${fold}px)`,
      );
    }
  }, []);

  const clearPaint = useCallback(() => {
    area.current?.style.removeProperty("--clip");
    for (const el of [flap.current, shade.current]) {
      el?.style.removeProperty("--flap-clip");
      el?.style.removeProperty("--flap-shine");
      el?.style.removeProperty("--shade-clip");
      el?.style.removeProperty("--shade");
    }
  }, []);

  const stopFrame = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  /** Moves the corner from `from` to `to` (or along `path`) over `ms`, then calls `done`. */
  const animate = useCallback(
    (side: Side, path: (k: number) => Point, ms: number, done: () => void) => {
      stopFrame();
      const start = performance.now();
      const step = () => {
        const k = Math.min(1, (performance.now() - start) / ms);
        paint(side, path(k));
        if (k < 1) frame.current = requestAnimationFrame(step);
        else {
          frame.current = null;
          done();
        }
      };
      frame.current = requestAnimationFrame(step);
    },
    [paint, stopFrame],
  );

  const reset = useCallback(() => {
    stopFrame();
    for (const id of timers.current) clearTimeout(id);
    timers.current = [];
    drag.current = null;
    clearPaint();
    setSlow(false);
    go("idle");
  }, [clearPaint, go, stopFrame]);

  /** The page is gone: a blank sheet until the next chapter arrives. */
  const handOver = useCallback(
    (href: string) => {
      go("blank");
      area.current?.style.setProperty("--clip", "inset(100% 0 0 0)");
      flap.current?.style.removeProperty("--flap-clip");
      shade.current?.style.removeProperty("--shade-clip");
      timers.current.push(setTimeout(() => setSlow(true), SLOW_MS));
      router.push(href);
    },
    [go, router],
  );

  const fadeTo = useCallback(
    (href: string) => {
      go("fading");
      timers.current.push(setTimeout(() => setSlow(true), SLOW_MS));
      timers.current.push(setTimeout(() => router.push(href), FADE_MS));
    },
    [go, router],
  );

  const complete = useCallback(
    (side: Side, from: Point) => {
      const href = target(side);
      if (!href) return;
      go("turning");
      const to = farCorner(side, pageWidth());
      animate(side, (k) => ({ x: from.x + (to.x - from.x) * easeOut(k), y: from.y + (to.y - from.y) * easeOut(k) }), COMPLETE_MS, () => handOver(href));
    },
    [animate, go, handOver, pageWidth, target],
  );

  const springBack = useCallback(
    (side: Side, from: Point) => {
      if (reducedMotion()) {
        reset();
        return;
      }
      go("turning");
      const to = restCorner(side, pageWidth());
      animate(side, (k) => ({ x: from.x + (to.x - from.x) * easeOut(k), y: from.y + (to.y - from.y) * easeOut(k) }), BACK_MS, reset);
    },
    [animate, go, pageWidth, reset],
  );

  const play = useCallback(
    (side: Side) => {
      const href = target(side);
      if (!href || stateRef.current !== "idle") return;
      if (reducedMotion()) {
        go("blank");
        timers.current.push(setTimeout(() => setSlow(true), SLOW_MS));
        router.push(href);
        return;
      }
      go("turning");
      const r = area.current ? pageRect(area.current) : { w: window.innerWidth, h: window.innerHeight };
      const w = r.w;
      const h = r.h;
      const from = restCorner(side, w);
      const to = farCorner(side, w);
      animate(
        side,
        (k) => {
          const e = easeInOut(k);
          return { x: from.x + (to.x - from.x) * e, y: 0.15 * h * Math.sin(Math.PI * e) };
        },
        PLAY_MS,
        () => handOver(href),
      );
    },
    [animate, go, handOver, router, target],
  );

  // Touch handling: listeners on the element, so touchmove can hold the scroll once the gesture is a turn.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const now = () => performance.now();
    const onStart = (e: TouchEvent) => {
      // A second finger on a page being turned: it is a pinch, not a turn.
      const d = drag.current;
      if (d && !singleTouch(e.touches)) {
        drag.current = null;
        if (d.axis === "turn" && d.side) springBack(d.side, cornerFor(d.side, d.dx, d.dy, pageWidth()));
        return;
      }
      if (stateRef.current !== "idle") return;
      if (!singleTouch(e.touches)) {
        drag.current = null;
        return;
      }
      const touch = e.touches[0];
      if (zoomedIn() || !canStartAt(e.target as Element, touch.clientX, window.innerWidth)) return;
      drag.current = { x0: touch.clientX, y0: touch.clientY, axis: "pending", dx: 0, dy: 0, samples: [{ x: touch.clientX, t: now() }] };
    };
    const onMove = (e: TouchEvent) => {
      const d = drag.current;
      if (!d) return;
      if (!singleTouch(e.touches)) {
        drag.current = null;
        if (d.axis === "turn" && d.side) springBack(d.side, cornerFor(d.side, d.dx, d.dy, pageWidth()));
        return;
      }
      const touch = e.touches[0];
      d.dx = touch.clientX - d.x0;
      d.dy = touch.clientY - d.y0;
      if (d.axis === "pending") {
        const axis = decideAxis(d.dx, d.dy);
        if (axis === "pending") return;
        if (axis === "scroll" || !target(sideOf(d.dx))) {
          drag.current = null;
          return;
        }
        d.axis = "turn";
        d.side = sideOf(d.dx);
        go("dragging");
      }
      e.preventDefault();
      const t = now();
      d.samples.push({ x: touch.clientX, t });
      while (d.samples.length > 2 && t - d.samples[0].t > VELOCITY_WINDOW_MS) d.samples.shift();
      if (reducedMotion() || frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const cur = drag.current;
        if (cur?.side) paint(cur.side, cornerFor(cur.side, cur.dx, cur.dy, pageWidth()));
      });
    };
    const onEnd = () => {
      const d = drag.current;
      drag.current = null;
      if (!d || d.axis !== "turn" || !d.side) return;
      stopFrame();
      const first = d.samples[0];
      const last = d.samples[d.samples.length - 1];
      // A finger that stopped before it let go is not flicking, however fast it moved before.
      const vx = last.t > first.t && now() - last.t <= VELOCITY_WINDOW_MS ? (last.x - first.x) / (last.t - first.t) : 0;
      const w = pageWidth();
      const motionless = reducedMotion();
      const outcome = releaseOutcome({ dx: d.dx, dy: d.dy, w, vx, reducedMotion: motionless, side: d.side });
      const href = target(d.side);
      if (motionless) {
        if (outcome === "complete" && href) fadeTo(href);
        else go("idle");
        return;
      }
      const from = cornerFor(d.side, d.dx, d.dy, w);
      if (outcome === "complete") complete(d.side, from);
      else springBack(d.side, from);
    };
    const onCancel = () => {
      const d = drag.current;
      drag.current = null;
      if (d?.axis === "turn" && d.side) springBack(d.side, cornerFor(d.side, d.dx, d.dy, pageWidth()));
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onCancel);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, [complete, fadeTo, go, paint, pageWidth, springBack, stopFrame, target]);

  // Pinched in, one finger pans the enlarged page sideways too (the CSS gives the browser every pan back).
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || typeof vv.addEventListener !== "function") return;
    const onResize = () => setZoomed(zoomedIn());
    onResize();
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  // Back to a page kept in the browser's cache (or any history move): never leave it clipped.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) reset();
    };
    window.addEventListener("pageshow", onShow);
    window.addEventListener("popstate", reset);
    return () => {
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("popstate", reset);
    };
  }, [reset]);

  useEffect(() => () => {
    stopFrame();
    for (const id of timers.current) clearTimeout(id);
  }, [stopFrame]);

  return (
    <TurnContext.Provider value={{ play }}>
      <div ref={area} data-page-turn="" data-state={state} data-zoomed={zoomed ? "" : undefined} className={styles.area}>
        {children}
      </div>
      <div ref={shade} aria-hidden className={styles.shade} />
      <div ref={flap} aria-hidden data-testid="page-turn-flap" className={`${styles.flap} bg-white dark:bg-slate-950`} />
      {slow && (
        <p role="status" className={styles.loading}>
          {t("turning")}
        </p>
      )}
    </TurnContext.Provider>
  );
}

/** A chapter link that, on a plain left click inside a PageTurn, plays the turn before it navigates. */
export function TurnLink({ side, href, rel, className, children }: {
  side: Side; href: string; rel: "prev" | "next"; className?: string; children: ReactNode;
}) {
  const turn = useContext(TurnContext);
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!turn || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    turn.play(side);
  };
  return (
    <Link href={href} rel={rel} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
