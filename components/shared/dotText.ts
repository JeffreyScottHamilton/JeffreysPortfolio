/**
 * Text ⇄ dots: the one implementation behind every text transition on the
 * site. Text never fades, slides or flies as letters: it dissolves into dots
 * and forms from dots, then the crisp DOM text takes over in exact
 * registration.
 *
 *  - `sampleText` renders DOM text offscreen glyph by glyph, in its computed
 *    font and colour, at the exact on-page position of every character (DOM
 *    Range rects), plus small rules (accent bars), inline SVG icons and CSS
 *    ghost text (`[data-text]::before`), and samples it onto a dot grid
 *    (pitch ≈2.25 px; larger type may use a coarser pitch). Red accents stay
 *    red: every dot keeps its source colour (a shared `Palette`).
 *  - `acquireLayer` hands out a painter slot on ONE fixed full-viewport 2D
 *    canvas (pointer-events: none, DPR ≤ 2) that is shown only while some
 *    painter is active.
 *  - `DotMorph` moves one dot set between two states: text A → text B,
 *    text → a region / a scatter (dissolve), or a region / points / scatter
 *    → text (form), along curved, staggered paths with a curl drift. The real
 *    text cross-fades via `--dt` (opacity only; it always stays in the DOM).
 *    `update(p)` is a pure function of p, so scrubbed uses are reversible;
 *    `play` drives it on a clock.
 *
 * Work's board text (work/TextDots.ts) and Explore's chapter text
 * (explore/chapterDots.ts) are built on the same sampler, flight path and
 * layer.
 */
import { dprCap, hash01 } from "@/lib/halftone";

/* ------------------------------------------------------------- helpers */

export const PITCH = 2.25;
const SS = 3; // supersampling per cell side
const TAU = Math.PI * 2;

export const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const norm = (x: number, a: number, b: number) => clamp((x - a) / (b - a));
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** fixed fine pitch (small type) */
export const finePitch = () => PITCH;
/** pitch that grows with very large type (keeps dot counts sane) */
export const scaledPitch = (px: number) => Math.max(PITCH, px / 21);

/** Curl of a few sine waves (same flavour as the morph's ink flow). */
export function curl(x: number, y: number, t: number): [number, number] {
  let gx = 0;
  let gy = 0;
  let c = Math.cos(0.021 * x + 0.013 * y + t * 3.1 + 0.7);
  gx += 0.021 * c;
  gy += 0.013 * c;
  c = Math.cos(-0.012 * x + 0.027 * y - t * 2.3 + 2.1);
  gx -= 0.012 * c;
  gy += 0.027 * c;
  c = 0.6 * Math.cos(0.034 * x - 0.019 * y + t * 4.2 + 4.0);
  gx += 0.034 * c;
  gy -= 0.019 * c;
  return [gy / 0.05, -gx / 0.05];
}

/**
 * A point on a dot's flight at eased progress e: a quadratic curve bent off
 * the chord by `bend`, plus a curl drift (px) that peaks mid-flight.
 */
export function flight(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  e: number,
  bend: number,
  time: number,
  drift: number,
): [number, number] {
  if (e <= 0) return [x0, y0];
  if (e >= 1) return [x1, y1];
  const dx = x1 - x0;
  const dy = y1 - y0;
  const cx = x0 + dx * 0.5 - dy * bend;
  const cy = y0 + dy * 0.5 + dx * bend;
  const m = 1 - e;
  let x = m * m * x0 + 2 * m * e * cx + e * e * x1;
  let y = m * m * y0 + 2 * m * e * cy + e * e * y1;
  const mo = Math.sin(Math.PI * e);
  if (mo > 0.001 && drift) {
    const [qx, qy] = curl(x, y, time);
    x += qx * drift * mo;
    y += qy * drift * mo;
  }
  return [x, y];
}

/** Rank order: horizontal bands top → bottom, left → right inside a band. */
export function rankOrder(x: ArrayLike<number>, y: ArrayLike<number>, n: number, bands = 36) {
  const byY = [...Array(n).keys()].sort((a, b) => y[a] - y[b]);
  const out: number[] = [];
  for (let s = 0; s < bands; s++) {
    const a = Math.floor((s * n) / bands);
    const z = Math.floor(((s + 1) * n) / bands);
    out.push(...byY.slice(a, z).sort((p, q) => x[p] - x[q]));
  }
  return out;
}

