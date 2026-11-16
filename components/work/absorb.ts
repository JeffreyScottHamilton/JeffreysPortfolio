/**
 * Geometry shared by the scroll pieces: an element's laid-out rect (its own
 * transforms undone), a bust Portrait's head and the face ellipse that dots
 * dissolve into / form out of.
 */
import { computeLayout } from "@/lib/halftone";

export type Head = { x: number; y: number; r: number };



const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const norm = (x: number, a: number, b: number) =>
  clamp((x - a) / (b - a));


type Box = { left: number; top: number; width: number; height: number };

/** An element's CSS transform (+ individual translate / scale) when it is a
 * plain axis-aligned scale + translate, else null. */
function affineOf(el: Element) {
  const cs = getComputedStyle(el);
  const tr = cs.transform;
  const sc = cs.scale;
  const tl = cs.translate;
  const none = (v: string | undefined) => !v || v === "none";
  if (none(tr) && none(sc) && none(tl)) return null;
  const m = new DOMMatrix();
  if (!none(tl)) {
    const [x, y = "0px"] = tl.split(" ");
    if (!x.endsWith("px") || !y.endsWith("px")) return null;
    m.translateSelf(parseFloat(x), parseFloat(y));
  }
  if (!none(sc)) {
    const [x, y = x] = sc.split(" ").map(Number);
    m.scaleSelf(x, y);
  }
  if (!none(tr)) m.multiplySelf(new DOMMatrix(tr));
  if (Math.abs(m.b) > 1e-6 || Math.abs(m.c) > 1e-6 || m.a <= 0 || m.d <= 0) return null;
  if (Math.abs(m.a - 1) < 1e-6 && Math.abs(m.d - 1) < 1e-6 && !m.e && !m.f) return null;
  const [ox = "0", oy = "0"] = cs.transformOrigin.split(" ");
  return { a: m.a, d: m.d, e: m.e, f: m.f, ox: parseFloat(ox), oy: parseFloat(oy) };
}

/**
 * An element's border box in viewport px as laid out, i.e. with the CSS
 * transforms on it and its ancestors undone (axis-aligned scale / translate,
 * e.g. the intro's scale(0.97) on the portrait that may still be easing out
 * when a set piece measures; getBoundingClientRect would bake that in).
 */
export function layoutRect(el: Element): Box {
  const chain: Element[] = [];
  for (let n: Element | null = el; n && n !== document.documentElement; n = n.parentElement)
    chain.push(n);
  // inverse maps, outermost transform first
  const inv: ((x: number, y: number) => [number, number])[] = [];
  const undo = (x: number, y: number) => {
    for (const f of inv) [x, y] = f(x, y);
    return [x, y] as const;
  };
  for (let i = chain.length - 1; i >= 0; i--) {
    const t = affineOf(chain[i]);
    if (!t) continue;
    const b = chain[i].getBoundingClientRect();
    const [bl, bt] = undo(b.left, b.top);
    // rendered left = P + o(1 - a) + e; the pivot is P + o
    const cx = bl - t.ox * (1 - t.a) - t.e + t.ox;
    const cy = bt - t.oy * (1 - t.d) - t.f + t.oy;
    inv.push((x, y) => [cx + (x - cx - t.e) / t.a, cy + (y - cy - t.f) / t.d]);
  }
  const r = el.getBoundingClientRect();
  if (!inv.length) return { left: r.left, top: r.top, width: r.width, height: r.height };
  const [x0, y0] = undo(r.left, r.top);
  const [x1, y1] = undo(r.right, r.bottom);
  return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
}

/** The head of a bust Portrait (root element), in viewport px (as laid out). */
export function headOf(portraitRoot: HTMLElement): Head {
  const r = layoutRect(portraitRoot);
  const L = computeLayout(
    Math.max(1, Math.round(portraitRoot.clientWidth)),
    Math.max(1, Math.round(portraitRoot.clientHeight)),
    "bust",
  );
  return { x: r.left + L.headX, y: r.top + L.headY, r: L.headR };
}

/** The face of a bust Portrait as an ellipse (dots dissolve into / form out of it). */
export function faceRegion(portraitRoot: HTMLElement) {
  const h = headOf(portraitRoot);
  return { x: h.x, y: h.y, rx: h.r * 0.72, ry: h.r * 0.9 };
}
