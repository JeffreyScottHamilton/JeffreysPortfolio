/**
 * Chapter text built from dots (Explore journey, desktop stage).
 *
 * Every chapter's visible text block (rule, heading with its red period,
 * prose, the small note, the YouTube row) is rendered offscreen in its
 * computed fonts at its on-page position and sampled to a fine dot grid.
 * ONE persistent set of particles carries the text: when the chapter changes
 * the dots travel (curved paths, a little curl drift, staggered top → bottom)
 * from the old chapter's glyphs to the new chapter's glyphs. Surplus dots
 * shrink into a neighbour as they land; missing ones grow out of one as they
 * leave. The crisp DOM text then cross-fades in over its dots (exact
 * registration). The arrival copy is sampled the same way, and its dots
 * become the first chapter's text during the face → year hand-off.
 *
 * Everything is a pure function of the scrubbed (b, t) the year morph uses,
 * so it is reversible. Nothing is drawn at rest. The real text stays in the
 * DOM; only its opacity is driven (see `chapterAlpha`).
 */
import { hash01 } from "@/lib/halftone";

export type DotSet = {
  x: Float32Array;
  y: Float32Array;
  r: Float32Array;
  /** 1 = accent (red) dot */
  red: Uint8Array;
};

const SS = 3; // supersampling per cell side
const MIN_PITCH = 2.25;
const MAX_DOTS = 9000;
/* timing inside one chapter change (f = 0..1) */
const OUT_END = 0.1; // old DOM text gone
const FLY = 0.56; // share of the change one dot spends flying
const FLY0 = 0.05; // first dots leave
const STAG = 0.28; // spread of departures
const IN_START = 0.88; // new DOM text starts to show
const DOT_OUT = 0.92; // dots start to fade under it
/* timing of the hand-off build (b = 0..1) */
const B_FLY0 = 0.04;
const B_STAG = 0.3;
const B_FLY = 0.52;
const B_IN = 0.86;
const B_DOT_OUT = 0.9;
const DRIFT = 7;