export async function fontsReady() {
  try {
    await document.fonts?.ready;
  } catch {
    /* draw with whatever is loaded */
  }
}

export { dprCap } from "@/lib/halftone";

/** default dot budget for one transition (lower on small screens) */
export const dotBudget = () => (innerWidth < 720 ? 4000 : 9000);

/* ------------------------------------------------------------- palette */

/** Colours shared by several clouds (dots store an index). */
export class Palette {
  colors: string[] = [];
  private map = new Map<string, number>();
  idx(c: string) {
    let i = this.map.get(c);
    if (i === undefined) {
      i = this.colors.length;
      this.colors.push(c);
      this.map.set(c, i);
    }
    return i;
  }
}

export type Cloud = {
  n: number;
  x: Float32Array;
  y: Float32Array;
  r: Float32Array;
  /** palette index */
  c: Uint16Array;
};

export const emptyCloud = (): Cloud => ({
  n: 0,
  x: new Float32Array(0),
  y: new Float32Array(0),
  r: new Float32Array(0),
  c: new Uint16Array(0),
});

/* ------------------------------------------------------------- sampling */

export type SampleOpts = {
  palette: Palette;
  /** coordinates are relative to this point (viewport px); default 0, 0 */
  origin?: { left: number; top: number };
  /** pitch for a block of a given font size (px) */
  pitch?: (fontPx: number) => number;
  /** skip text under visibility: hidden (default true) */
  skipHidden?: boolean;
  /** small solid boxes (accent rules), default true */
  rules?: boolean;
  /** inline SVG icons, default true */
  icons?: boolean;
  /** cap (even subsample) */
  maxDots?: number;
};

type Op =
  | { k: "t"; s: string; x: number; y: number; font: string; ls: string }
  | { k: "r"; x: number; y: number; w: number; h: number };
type Icon = { src: string; x: number; y: number; w: number; h: number; ink: string; accent: string };
type Block = {
  ox: number;
  oy: number;
  cols: number;
  rows: number;
  P: number;
  clip: { x: number; w: number } | null;
  ops: Map<string, Op[]>;
  icons: Icon[];
};

let measureCtx: CanvasRenderingContext2D | null = null;
const metricCache = new Map<string, { asc: number; desc: number }>();
function metrics(font: string) {
  let m = metricCache.get(font);
  if (m) return m;
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) return { asc: 0, desc: 0 };
  measureCtx.font = font;
  const t = measureCtx.measureText("Hg");
  m = { asc: t.fontBoundingBoxAscent || 0, desc: t.fontBoundingBoxDescent || 0 };
  if (metricCache.size > 200) metricCache.clear();
  metricCache.set(font, m);
  return m;
}
const fontOf = (cs: CSSStyleDeclaration) => `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
const transparent = (c: string) => !c || c === "transparent" || /rgba\([^)]*,\s*0\)$/.test(c);

function svgSource(svg: SVGSVGElement, w: number, h: number) {
  try {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const src = [svg, ...svg.querySelectorAll("*")];
    const dst = [clone, ...clone.querySelectorAll("*")];
    src.forEach((el, i) => {
      const cs = getComputedStyle(el);
      const d = dst[i];
      if (!d) return;
      d.setAttribute("fill", cs.fill);
      d.setAttribute("stroke", cs.stroke);
      if (cs.strokeWidth) d.setAttribute("stroke-width", cs.strokeWidth);
    });
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    clone.removeAttribute("style");
    const s = new XMLSerializer().serializeToString(clone);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`;
  } catch {
    return null;
  }
}

