/**
 * "Text from dots": board text (titles with their red period, one-liners,
 * indices, the heading) materialises out of dots instead of fading in.
 *
 * Each text leaf is rendered offscreen glyph by glyph, in its computed font
 * and colour, at the exact on-page position of every character (DOM Range
 * rects), then sampled onto a dot grid (pitch ≈2.25 px). In its progress
 * window the leaf's dots fly in from a source (a card's halftone, or
 * scattered nearby) along a gentle curve with a curl-noise drift, grow and
 * settle into the glyph shapes, then cross-fade into the real DOM text
 * (`--td` on the leaf, 0..1, see styles/work.css). A pure function of the
 * scrubbed progress p (reversible; nothing drawn when no leaf is mid-way).
 *
 * The real text stays in the DOM (only its opacity is driven), so screen
 * readers and getByText are unaffected.
 */
import { hash01 } from "@/lib/halftone";

type Rect = { x: number; y: number; w: number; h: number };

export type TDGroup = {
  /** text leaves, materialised left → right / in order with a small stagger */
  leaves: HTMLElement[];
  /** progress window of the group */
  from: number;
  to: number;
  /** where the dots come from (stage px); null = scattered nearby */
  src: Rect | null;
};

type Leaf = {
  el: HTMLElement;
  group: number;
  a: number;
  b: number;
  n: number;
  tx: Float32Array;
  ty: Float32Array;
  sx: Float32Array;
  sy: Float32Array;
  r: Float32Array;
  bend: Float32Array;
  dly: Float32Array;
  colors: string[];
  ranges: [number, number][];
  td: number; // last written --td (-1 = none)
};

