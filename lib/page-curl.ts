/**
 * The geometry of a page curl, StPageFlip-style, in viewport coordinates (origin top-left, y down).
 *
 * The page rests with its corner C at the top-right (turning to the next chapter) or the top-left (the
 * previous one). The finger moves that corner to P. The fold line is the perpendicular bisector of C–P: the
 * page points nearer to C than to P have lifted, the others stay; the lifted part, reflected across the fold,
 * is the flap (the back of the sheet).
 */

export type Point = { x: number; y: number };
export type Side = "next" | "prev";

export type Curl = {
  /** The part of the page that stays, [] when fully turned. */
  stay: Point[];
  /** The part that has lifted, where it was (the blank sheet shows there), [] at rest. */
  lifted: Point[];
  /** The lifted part reflected across the fold, [] at rest. */
  flap: Point[];
  /** The CSS gradient angle across the fold, from C's side towards P's (the direction C→P), in degrees. */
  foldAngle: number;
  /** 0 at rest … 1 fully turned. */
  progress: number;
};

const EPS = 1e-6;

export function restCorner(side: Side, w: number): Point {
  return side === "next" ? { x: w, y: 0 } : { x: 0, y: 0 };
}

/** The spine's top corner: the sheet turns about it, so the moving corner stays within w of it. */
function spine(side: Side, w: number): Point {
  return side === "next" ? { x: 0, y: 0 } : { x: w, y: 0 };
}

/** P clamped to within w of the spine's top corner, so the sheet never tears from its spine. */
export function clampCorner(side: Side, p: Point, w: number): Point {
  const s = spine(side, w);
  const dx = p.x - s.x;
  const dy = p.y - s.y;
  const d = Math.hypot(dx, dy);
  if (d <= w) return p;
  return { x: s.x + (dx * w) / d, y: s.y + (dy * w) / d };
}

/** Sutherland–Hodgman against one half-plane: keeps the points where f ≥ 0. */
function clip(poly: Point[], f: (p: Point) => number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const fc = f(cur);
    const fp = f(prev);
    if ((fc >= 0) !== (fp >= 0)) {
      const t = fp / (fp - fc);
      out.push({ x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) });
    }
    if (fc >= 0) out.push(cur);
  }
  return dedupe(out);
}

function same(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
}

function dedupe(poly: Point[]): Point[] {
  const out = poly.filter((p, i) => i === 0 || !same(p, poly[i - 1]));
  while (out.length > 1 && same(out[0], out[out.length - 1])) out.pop();
  return out;
}

function area(poly: Point[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** The polygon cut to the page rectangle 0..w × 0..h. */
function onPage(poly: Point[], w: number, h: number): Point[] {
  const sides: ((q: Point) => number)[] = [(q) => q.x, (q) => w - q.x, (q) => q.y, (q) => h - q.y];
  return sides.reduce((acc, f) => (acc.length ? clip(acc, f) : acc), poly);
}

const solid = (poly: Point[]) => (poly.length >= 3 && area(poly) > EPS ? poly : []);

export function curl(side: Side, finger: Point, w: number, h: number): Curl {
  const c = restCorner(side, w);
  const p = clampCorner(side, finger, w);
  const page: Point[] = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
  const d = { x: p.x - c.x, y: p.y - c.y };
  const len = Math.hypot(d.x, d.y);
  if (len < EPS) return { stay: page, lifted: [], flap: [], foldAngle: 90, progress: 0 };
  const m = { x: (p.x + c.x) / 2, y: (p.y + c.y) / 2 };
  // > 0 on P's side of the fold (the page that stays), < 0 on C's (the lifted part).
  const f = (q: Point) => (q.x - m.x) * d.x + (q.y - m.y) * d.y;
  const n = { x: d.x / len, y: d.y / len };
  const reflect = (q: Point): Point => {
    const k = 2 * ((q.x - m.x) * n.x + (q.y - m.y) * n.y);
    return { x: q.x - k * n.x, y: q.y - k * n.y };
  };
  const stay = solid(clip(page, f));
  const lifted = solid(clip(page, (q) => -f(q)));
  // Pulled past the middle, the reflected flap would reach beyond the spine: it is cut at the page's edge.
  const flap = solid(onPage(lifted.map(reflect), w, h));
  return {
    stay,
    lifted,
    flap,
    foldAngle: (Math.atan2(d.x, -d.y) * 180) / Math.PI,
    progress: Math.min(1, Math.abs(c.x - p.x) / (2 * w)),
  };
}