/** Read one block's glyphs / rules / icons (synchronous: the layout as it is now). */
function readBlock(el: HTMLElement, o: Required<Omit<SampleOpts, "palette" | "origin" | "maxDots">>): Block | null {
  const er = el.getBoundingClientRect();
  if (er.width <= 0 || er.height <= 0) return null;
  const ecs = getComputedStyle(el);
  if (ecs.display === "none") return null;
  const P = o.pitch(parseFloat(ecs.fontSize) || 16);
  const pad = 3;
  const b: Block = {
    ox: er.left - pad * P,
    oy: er.top - pad * P,
    cols: Math.ceil(er.width / P) + 2 * pad,
    rows: Math.ceil(er.height / P) + 2 * pad,
    P,
    clip: ecs.overflowX !== "visible" ? { x: er.left, w: er.width } : null,
    ops: new Map(),
    icons: [],
  };
  const push = (color: string, op: Op) => {
    let l = b.ops.get(color);
    if (!l) b.ops.set(color, (l = []));
    l.push(op);
  };
  const all = [el, ...el.querySelectorAll<HTMLElement>("*")];
  const csCache = new Map<Element, CSSStyleDeclaration | null>();
  // (opacity 0 inside the block, e.g. hover tips, is not drawn; the block's
  // own opacity is whatever the transition is doing with it)
  const style = (e: Element): CSSStyleDeclaration | null => {
    let cs = csCache.get(e);
    if (cs === undefined) {
      cs = getComputedStyle(e);
      if (
        e.closest(".sr-only") ||
        cs.display === "none" ||
        (o.skipHidden && cs.visibility === "hidden") ||
        (e !== el && (cs.opacity === "0" || (e.parentElement && e.parentElement !== el && !style(e.parentElement))))
      )
        cs = null;
      csCache.set(e, cs);
    }
    return cs;
  };
  // small solid rules (accent bars) and ghost text
  for (const r of all) {
    if (!(r instanceof HTMLElement)) continue;
    const cs = style(r);
    if (!cs) continue;
    if (o.rules && !transparent(cs.backgroundColor)) {
      const rr = r.getBoundingClientRect();
      if (rr.width > 0 && rr.height > 0 && Math.min(rr.width, rr.height) <= 8)
        push(cs.backgroundColor, { k: "r", x: rr.left, y: rr.top, w: rr.width, h: rr.height });
    }
    const ghost = r.getAttribute("data-text");
    if (ghost) {
      const ps = getComputedStyle(r, "::before");
      if (ps.content && ps.content !== "none" && ps.content !== "normal") {
        const rr = r.getBoundingClientRect();
        const font = fontOf(ps);
        const m = metrics(font);
        const y = rr.top + (rr.height - (m.asc + m.desc)) / 2 + m.asc;
        const x = rr.left + (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.borderLeftWidth) || 0);
        const s = ps.textTransform === "uppercase" ? ghost.toUpperCase() : ghost;
        push(ps.color, { k: "t", s, x, y, font, ls: ps.letterSpacing });
      }
    }
  }
  // icons
  if (o.icons)
    for (const s of el.querySelectorAll<SVGSVGElement>("svg")) {
      if (s.closest(".sr-only")) continue;
      const host = s.parentElement;
      if (host && host !== el && !style(host)) continue;
      const sr = s.getBoundingClientRect();
      if (sr.width <= 0 || sr.height <= 0 || sr.width > 160 || sr.height > 160) continue;
      const cs = getComputedStyle(s);
      if (cs.display === "none" || (o.skipHidden && cs.visibility === "hidden")) continue;
      const src = svgSource(s, sr.width, sr.height);
      if (!src) continue;
      b.icons.push({
        src,
        x: sr.left,
        y: sr.top,
        w: sr.width,
        h: sr.height,
        ink: cs.color,
        accent: cs.getPropertyValue("--accent").trim() || "#e8402a",
      });
    }
  // glyphs, one by one at their exact on-page positions
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const parent = node.parentElement;
    if (!parent || parent instanceof SVGElement || parent.closest("svg")) continue;
    const cs = style(parent);
    if (!cs) continue;
    const font = fontOf(cs);
    const m = metrics(font);
    const upper = cs.textTransform === "uppercase";
    const text = node.data;
    for (let i = 0; i < text.length; ) {
      const cp = text.codePointAt(i) ?? 32;
      const len = cp > 0xffff ? 2 : 1;
      const raw = text.slice(i, i + len);
      if (raw.trim()) {
        range.setStart(node, i);
        range.setEnd(node, i + len);
        const rs = range.getClientRects();
        const r = rs.length ? rs[0] : null;
        if (r && r.width > 0)
          push(cs.color, { k: "t", s: upper ? raw.toUpperCase() : raw, x: r.left, y: r.bottom - m.desc, font, ls: "0px" });
      }
      i += len;
    }
  }
  range.detach?.();
  return b.ops.size || b.icons.length ? b : null;
}