const PITCH = 2.25;
const SS = 3; // supersampling per cell side
const FLY = 0.5; // share of a leaf's window one dot spends flying
const XF = 0.8; // cross-fade starts here (all dots settled)
const DRIFT = 6; // px, peak curl drift

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const norm = (x: number, a: number, b: number) => clamp((x - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Curl of a few sine waves (same flavour as the morph's ink flow). */
function curl(x: number, y: number, t: number): [number, number] {
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

export class TextDots {
  private stage: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private leaves: Leaf[] = [];
  private all: HTMLElement[] = [];
  private buildId = 0;
  private view: [number, number, number] = [0, 0, 1];
  private drawn = -1;
  private destroyed = false;
  /** dots built and ready (the board text is then driven by --td) */
  ready = false;

  constructor(stage: HTMLElement) {
    this.stage = stage;
    const c = document.createElement("canvas");
    c.className = "wk-morph wk-morph-text";
    c.setAttribute("aria-hidden", "true");
    this.canvas = c;
    this.ctx = c.getContext("2d");
    stage.append(c);
  }

  private clearLeaves() {
    for (const el of this.all) {
      el.style.removeProperty("--td");
      delete el.dataset.td;
    }
    this.all = [];
    this.leaves = [];
    this.ready = false;
    this.stage.classList.remove("has-td");
  }

  /**
   * Measure the leaves at rest and build the dots (once fonts are ready).
   * `atRest` clears the board's inline transforms right before sampling;
   * the caller re-applies its state when the promise resolves.
   */
  async measure(groups: TDGroup[], atRest: () => void): Promise<boolean> {
    const id = ++this.buildId;
    this.clearLeaves();
    this.drawn = -1;
    this.canvas.style.visibility = "hidden";
    if (this.destroyed || !this.ctx) return false;
    try {
      await document.fonts?.ready;
    } catch {
      /* draw with whatever is loaded */
    }
    if (id !== this.buildId || this.destroyed) return false;
    const VW = innerWidth;
    const VH = innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.view = [VW, VH, dpr];
    this.canvas.width = Math.round(VW * dpr);
    this.canvas.height = Math.round(VH * dpr);
    this.canvas.style.width = `${VW}px`;
    this.canvas.style.height = `${VH}px`;
    atRest();
    const sr = this.stage.getBoundingClientRect();
    const off = document.createElement("canvas");
    const octx = off.getContext("2d", { willReadFrequently: true });
    if (!octx) return false;
    const leaves: Leaf[] = [];
    let salt = 0;
    groups.forEach((g, gi) => {
      const n = g.leaves.length;
      const s = n > 1 ? (g.to - g.from) * 0.08 : 0;
      g.leaves.forEach((el, k) => {
        const leaf = this.sample(el, octx, off, sr, g.src, ++salt);
        if (!leaf) return;
        leaf.group = gi;
        leaf.a = g.from + s * k;
        leaf.b = g.to - s * (n - 1 - k);
        leaves.push(leaf);
      });
    });
    off.width = off.height = 0;
    if (id !== this.buildId || this.destroyed) return false;
    this.leaves = leaves;
    this.all = leaves.map((l) => l.el);
    for (const el of this.all) el.dataset.td = "";
    this.ready = leaves.length > 0;
    if (this.ready) this.stage.classList.add("has-td");
    return this.ready;
  }

  /** Render one leaf's glyphs offscreen and sample them to dots. */
  private sample(
    el: HTMLElement,
    ctx: CanvasRenderingContext2D,
    cv: HTMLCanvasElement,
    sr: DOMRect,
    src: Rect | null,
    salt: number,
  ): Leaf | null {
    const er = el.getBoundingClientRect();
    if (er.width <= 0 || er.height <= 0) return null;
    const P = PITCH;
    const pad = 2;
    // the lattice, in viewport px
    const ox = er.left - pad * P;
    const oy = er.top - pad * P;
    const cols = Math.ceil(er.width / P) + 2 * pad;
    const rows = Math.ceil(er.height / P) + 2 * pad;
    cv.width = cols * SS;
    cv.height = rows * SS;
    const f = SS / P;
    const clip = getComputedStyle(el).overflowX !== "visible";

    // characters grouped by colour
    type Ch = { ch: string; x: number; bottom: number; font: string };
    const byColor = new Map<string, Ch[]>();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    const csCache = new Map<Element, CSSStyleDeclaration>();
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      const parent = node.parentElement;
      if (!parent) continue;
      let cs = csCache.get(parent);
      if (!cs) {
        cs = getComputedStyle(parent);
        csCache.set(parent, cs);
      }
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const upper = cs.textTransform === "uppercase";
      const text = node.data;
      let list = byColor.get(cs.color);
      if (!list) {
        list = [];
        byColor.set(cs.color, list);
      }
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
            list.push({ ch: upper ? raw.toUpperCase() : raw, x: r.left, bottom: r.bottom, font });
        }
        i += len;
      }
    }
    range.detach?.();

    const tx: number[] = [];
    const ty: number[] = [];
    const rad: number[] = [];
    const colors: string[] = [];
    const ranges: [number, number][] = [];
    for (const [color, chars] of byColor) {
      if (!chars.length) continue;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.setTransform(f, 0, 0, f, -ox * f, -oy * f);
      ctx.save();
      if (clip) {
        ctx.beginPath();
        ctx.rect(er.left, oy, er.width, rows * P);
        ctx.clip();
      }
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      let font = "";
      let desc = 0;
      for (const c of chars) {
        if (c.font !== font) {
          font = c.font;
          ctx.font = font;
          desc = ctx.measureText("Hg").fontBoundingBoxDescent || 0;
        }
        ctx.fillText(c.ch, c.x, c.bottom - desc);
      }
      ctx.restore();
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      const start = tx.length;
      const cw = cv.width;
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          let al = 0;
          for (let v = 0; v < SS; v++) {
            let o = ((j * SS + v) * cw + i * SS) * 4 + 3;
            for (let u = 0; u < SS; u++, o += 4) al += d[o];
          }
          const cov = al / (255 * SS * SS);
          if (cov < 0.06) continue;
          tx.push(ox + (i + 0.5) * P - sr.left);
          ty.push(oy + (j + 0.5) * P - sr.top);
          rad.push(Math.min(0.6 * P, 0.62 * P * Math.sqrt(cov)));
        }
      if (tx.length > start) {
        colors.push(color);
        ranges.push([start, tx.length]);
      }
    }
    const n = tx.length;
    if (!n) return null;

    const L: Leaf = {
      el,
      group: 0,
      a: 0,
      b: 1,
      n,
      tx: Float32Array.from(tx),
      ty: Float32Array.from(ty),
      sx: new Float32Array(n),
      sy: new Float32Array(n),
      r: Float32Array.from(rad),
      bend: new Float32Array(n),
      dly: new Float32Array(n),
      colors,
      ranges,
      td: -1,
    };
    const x0 = er.left - sr.left;
    for (let k = 0; k < n; k++) {
      const h1 = hash01(k, salt, 41);
      const h2 = hash01(k, salt, 42);
      if (src) {
        // peel off the card's halftone (its lower part, nearest the caption)
        L.sx[k] = src.x + src.w * h1;
        L.sy[k] = src.y + src.h * (0.35 + 0.65 * h2);
      } else {
        const ang = h1 * Math.PI * 2;
        const dist = 40 + 120 * h2;
        L.sx[k] = L.tx[k] + Math.cos(ang) * dist * 1.4;
        L.sy[k] = L.ty[k] + Math.sin(ang) * dist * 0.7 + 24;
      }
      L.bend[k] = (0.12 + 0.2 * hash01(k, salt, 43)) * (hash01(k, salt, 44) < 0.5 ? -1 : 1);
      const xf = clamp((L.tx[k] - x0) / Math.max(1, er.width));
      L.dly[k] = (1 - FLY - (1 - XF)) * (0.6 * xf + 0.4 * hash01(k, salt, 45));
    }
    return L;
  }

  /**
   * Draw for progress p. `dy[group]` shifts a group (it moves with the
   * featured cards). `off` = text not driven (rest state / done): no --td,
   * nothing drawn.
   */
  update(p: number, dy: number[] | null) {
    if (this.destroyed || !this.ready) return;
    const off = dy === null;
    let any = false;
    for (const L of this.leaves) {
      const t = off ? 1 : norm(p, L.a, L.b);
      const td = off ? -1 : smooth(norm(t, XF, 1));
      if (td !== L.td) {
        L.td = td;
        if (td < 0) L.el.style.removeProperty("--td");
        else L.el.style.setProperty("--td", td.toFixed(3));
      }
      if (!off && t > 0 && t < 1) any = true;
    }
    const key = off || !any ? -2 : p;
    if (key === this.drawn) return;
    this.drawn = key;
    const ctx = this.ctx!;
    const [VW, VH, dpr] = this.view;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (off || !any) {
      this.canvas.style.visibility = "hidden";
      return;
    }
    this.canvas.style.visibility = "visible";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const TAU = Math.PI * 2;
    for (const L of this.leaves) {
      const t = norm(p, L.a, L.b);
      if (t <= 0 || t >= 1) continue;
      const shift = dy![L.group] ?? 0;
      ctx.globalAlpha = 1 - smooth(norm(t, XF, 1));
      for (let c = 0; c < L.colors.length; c++) {
        const [s, e] = L.ranges[c];
        ctx.fillStyle = L.colors[c];
        ctx.beginPath();
        for (let k = s; k < e; k++) {
          const u = norm(t, L.dly[k], L.dly[k] + FLY);
          if (u <= 0) continue;
          const ee = easeIO(u);
          const tx = L.tx[k];
          const ty = L.ty[k] + shift;
          const dx = tx - L.sx[k];
          const dyy = ty - L.sy[k];
          const cx = L.sx[k] + dx * 0.5 - dyy * L.bend[k];
          const cy = L.sy[k] + dyy * 0.5 + dx * L.bend[k];
          const m = 1 - ee;
          let x = m * m * L.sx[k] + 2 * m * ee * cx + ee * ee * tx;
          let y = m * m * L.sy[k] + 2 * m * ee * cy + ee * ee * ty;
          const mo = Math.sin(Math.PI * ee);
          if (mo > 0.001) {
            const [qx, qy] = curl(x, y, t);
            x += qx * DRIFT * mo;
            y += qy * DRIFT * mo;
          }
          const r = (0.55 + (L.r[k] - 0.55) * smooth(norm(ee, 0.45, 1))) * Math.min(1, u / 0.12);
          if (r < 0.05 || x < -4 || y < -4 || x > VW + 4 || y > VH + 4) continue;
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, TAU);
        }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  destroy() {
    this.destroyed = true;
    this.buildId++;
    this.clearLeaves();
    this.canvas.width = this.canvas.height = 0;
    this.canvas.remove();
  }
}