const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const norm = (x: number, a: number, b: number) => clamp((x - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Opacity of chapter k's DOM text for build b and chapter position t. */
export function chapterAlpha(k: number, b: number, t: number, last: number) {
  const k0 = Math.max(0, Math.min(last, Math.floor(t)));
  const f = k0 >= last ? 0 : t - k0;
  let a = 0;
  if (k === k0) a = 1 - smooth(norm(f, 0, OUT_END));
  else if (k === k0 + 1) a = smooth(norm(f, IN_START, 1));
  if (k === 0) a = Math.min(a, smooth(norm(b, B_IN, 1)));
  return a;
}

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

/* ------------------------------------------------------------ sampling */

async function svgImage(svg: SVGSVGElement, w: number, h: number) {
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
    const s = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`;
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

/**
 * Sample text blocks (and their small rules / inline icons) to dots, in px
 * relative to `origin`. Each block gets a pitch from its font size.
 */
export async function sampleBlocks(blocks: HTMLElement[], origin: DOMRect): Promise<DotSet> {
  const xs: number[] = [];
  const ys: number[] = [];
  const rs: number[] = [];
  const reds: number[] = [];
  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { x: new Float32Array(0), y: new Float32Array(0), r: new Float32Array(0), red: new Uint8Array(0) };
  const range = document.createRange();
  for (const el of blocks) {
    const er = el.getBoundingClientRect();
    if (er.width <= 0 || er.height <= 0) continue;
    const ecs = getComputedStyle(el);
    const size = parseFloat(ecs.fontSize) || 16;
    const P = Math.max(MIN_PITCH, size / 21);
    const pad = 4;
    const ox = er.left - pad * P;
    const oy = er.top - pad * P;
    const cols = Math.ceil(er.width / P) + 2 * pad;
    const rows = Math.ceil(er.height / P) + 2 * pad;
    cv.width = cols * SS;
    cv.height = rows * SS;
    const f = SS / P;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(f, 0, 0, f, -ox * f, -oy * f);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";

    // small solid rules (accent bars)
    for (const r of [el, ...el.querySelectorAll<HTMLElement>("*")]) {
      if (r.closest(".sr-only") || r instanceof SVGElement) continue;
      const cs = getComputedStyle(r);
      const bg = cs.backgroundColor;
      if (!bg || bg === "transparent" || /rgba\([^)]*,\s*0\)$/.test(bg)) continue;
      const rr = r.getBoundingClientRect();
      if (Math.min(rr.width, rr.height) > 8 || rr.width <= 0 || rr.height <= 0) continue;
      ctx.fillStyle = bg;
      ctx.fillRect(rr.left, rr.top, rr.width, rr.height);
    }
    // icons
    for (const s of el.querySelectorAll<SVGSVGElement>("svg")) {
      const sr = s.getBoundingClientRect();
      if (sr.width <= 0 || sr.height <= 0) continue;
      const img = await svgImage(s, sr.width, sr.height);
      if (img) ctx.drawImage(img, sr.left, sr.top, sr.width, sr.height);
    }
    // glyphs, one by one at their exact on-page positions
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const cache = new Map<Element, { font: string; color: string; desc: number; upper: boolean } | null>();
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      const parent = node.parentElement;
      if (!parent) continue;
      let st = cache.get(parent);
      if (st === undefined) {
        const cs = getComputedStyle(parent);
        if (parent.closest(".sr-only") || cs.visibility === "hidden" || cs.display === "none") st = null;
        else {
          const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
          ctx.font = font;
          st = {
            font,
            color: cs.color,
            desc: ctx.measureText("Hg").fontBoundingBoxDescent || 0,
            upper: cs.textTransform === "uppercase",
          };
        }
        cache.set(parent, st);
      }
      if (!st) continue;
      ctx.font = st.font;
      ctx.fillStyle = st.color;
      const text = node.data;
      for (let i = 0; i < text.length; ) {
        const cp = text.codePointAt(i) ?? 32;
        const len = cp > 0xffff ? 2 : 1;
        const raw = text.slice(i, i + len);
        if (raw.trim()) {
          range.setStart(node, i);
          range.setEnd(node, i + len);
          const rects = range.getClientRects();
          const r = rects.length ? rects[0] : null;
          if (r && r.width > 0) ctx.fillText(st.upper ? raw.toUpperCase() : raw, r.left, r.bottom - st.desc);
        }
        i += len;
      }
    }
    let d: Uint8ClampedArray;
    try {
      d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    } catch {
      continue;
    }
    const cw = cv.width;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        let al = 0;
        let R = 0;
        let G = 0;
        let B = 0;
        for (let v = 0; v < SS; v++) {
          let o = ((j * SS + v) * cw + i * SS) * 4;
          for (let u = 0; u < SS; u++, o += 4) {
            const a = d[o + 3];
            al += a;
            R += d[o] * a;
            G += d[o + 1] * a;
            B += d[o + 2] * a;
          }
        }
        const cov = al / (255 * SS * SS);
        if (cov < 0.08) continue;
        R /= al;
        G /= al;
        B /= al;
        const lum = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255;
        const red = R - G > 70;
        if (!red && lum > 0.6) continue; // knock-outs (icon play triangle)
        xs.push(ox + (i + 0.5) * P - origin.left);
        ys.push(oy + (j + 0.5) * P - origin.top);
        rs.push(Math.min(0.56 * P, 0.6 * P * Math.sqrt(cov)));
        reds.push(red ? 1 : 0);
      }
  }
  range.detach?.();
  cv.width = cv.height = 0;
  return { x: Float32Array.from(xs), y: Float32Array.from(ys), r: Float32Array.from(rs), red: Uint8Array.from(reds) };
}

/* ------------------------------------------------------------ the field */

/** A chapter's N slots: real targets (r > 0) plus duplicates (r = 0), in rank order. */
type Slots = { x: Float32Array; y: Float32Array; r: Float32Array; red: Uint8Array };

/** Rank order: horizontal bands top → bottom, left → right inside a band. */
function rankOrder(x: ArrayLike<number>, y: ArrayLike<number>, n: number, bands: number) {
  const byY = [...Array(n).keys()].sort((a, b) => y[a] - y[b]);
  const out: number[] = [];
  for (let s = 0; s < bands; s++) {
    const a = Math.floor((s * n) / bands);
    const z = Math.floor(((s + 1) * n) / bands);
    out.push(...byY.slice(a, z).sort((p, q) => x[p] - x[q]));
  }
  return out;
}

function toSlots(D: DotSet, N: number, seed: number): Slots {
  const n = D.x.length;
  // keep at most N real targets (even subsample)
  let keep = [...Array(n).keys()];
  if (n > N) keep = keep.filter((_, i) => hash01(i, seed, 7) < N / n).slice(0, N);
  const m = keep.length;
  const x = new Float32Array(N);
  const y = new Float32Array(N);
  const r = new Float32Array(N);
  const red = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const real = i < m;
    const src = real ? keep[i] : keep[Math.floor(hash01(i, seed, 9) * m)];
    x[i] = D.x[src];
    // duplicates sit on their twin (tiny offset keeps the rank stable)
    y[i] = D.y[src] + (real ? 0 : 0.001);
    r[i] = real ? D.r[src] : 0;
    red[i] = D.red[src];
  }
  const order = rankOrder(x, y, N, 36);
  const s: Slots = {
    x: new Float32Array(N),
    y: new Float32Array(N),
    r: new Float32Array(N),
    red: new Uint8Array(N),
  };
  order.forEach((o, j) => {
    s.x[j] = x[o];
    s.y[j] = y[o];
    s.r[j] = r[o];
    s.red[j] = red[o];
  });
  return s;
}

/** the hand-off: arrival copy dots → chapter 0 slots (M movers) */
type Build = {
  M: number;
  sx: Float32Array; // arrival-local
  sy: Float32Array;
  sr: Float32Array;
  sred: Uint8Array;
  p: Uint32Array; // chapter 0 slot
  pr: Float32Array; // radius at the slot (0 = merges)
};

export class ChapterDots {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private box: HTMLElement;
  private chapters: HTMLElement[];
  private last: number;
  private N = 0;
  private slots: Slots[] = [];
  private bend = new Float32Array(0);
  private amp = new Float32Array(0);
  private dly = new Float32Array(0);
  private src: DotSet | null = null;
  private srcEl: HTMLElement | null = null;
  private build: Build | null = null;
  private buildId = 0;
  private visible = false;
  private destroyed = false;
  private ink = "#121212";
  private red = "#e2402b";
  ready = false;

  constructor(canvas: HTMLCanvasElement, box: HTMLElement, chapters: HTMLElement[]) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.box = box;
    this.chapters = chapters;
    this.last = chapters.length - 1;
  }

  private static blocks(ch: HTMLElement) {
    return [...ch.children].filter(
      (e): e is HTMLElement => e instanceof HTMLElement && !e.classList.contains("sr-only"),
    );
  }

  /** Sample every chapter (call when fonts are ready and on resize). */
  async measure() {
    const id = ++this.buildId;
    if (!this.ctx) return false;
    try {
      await document.fonts?.ready;
    } catch {
      /* draw with whatever is loaded */
    }
    if (id !== this.buildId || this.destroyed) return false;
    const origin = this.box.getBoundingClientRect();
    const sets: DotSet[] = [];
    for (const ch of this.chapters) sets.push(await sampleBlocks(ChapterDots.blocks(ch), origin));
    if (id !== this.buildId || this.destroyed) return false;
    const N = Math.min(MAX_DOTS, Math.max(1, ...sets.map((s) => s.x.length)));
    this.N = N;
    this.slots = sets.map((s, k) => toSlots(s, N, k + 1));
    this.bend = new Float32Array(N);
    this.amp = new Float32Array(N);
    this.dly = new Float32Array(N);
    for (let j = 0; j < N; j++) {
      const h = hash01(j, 3, 1);
      this.bend[j] = (0.1 + 0.22 * h) * (hash01(j, 3, 2) < 0.5 ? -1 : 1);
      this.amp[j] = 0.5 + hash01(j, 3, 3);
      this.dly[j] = 0.6 * (j / N) + 0.4 * hash01(j, 3, 4);
    }
    const cs = getComputedStyle(this.box);
    this.ink = cs.getPropertyValue("--ink").trim() || cs.color || this.ink;
    this.red = cs.getPropertyValue("--accent").trim() || this.red;
    this.ready = N > 1;
    this.makeBuild();
    return this.ready;
  }

  /** Sample the arrival copy: its dots become chapter 0 during the hand-off. */
  async setSource(arrival: HTMLElement | null) {
    if (!arrival) {
      this.src = null;
      this.srcEl = null;
      this.makeBuild();
      return;
    }
    const blocks = [
      ...arrival.querySelectorAll<HTMLElement>(
        ".x-arrival-title-vis, .x-arrival-support .rule-accent, .x-arrival-who, .x-arrival-lead, .x-start",
      ),
    ];
    // sample at rest even while the hand-off hides the copy (opacity only)
    const set = await sampleBlocks(blocks, arrival.getBoundingClientRect());
    if (this.destroyed) return;
    this.src = set.x.length ? set : null;
    this.srcEl = this.src ? arrival : null;
    this.makeBuild();
  }

  private makeBuild() {
    const S = this.src;
    const T = this.slots[0];
    if (!S || !T || !this.ready) {
      this.build = null;
      return;
    }
    const N = this.N;
    const C = S.x.length;
    const order = rankOrder(S.x, S.y, C, 36);
    const M = Math.max(N, C);
    const b: Build = {
      M,
      sx: new Float32Array(M),
      sy: new Float32Array(M),
      sr: new Float32Array(M),
      sred: new Uint8Array(M),
      p: new Uint32Array(M),
      pr: new Float32Array(M),
    };
    let prevS = -1;
    let prevP = -1;
    for (let m = 0; m < M; m++) {
      const s = order[Math.floor((m * C) / M)];
      const p = Math.floor((m * N) / M);
      b.sx[m] = S.x[s];
      b.sy[m] = S.y[s];
      b.sr[m] = s === prevS ? 0 : S.r[s];
      b.sred[m] = S.red[s];
      b.p[m] = p;
      b.pr[m] = p === prevP ? 0 : T.r[p];
      prevS = s;
      prevP = p;
    }
    this.build = b;
  }

  private size() {
    const c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = innerWidth;
    const H = innerHeight;
    const bw = Math.round(W * dpr);
    const bh = Math.round(H * dpr);
    if (c.width !== bw || c.height !== bh) {
      c.width = bw;
      c.height = bh;
    }
    return { W, H, dpr };
  }

  private hide() {
    if (!this.visible) return;
    this.visible = false;
    const c = this.canvas;
    c.style.display = "none";
    c.width = c.height = 0;
  }

  /** Draw for build b and chapter position t (the year morph's values). */
  update(b: number, t: number) {
    if (this.destroyed || !this.ready || !this.ctx) return;
    const last = this.last;
    const k0 = Math.max(0, Math.min(last, Math.floor(t)));
    const f = k0 >= last ? 0 : t - k0;
    const building = b < 1 && k0 === 0 && f < 0.5;
    const moving = !building && f > 0 && f < 1;
    if (!(building ? b > 0 : moving)) {
      this.hide();
      return;
    }
    const br = this.box.getBoundingClientRect();
    if (!building && (br.bottom < 0 || br.top > innerHeight)) {
      this.hide();
      return;
    }
    const { W, H, dpr } = this.size();
    const ctx = this.ctx;
    if (!this.visible) {
      this.visible = true;
      this.canvas.style.display = "block";
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ink = new Path2D();
    const red = new Path2D();
    const TAU = Math.PI * 2;
    const add = (path: Path2D, x: number, y: number, r: number) => {
      if (r < 0.15 || x < -8 || y < -8 || x > W + 8 || y > H + 8) return;
      path.moveTo(x + r, y);
      path.arc(x, y, r, 0, TAU);
    };
    let alpha = 1;
    const T = this.slots[0];

    if (building) {
      const B = this.build;
      alpha = 1 - smooth(norm(b, B_DOT_OUT, 1));
      if (B && this.srcEl) {
        const ar = this.srcEl.getBoundingClientRect();
        for (let m = 0; m < B.M; m++) {
          const p = B.p[m];
          const dl = this.dly[p];
          const u = norm(b, B_FLY0 + dl * B_STAG, B_FLY0 + dl * B_STAG + B_FLY);
          const e = easeIO(u);
          const x0 = ar.left + B.sx[m];
          const y0 = ar.top + B.sy[m];
          const x1 = br.left + T.x[p];
          const y1 = br.top + T.y[p];
          const r = (B.sr[m] + (B.pr[m] - B.sr[m]) * e) * (1 - 0.4 * Math.sin(Math.PI * e));
          if (r < 0.15) continue;
          const [x, y] = this.path(x0, y0, x1, y1, e, p, b, 0.45);
          add((e < 0.5 ? B.sred[m] : T.red[p]) ? red : ink, x, y, r);
        }
      } else {
        // no source yet: gather in from a loose scatter around the text
        for (let p = 0; p < this.N; p++) {
          const tr = T.r[p];
          if (tr <= 0) continue;
          const dl = this.dly[p];
          const u = norm(b, B_FLY0 + dl * B_STAG, B_FLY0 + dl * B_STAG + B_FLY);
          if (u <= 0) continue;
          const e = easeIO(u);
          const ang = hash01(p, 5, 1) * TAU;
          const dist = 40 + 140 * hash01(p, 5, 2);
          const x1 = br.left + T.x[p];
          const y1 = br.top + T.y[p];
          const x0 = x1 + Math.cos(ang) * dist * 1.3;
          const y0 = y1 + Math.sin(ang) * dist * 0.7 + 30;
          const [x, y] = this.path(x0, y0, x1, y1, e, p, b, 1);
          add(T.red[p] ? red : ink, x, y, tr * Math.min(1, u / 0.15));
        }
      }
    } else {
      const A = this.slots[k0];
      const Bs = this.slots[k0 + 1];
      alpha = smooth(norm(f, 0, 0.05)) * (1 - smooth(norm(f, DOT_OUT, 1)));
      for (let j = 0; j < this.N; j++) {
        const ra = A.r[j];
        const rb = Bs.r[j];
        if (ra <= 0 && rb <= 0) continue;
        const dl = this.dly[j];
        const u = norm(f, FLY0 + dl * STAG, FLY0 + dl * STAG + FLY);
        const e = easeIO(u);
        const x0 = br.left + A.x[j];
        const y0 = br.top + A.y[j];
        const x1 = br.left + Bs.x[j];
        const y1 = br.top + Bs.y[j];
        const r = (ra + (rb - ra) * e) * (1 - 0.35 * Math.sin(Math.PI * e));
        const [x, y] = u > 0 && u < 1 ? this.path(x0, y0, x1, y1, e, j, f, 1) : u <= 0 ? [x0, y0] : [x1, y1];
        add((e < 0.5 ? A.red[j] : Bs.red[j]) ? red : ink, x, y, r);
      }
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.ink;
    ctx.fill(ink);
    ctx.fillStyle = this.red;
    ctx.fill(red);
    ctx.globalAlpha = 1;
  }

  /** curved path with a curl drift that peaks mid-flight */
  private path(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    e: number,
    j: number,
    time: number,
    bendScale: number,
  ): [number, number] {
    if (e <= 0) return [x0, y0];
    if (e >= 1) return [x1, y1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const bd = this.bend[j] * bendScale;
    const cx = x0 + dx * 0.5 - dy * bd;
    const cy = y0 + dy * 0.5 + dx * bd;
    const m = 1 - e;
    let x = m * m * x0 + 2 * m * e * cx + e * e * x1;
    let y = m * m * y0 + 2 * m * e * cy + e * e * y1;
    const mo = Math.sin(Math.PI * e);
    const [qx, qy] = curl(x, y, time);
    x += qx * DRIFT * mo * this.amp[j];
    y += qy * DRIFT * mo * this.amp[j];
    return [x, y];
  }

  destroy() {
    this.destroyed = true;
    this.buildId++;
    this.hide();
  }
}