async function decode(src: string) {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

/**
 * Sample text blocks to dots. All layout is read synchronously when this is
 * called (so the caller may change styles right after); icons decode async.
 */
export async function sampleText(els: HTMLElement[], opts: SampleOpts): Promise<Cloud> {
  const o = {
    pitch: opts.pitch ?? finePitch,
    skipHidden: opts.skipHidden ?? true,
    rules: opts.rules ?? true,
    icons: opts.icons ?? true,
  };
  const pal = opts.palette;
  const org = opts.origin ?? { left: 0, top: 0 };
  const blocks = els.map((el) => readBlock(el, o)).filter((b): b is Block => !!b);
  const imgs = await Promise.all(blocks.map((b) => Promise.all(b.icons.map((i) => decode(i.src)))));

  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return emptyCloud();
  const xs: number[] = [];
  const ys: number[] = [];
  const rs: number[] = [];
  const cs: number[] = [];
  const begin = (b: Block) => {
    const f = SS / b.P;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(f, 0, 0, f, -b.ox * f, -b.oy * f);
  };
  const read = () => {
    try {
      return ctx.getImageData(0, 0, cv.width, cv.height).data;
    } catch {
      return null;
    }
  };
  const dot = (b: Block, i: number, j: number, cov: number, ci: number) => {
    const P = b.P;
    xs.push(b.ox + (i + 0.5) * P - org.left);
    ys.push(b.oy + (j + 0.5) * P - org.top);
    rs.push(Math.min(0.58 * P, 0.61 * P * Math.sqrt(cov)));
    cs.push(ci);
  };
  blocks.forEach((b, bi) => {
    cv.width = b.cols * SS;
    cv.height = b.rows * SS;
    const cw = cv.width;
    for (const [color, ops] of b.ops) {
      begin(b);
      ctx.save();
      if (b.clip) {
        ctx.beginPath();
        ctx.rect(b.clip.x, b.oy, b.clip.w, b.rows * b.P);
        ctx.clip();
      }
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      let font = "";
      let ls = "";
      for (const op of ops) {
        if (op.k === "r") {
          ctx.fillRect(op.x, op.y, op.w, op.h);
          continue;
        }
        if (op.font !== font) ctx.font = font = op.font;
        if (op.ls !== ls) {
          ls = op.ls;
          try {
            (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
              ls === "normal" ? "0px" : ls;
          } catch {
            /* older engines */
          }
        }
        ctx.fillText(op.s, op.x, op.y);
      }
      ctx.restore();
      const d = read();
      if (!d) continue;
      const ci = pal.idx(color);
      for (let j = 0; j < b.rows; j++)
        for (let i = 0; i < b.cols; i++) {
          let al = 0;
          for (let v = 0; v < SS; v++) {
            let q = ((j * SS + v) * cw + i * SS) * 4 + 3;
            for (let u = 0; u < SS; u++, q += 4) al += d[q];
          }
          const cov = al / (255 * SS * SS);
          if (cov >= 0.07) dot(b, i, j, cov, ci);
        }
    }
    // icons: each cell keeps the icon's ink or its red accent
    b.icons.forEach((ic, k) => {
      const img = imgs[bi][k];
      if (!img) return;
      begin(b);
      ctx.drawImage(img, ic.x, ic.y, ic.w, ic.h);
      const d = read();
      if (!d) return;
      const inkRGB = rgbOf(ic.ink);
      const inkI = pal.idx(ic.ink);
      const redI = pal.idx(ic.accent);
      const x0 = Math.max(0, Math.floor((ic.x - b.ox) / b.P) - 1);
      const x1 = Math.min(b.cols, Math.ceil((ic.x + ic.w - b.ox) / b.P) + 1);
      const y0 = Math.max(0, Math.floor((ic.y - b.oy) / b.P) - 1);
      const y1 = Math.min(b.rows, Math.ceil((ic.y + ic.h - b.oy) / b.P) + 1);
      for (let j = y0; j < y1; j++)
        for (let i = x0; i < x1; i++) {
          let al = 0;
          let R = 0;
          let G = 0;
          let B = 0;
          for (let v = 0; v < SS; v++) {
            let q = ((j * SS + v) * cw + i * SS) * 4;
            for (let u = 0; u < SS; u++, q += 4) {
              const a = d[q + 3];
              al += a;
              R += d[q] * a;
              G += d[q + 1] * a;
              B += d[q + 2] * a;
            }
          }
          const cov = al / (255 * SS * SS);
          if (cov < 0.08) continue;
          R /= al;
          G /= al;
          B /= al;
          if (R - G > 70 && R - B > 40) dot(b, i, j, cov, redI);
          else if (!inkRGB || Math.abs(R - inkRGB[0]) + Math.abs(G - inkRGB[1]) + Math.abs(B - inkRGB[2]) < 200)
            dot(b, i, j, cov, inkI);
          // anything else is a knock-out (e.g. the play triangle)
        }
    });
  });
  cv.width = cv.height = 0;
  let n = xs.length;
  let keep: number[] | null = null;
  const max = opts.maxDots ?? Infinity;
  if (n > max) {
    keep = [];
    for (let i = 0; i < n; i++) if (hash01(i, 17, 7) < max / n) keep.push(i);
    n = keep.length;
  }
  const pick = (a: number[], T: Float32ArrayConstructor | Uint16ArrayConstructor) =>
    keep ? T.from(keep.map((i) => a[i])) : T.from(a);
  return {
    n,
    x: pick(xs, Float32Array) as Float32Array,
    y: pick(ys, Float32Array) as Float32Array,
    r: pick(rs, Float32Array) as Float32Array,
    c: pick(cs, Uint16Array) as Uint16Array,
  };
}

function rgbOf(c: string): [number, number, number] | null {
  const m = c.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}

/* ------------------------------------------------------------- the layer */

export type Painter = (ctx: CanvasRenderingContext2D, W: number, H: number) => void;

class Layer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
  painters = new Map<object, Painter>();
  users = 0;
  private queued = false;
  private shown = false;

  constructor() {
    const c = document.createElement("canvas");
    c.className = "dot-layer";
    c.setAttribute("aria-hidden", "true");
    this.canvas = c;
    this.ctx = c.getContext("2d");
    document.body.append(c);
  }

  set(key: object, fn: Painter | null) {
    if (fn) this.painters.set(key, fn);
    else if (!this.painters.delete(key)) return;
    if (this.queued) return;
    this.queued = true;
    // coalesce all painters updated in this task; still before the paint
    queueMicrotask(() => {
      this.queued = false;
      this.render();
    });
  }

  private render() {
    const c = this.canvas;
    const ctx = this.ctx;
    if (!ctx || !this.painters.size) {
      if (this.shown) {
        this.shown = false;
        c.style.display = "none";
        c.width = c.height = 0;
      }
      return;
    }
    const dpr = dprCap();
    const W = innerWidth;
    const H = innerHeight;
    const bw = Math.round(W * dpr);
    const bh = Math.round(H * dpr);
    if (c.width !== bw || c.height !== bh) {
      c.width = bw;
      c.height = bh;
    }
    if (!this.shown) {
      this.shown = true;
      c.style.display = "block";
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bw, bh);
    for (const fn of this.painters.values()) {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fn(ctx, W, H);
      ctx.restore();
    }
  }

  destroy() {
    this.canvas.width = this.canvas.height = 0;
    this.canvas.remove();
  }
}

let shared: Layer | null = null;

export type LayerHandle = {
  /** set (or clear with null) this user's painter; drawn before the next paint */
  paint: (fn: Painter | null) => void;
  release: () => void;
};

/** A painter slot on the shared full-viewport dot canvas. */
export function acquireLayer(): LayerHandle {
  if (!shared) shared = new Layer();
  const layer = shared;
  layer.users++;
  const key = {};
  let live = true;
  return {
    paint: (fn) => {
      if (live) layer.set(key, fn);
    },
    release: () => {
      if (!live) return;
      live = false;
      layer.set(key, null);
      if (--layer.users <= 0 && shared === layer) {
        layer.destroy();
        shared = null;
      }
    },
  };
}

/** Dots batched per palette colour. */
export class DotPaths {
  private paths: (Path2D | undefined)[] = [];
  constructor(
    private W: number,
    private H: number,
  ) {}
  add(ci: number, x: number, y: number, r: number) {
    if (r < 0.15 || x < -8 || y < -8 || x > this.W + 8 || y > this.H + 8) return;
    let p = this.paths[ci];
    if (!p) p = this.paths[ci] = new Path2D();
    p.moveTo(x + r, y);
    p.arc(x, y, r, 0, TAU);
  }
  fill(ctx: CanvasRenderingContext2D, pal: Palette, alpha: number) {
    if (alpha <= 0.002) return;
    ctx.globalAlpha = alpha;
    this.paths.forEach((p, i) => {
      if (!p) return;
      ctx.fillStyle = pal.colors[i] ?? "#888";
      ctx.fill(p);
    });
    ctx.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------- DOM text */

const owners = new WeakMap<HTMLElement, number>();
/** which morph last wrote an element's --dt (and the value) */
const writers = new WeakMap<HTMLElement, { by: object; q: number }>();
function own(el: HTMLElement) {
  owners.set(el, (owners.get(el) ?? 0) + 1);
  el.dataset.dt = "";
}
function disown(el: HTMLElement) {
  const n = (owners.get(el) ?? 1) - 1;
  el.style.removeProperty("--dt");
  writers.delete(el);
  el.style.removeProperty("visibility");
  el.style.removeProperty("pointer-events");
  if (n <= 0) {
    owners.delete(el);
    delete el.dataset.dt;
  } else owners.set(el, n);
}

/**
 * Text blocks of `root` currently on screen (outermost elements that own
 * visible text), for "whatever is showing dissolves".
 */
export function visibleTextBlocks(root: Element): HTMLElement[] {
  const set = new Set<HTMLElement>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const VW = innerWidth;
  const VH = innerHeight;
  const seen = new Map<Element, boolean>();
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (!node.data.trim()) continue;
    const p = node.parentElement;
    if (!(p instanceof HTMLElement) || set.has(p)) continue;
    let ok = seen.get(p);
    if (ok === undefined) {
      const r = p.getBoundingClientRect();
      ok =
        !p.closest(".sr-only, svg") &&
        r.width > 0 &&
        r.bottom > 0 &&
        r.top < VH &&
        r.right > 0 &&
        r.left < VW &&
        (p.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) ?? true);
      seen.set(p, ok);
    }
    if (ok) set.add(p);
  }
  return [...set].filter((el) => {
    for (let a = el.parentElement; a && a !== root; a = a.parentElement)
      if (a instanceof HTMLElement && set.has(a)) return false;
    return true;
  });
}

/* ------------------------------------------------------------- morph */

type XY = { x: number; y: number };
export type Side =
  /** real text: dissolves from / forms into these elements */
  | { text: HTMLElement[]; hide?: boolean }
  /** dots in an ellipse (viewport px at measure), e.g. a portrait's face */
  | { region: () => { x: number; y: number; rx: number; ry: number } }
  /** dots heaped on a few points (viewport px at measure) */
  | { points: () => XY[]; jitter?: number }
  /** a loose scatter of this radius (px) around the other side's text */
  | { scatter: number };

export type MorphOpts = {
  from: Side;
  to: Side;
  /** coordinates follow this element (scroll, pins); default: the viewport */
  anchor?: HTMLElement | null;
  salt?: number;
  maxDots?: number;
  pitch?: (fontPx: number) => number;
};

/* timing inside one morph (p = 0..1); same beat as the chapter dots */
const OUT_END = 0.1; // source DOM text gone
const FLY0 = 0.05; // first dots leave
const STAG = 0.28; // spread of departures
const FLY = 0.56; // share of the morph one dot spends flying
const IN_START = 0.88; // target DOM text starts to show
const DOT_OUT = 0.92; // dots start to fade under it
const DRIFT = 7;

const isText = (s: Side): s is { text: HTMLElement[]; hide?: boolean } => "text" in s;

export class DotMorph {
  private o: MorphOpts;
  private pal = new Palette();
  private layer: LayerHandle | null = null;
  private M = 0;
  private ax = new Float32Array(0);
  private ay = new Float32Array(0);
  private ar = new Float32Array(0);
  private ac = new Uint16Array(0);
  private bx = new Float32Array(0);
  private by = new Float32Array(0);
  private br = new Float32Array(0);
  private bc = new Uint16Array(0);
  private bend = new Float32Array(0);
  private amp = new Float32Array(0);
  private dly = new Float32Array(0);
  private a0: XY = { x: 0, y: 0 };
  private buildId = 0;
  private dtA = -1;
  private dtB = -1;
  private p = 0;
  private alive = true;
  ready = false;

  constructor(o: MorphOpts) {
    this.o = o;
    for (const s of [o.from, o.to]) if (isText(s)) s.text.forEach(own);
  }

  private anchorXY(): XY {
    const a = this.o.anchor;
    if (!a) return { x: 0, y: 0 };
    const r = a.getBoundingClientRect();
    return { x: r.left, y: r.top };
  }

  /** Sample both sides at rest (fonts first). Layout is read in one go. */
  async measure(): Promise<boolean> {
    const id = ++this.buildId;
    await fontsReady();
    if (id !== this.buildId || !this.alive) return false;
    const { from, to } = this.o;
    const a0 = this.anchorXY();
    const origin = { left: a0.x, top: a0.y };
    const max = this.o.maxDots ?? dotBudget();
    const so = { palette: this.pal, origin, pitch: this.o.pitch ?? scaledPitch, skipHidden: false, maxDots: max };
    const pa = isText(from) ? sampleText(from.text, so) : null;
    const pb = isText(to) ? sampleText(to.text, so) : null;
    const gen = (s: Side) => {
      if ("region" in s) {
        const g = s.region();
        return { kind: 1, g: { x: g.x - a0.x, y: g.y - a0.y, rx: g.rx, ry: g.ry }, pts: [] as XY[], d: 0 };
      }
      if ("points" in s) {
        const pts = s.points().map((p) => ({ x: p.x - a0.x, y: p.y - a0.y }));
        return { kind: 2, g: null, pts, d: s.jitter ?? 2 };
      }
      if ("scatter" in s) return { kind: 3, g: null, pts: [] as XY[], d: s.scatter };
      return null;
    };
    const ga = gen(from);
    const gb = gen(to);
    const [A, B] = await Promise.all([pa, pb]);
    if (id !== this.buildId || !this.alive) return false;
    this.a0 = a0;
    const nA = A?.n ?? 0;
    const nB = B?.n ?? 0;
    const M = Math.max(nA, nB);
    this.M = M;
    this.ready = false;
    if (!M) return false;
    const oA = A ? rankOrder(A.x, A.y, nA) : [];
    const oB = B ? rankOrder(B.x, B.y, nB) : [];
    const salt = this.o.salt ?? 1;
    this.ax = new Float32Array(M);
    this.ay = new Float32Array(M);
    this.ar = new Float32Array(M);
    this.ac = new Uint16Array(M);
    this.bx = new Float32Array(M);
    this.by = new Float32Array(M);
    this.br = new Float32Array(M);
    this.bc = new Uint16Array(M);
    this.bend = new Float32Array(M);
    this.amp = new Float32Array(M);
    this.dly = new Float32Array(M);
    let prevA = -1;
    let prevB = -1;
    for (let m = 0; m < M; m++) {
      if (A) {
        const i = oA[Math.floor((m * nA) / M)];
        this.ax[m] = A.x[i];
        this.ay[m] = A.y[i];
        this.ar[m] = i === prevA ? 0 : A.r[i];
        this.ac[m] = A.c[i];
        prevA = i;
      }
      if (B) {
        const i = oB[Math.floor((m * nB) / M)];
        this.bx[m] = B.x[i];
        this.by[m] = B.y[i];
        this.br[m] = i === prevB ? 0 : B.r[i];
        this.bc[m] = B.c[i];
        prevB = i;
      }
      this.bend[m] = (0.1 + 0.22 * hash01(m, salt, 1)) * (hash01(m, salt, 2) < 0.5 ? -1 : 1);
      this.amp[m] = 0.5 + hash01(m, salt, 3);
      this.dly[m] = 0.6 * (m / M) + 0.4 * hash01(m, salt, 4);
    }
    // the generated side of a dissolve / a formation
    const fill = (g: ReturnType<typeof gen>, x: Float32Array, y: Float32Array, r: Float32Array, c: Uint16Array, ox: Float32Array, oy: Float32Array, oc: Uint16Array, k: number) => {
      if (!g) return;
      for (let m = 0; m < M; m++) {
        const h1 = hash01(m, salt, 10 + k);
        const h2 = hash01(m, salt, 20 + k);
        c[m] = oc[m];
        if (g.kind === 1 && g.g) {
          const a = h1 * TAU;
          const rr = Math.sqrt(h2);
          x[m] = g.g.x + Math.cos(a) * rr * g.g.rx;
          y[m] = g.g.y + Math.sin(a) * rr * g.g.ry;
          r[m] = 0.75;
        } else if (g.kind === 2 && g.pts.length) {
          const p = g.pts[Math.floor(hash01(m, salt, 30 + k) * g.pts.length)];
          const a = h1 * TAU;
          x[m] = p.x + Math.cos(a) * g.d * h2;
          y[m] = p.y + Math.sin(a) * g.d * h2;
          r[m] = 0.9;
        } else {
          const a = h1 * TAU;
          const dist = g.d * (0.3 + 0.7 * h2);
          x[m] = ox[m] + Math.cos(a) * dist * 1.3;
          y[m] = oy[m] + Math.sin(a) * dist * 0.7 + g.d * 0.15;
          r[m] = 0.6;
        }
      }
    };
    fill(ga, this.ax, this.ay, this.ar, this.ac, this.bx, this.by, this.bc, 0);
    fill(gb, this.bx, this.by, this.br, this.bc, this.ax, this.ay, this.ac, 1);
    if (!this.layer) this.layer = acquireLayer();
    this.ready = true;
    this.update(this.p);
    return true;
  }

  /**
   * Drive a side's DOM opacity. Several morphs may share an element (e.g. a
   * contact's arrival and its exit): a morph at rest for that element
   * (fully visible) leaves it alone unless it was the last one to write it.
   */
  private setDt(side: Side, v: number, last: number) {
    if (!isText(side)) return last;
    const q = Math.round(v * 1000) / 1000;
    for (const el of side.text) {
      const w = writers.get(el);
      if (w && w.by === this && w.q === q) continue;
      if (q >= 1 && w?.by !== this) continue;
      const s = el.style;
      if (q >= 1) {
        s.removeProperty("--dt");
        writers.delete(el);
      } else {
        s.setProperty("--dt", q.toFixed(3));
        writers.set(el, { by: this, q });
      }
      if (q < 0.5) s.pointerEvents = "none";
      else s.removeProperty("pointer-events");
      if (side.hide && q <= 0) s.visibility = "hidden";
      else s.removeProperty("visibility");
    }
    return q;
  }

  /** Progress 0..1 (0: source at rest, 1: target at rest). */
  update(p: number) {
    if (!this.alive) return;
    this.p = p;
    const { from, to } = this.o;
    this.dtA = this.setDt(from, 1 - smooth(norm(p, 0, OUT_END)), this.dtA);
    this.dtB = this.setDt(to, smooth(norm(p, IN_START, 1)), this.dtB);
    if (!this.layer) return;
    if (!this.ready || p <= 0 || p >= 1) {
      this.layer.paint(null);
      return;
    }
    const tA = isText(from);
    const tB = isText(to);
    const alpha =
      (tA ? smooth(norm(p, 0, 0.05)) : smooth(norm(p, 0, 0.15))) *
      (tB ? 1 - smooth(norm(p, DOT_OUT, 1)) : 1 - smooth(norm(p, 0.8, 1)));
    const shift = this.anchorXY();
    const sx = shift.x;
    const sy = shift.y;
    this.layer.paint((ctx, W, H) => {
      const P = new DotPaths(W, H);
      const { ax, ay, ar, ac, bx, by, br, bc, dly, bend, amp } = this;
      for (let m = 0; m < this.M; m++) {
        const ra = ar[m];
        const rb = br[m];
        if (ra <= 0 && rb <= 0) continue;
        const dl = dly[m];
        const u = norm(p, FLY0 + dl * STAG, FLY0 + dl * STAG + FLY);
        const e = easeIO(u);
        const r = (ra + (rb - ra) * e) * (1 - 0.35 * Math.sin(Math.PI * e));
        const [x, y] = flight(sx + ax[m], sy + ay[m], sx + bx[m], sy + by[m], e, bend[m], p, DRIFT * amp[m]);
        P.add(e < 0.5 ? ac[m] : bc[m], x, y, r);
      }
      P.fill(ctx, this.pal, alpha);
    });
  }

  /** Stop drawing and hand the text back to plain CSS (no inline styles). */
  release() {
    if (!this.alive) return;
    this.alive = false;
    this.buildId++;
    this.layer?.release();
    this.layer = null;
    for (const s of [this.o.from, this.o.to]) if (isText(s)) s.text.forEach(disown);
  }

  destroy() {
    this.release();
  }
}

/** Drive `fn(p)` from 0 to 1 over `ms` on the frame clock; returns cancel. */
export function play(ms: number, fn: (p: number) => void, done?: () => void) {
  let raf = 0;
  const t0 = performance.now();
  const frame = (now: number) => {
    const p = clamp((now - t0) / Math.max(1, ms));
    fn(p);
    if (p < 1) raf = requestAnimationFrame(frame);
    else done?.();
  };
  fn(0);
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
