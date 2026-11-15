/**
 * Particle "year sculpture" for the Explore journey.
 *
 * Each year label is rendered large in Fira Sans italic to an offscreen
 * canvas and sampled on a fine grid; every sample is a dot target. One fixed
 * set of particles builds the first year from loose positions and then morphs
 * between years. Particles a year doesn't need settle into a dotted ribbon
 * orbit around it. Black dots, a few red/cyan accent dots and sparse glyphs:
 * the same visual language as the halftone portrait.
 *
 * Drawing only happens when a value changes (scroll scrub or the time-based
 * build); at rest nothing runs.
 */

import type { HandoffSource } from "./handoff";

export type YearSpec = {
  /** main text, e.g. "2018" */
  text: string;
  /** optional red arrow + trailing text, e.g. ["24"] renders text → 24 */
  after?: string;
  weight?: number;
};

type Target = { x: number; y: number; r: number; accent: boolean };

type Options = {
  years: YearSpec[];
  /** particle count */
  count: number;
  /** fraction of particles a year should use (rest orbit) */
  fill?: number;
  /** text box as a fraction of the canvas */
  boxW?: number;
  boxH?: number;
  /** smoothing time constant in ms for chasing scroll values */
  tau?: number;
  glyphs?: string;
  orbit?: boolean;
  onFrame?: (b: number, t: number) => void;
};

const RED = "#e2402b";
const CYAN = "#20a7b8";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const backOut = (p: number, s = 1.5) => {
  const q = p - 1;
  return 1 + (s + 1) * q * q * q + s * q * q;
};
const smooth01 = (v: number) => {
  const c = clamp01(v);
  return c * c * (3 - 2 * c);
};
const inOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

export class YearField {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private o: Required<Omit<Options, "onFrame">> & Pick<Options, "onFrame">;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private family = "sans-serif";
  private ready = false;
  private destroyed = false;
  private raf = 0;
  private last = 0;
  private visible = true;
  private io: IntersectionObserver | null = null;
  private ro: ResizeObserver | null = null;
  private resizeTimer = 0;

  // per particle (fixed)
  private N: number;
  private lx: Float32Array; // loose position as fraction of W/H
  private ly: Float32Array;
  private delay: Float32Array;
  private delay2: Float32Array;
  private curl: Float32Array;
  private kind: Uint8Array; // 0 ink, 1 red, 2 cyan, 3 glyph
  private glyph: string[];
  private size: Float32Array;
  // per year targets, indexed [year][particle]
  private tx: Float32Array[] = [];
  private ty: Float32Array[] = [];
  private tr: Float32Array[] = [];
  private tacc: Uint8Array[] = [];
  // state
  private bT = 0;
  private tT = 0;
  private b = 0;
  private t = 0;
  private drawnB = -1;
  private drawnT = -1;
  // face → year hand-off (arrival portrait dots become the first year)
  private hand: HandoffSource | null = null;
  private overlay: HTMLCanvasElement | null = null;
  private onHand: ((b: number, active: boolean) => void) | null = null;
  private hMap: Uint32Array | null = null; // particle → source dot
  private hDel: Float32Array | null = null;
  private cMap: Uint32Array | null = null; // copy dot → particle (its target)
  private cDel: Float32Array | null = null;
  private hKey = "";
  private hActive = false;
  private gen = 0;

  constructor(canvas: HTMLCanvasElement, opts: Options) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    this.canvas = canvas;
    this.ctx = ctx;
    this.o = {
      fill: 0.8,
      boxW: 0.84,
      boxH: 0.5,
      tau: 140,
      glyphs: "AqKz74%#?jmHaeftr0x3+:sWk8&b",
      orbit: true,
      ...opts,
    };
    const N = (this.N = opts.count);
    this.lx = new Float32Array(N);
    this.ly = new Float32Array(N);
    this.delay = new Float32Array(N);
    this.delay2 = new Float32Array(N);
    this.curl = new Float32Array(N);
    this.kind = new Uint8Array(N);
    this.size = new Float32Array(N);
    this.glyph = new Array(N);
    const r = rng(2018);
    for (let i = 0; i < N; i++) {
      const a = r() * Math.PI * 2;
      // half scattered across the stage, half drifting in from outside it
      const d = r() < 0.5 ? 0.15 + r() * 0.5 : 0.7 + r() * 0.6;
      this.lx[i] = 0.5 + Math.cos(a) * d;
      this.ly[i] = 0.5 + Math.sin(a) * d * 0.9;
      this.delay[i] = r();
      this.delay2[i] = r();
      this.curl[i] = (r() - 0.5) * 2;
      const k = r();
      this.kind[i] = k < 0.012 ? 1 : k < 0.019 ? 2 : k < 0.028 ? 3 : 0;
      this.glyph[i] = this.o.glyphs[Math.floor(r() * this.o.glyphs.length)];
      this.size[i] = 0.85 + r() * 0.3;
    }
  }

  async start() {
    const fam = getComputedStyle(this.canvas).fontFamily;
    if (fam) this.family = fam;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts) {
      const weights = new Set(this.o.years.map((y) => y.weight ?? 600));
      await Promise.race([
        Promise.all([...weights].map((w) => fonts.load(`italic ${w} 100px ${this.family}`))).catch(
          () => undefined,
        ),
        new Promise((r) => setTimeout(r, 1200)),
      ]);
    }
    if (this.destroyed) return;
    this.build();
    this.ro = new ResizeObserver(() => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => {
        const W = Math.round(this.canvas.clientWidth);
        const H = Math.round(this.canvas.clientHeight);
        if (W !== this.W || H !== this.H) this.build();
      }, 120);
    });
    this.ro.observe(this.canvas);
    this.io = new IntersectionObserver((e) => {
      this.visible = e.some((x) => x.isIntersecting);
      if (this.visible) this.kick();
    });
    this.io.observe(this.canvas);
  }

  /** b: build progress 0..1, t: chapter position 0..years-1 */
  set(b: number, t: number, immediate = false) {
    this.bT = clamp01(b);
    this.tT = Math.max(0, Math.min(this.o.years.length - 1, t));
    if (immediate) {
      this.b = this.bT;
      this.t = this.tT;
    }
    this.kick();
  }

  /**
   * While 0 < b < 1 the build is drawn on `overlay` (fixed, viewport-sized):
   * the source's face dots and copy dots travel to the first year's targets.
   * `onState(b, active)` lets the caller hide the DOM portrait / copy.
   */
  setHandoff(
    src: HandoffSource | null,
    overlay: HTMLCanvasElement | null,
    onState: ((b: number, active: boolean) => void) | null,
  ) {
    this.hand = src && overlay ? src : null;
    this.overlay = overlay;
    this.onHand = onState;
    this.hKey = "";
    this.drawnB = -1;
    this.kick();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.resizeTimer);
    this.io?.disconnect();
    this.ro?.disconnect();
    this.canvas.width = this.canvas.height = 0;
  }

  /* ------------------------------------------------------------ sampling */

  private build() {
    const W = Math.round(this.canvas.clientWidth);
    const H = Math.round(this.canvas.clientHeight);
    if (W < 8 || H < 8) return;
    this.W = W;
    this.H = H;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(W * this.dpr);
    this.canvas.height = Math.round(H * this.dpr);

    const N = this.N;
    // particle order keys (fixed): priority for taking part, 2D rank keys
    const r = rng(77);
    const pri = new Float32Array(N);
    const ku = new Float32Array(N);
    const kv = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pri[i] = r();
      ku[i] = r();
      kv[i] = r();
    }
    const byPri = [...Array(N).keys()].sort((a, b) => pri[a] - pri[b]);

    this.tx = [];
    this.ty = [];
    this.tr = [];
    this.tacc = [];
    for (const spec of this.o.years) {
      const { pts, box, step } = this.sample(spec, W, H);
      const M = Math.min(pts.length, N);
      const tx = new Float32Array(N);
      const ty = new Float32Array(N);
      const tr = new Float32Array(N);
      const ta = new Uint8Array(N);
      // subsample evenly if there are more targets than particles
      let use = pts;
      if (pts.length > N) {
        const rr = rng(5);
        use = pts
          .map((p) => ({ p, k: rr() }))
          .sort((a, b) => a.k - b.k)
          .slice(0, N)
          .map((x) => x.p);
      }
      // 2D strip assignment: similar relative positions across years
      const part = byPri.slice(0, M);
      const strips = Math.max(1, Math.round(Math.sqrt(M) * 0.6));
      const tSorted = [...use].sort((a, b) => a.x - b.x);
      const pSorted = [...part].sort((a, b) => ku[a] - ku[b]);
      for (let s = 0; s < strips; s++) {
        const a = Math.floor((s * M) / strips);
        const z = Math.floor(((s + 1) * M) / strips);
        const ts = tSorted.slice(a, z).sort((p, q) => p.y - q.y);
        const ps = pSorted.slice(a, z).sort((p, q) => kv[p] - kv[q]);
        for (let j = 0; j < ts.length; j++) {
          const i = ps[j];
          tx[i] = ts[j].x;
          ty[i] = ts[j].y;
          tr[i] = ts[j].r;
          ta[i] = ts[j].accent ? 1 : 0;
        }
      }
      // surplus: a dotted ribbon orbit (several strands) around the year
      const rest = byPri.slice(M).sort((a, b) => ku[a] - ku[b]);
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      const rx = Math.min(W * 0.49, box.w * 0.62 + step * 6);
      const ry = Math.min(H * 0.47, Math.max(box.h * 0.95, rx * 0.5) + step * 6);
      const strands = 4;
      const per = Math.ceil(rest.length / strands) || 1;
      const tilt = -0.2;
      const ct = Math.cos(tilt);
      const stt = Math.sin(tilt);
      rest.forEach((i, j) => {
        const sIdx = j % strands;
        const k = Math.floor(j / strands);
        const th = (k / per) * Math.PI * 2 + sIdx * 0.05;
        // ribbon twists: strand spacing breathes around the loop
        const off = (sIdx - (strands - 1) / 2) * step * (0.9 + 0.6 * Math.sin(th * 2 + 1));
        let ex = Math.cos(th) * (rx + off);
        let ey = Math.sin(th) * (ry + off * 0.8);
        const x = ex * ct - ey * stt;
        const y = ex * stt + ey * ct;
        ex = cx + x;
        ey = cy + y;
        if (this.o.orbit) {
          tx[i] = ex;
          ty[i] = ey;
          tr[i] = step * 0.22;
        } else {
          // no orbit: surplus rests on the loose position, hidden
          tx[i] = this.lx[i] * W;
          ty[i] = this.ly[i] * H;
          tr[i] = 0;
        }
        ta[i] = 2; // 2 = orbit
      });
      this.tx.push(tx);
      this.ty.push(ty);
      this.tr.push(tr);
      this.tacc.push(ta);
    }
    this.ready = true;
    this.gen++;
    this.drawnB = this.drawnT = -1;
    this.kick();
  }

  private sample(spec: YearSpec, W: number, H: number) {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    const weight = spec.weight ?? 600;
    const font = (s: number) => `italic ${weight} ${s}px ${this.family}`;
    // fit
    let size = 100;
    g.font = font(size);
    const gap = spec.after ? 0.18 : 0;
    const arrowW = spec.after ? 0.62 : 0;
    const measure = () => {
      g.font = font(size);
      const a = g.measureText(spec.text).width;
      const z = spec.after ? g.measureText(spec.after).width : 0;
      return { a, z, total: a + z + (spec.after ? size * (arrowW + gap * 2) : 0) };
    };
    let m = measure();
    const capH = 0.72; // cap height of digits ≈ 0.72em
    size = Math.min((W * this.o.boxW) / m.total * 100, (H * this.o.boxH) / capH);
    m = measure();
    const textH = size * capH;
    const x0 = (W - m.total) / 2;
    const base = (H + textH) / 2;
    g.fillStyle = "#000";
    g.textBaseline = "alphabetic";
    g.fillText(spec.text, x0, base);
    let arrow: { x: number; y: number; w: number } | null = null;
    if (spec.after) {
      const ax = x0 + m.a + size * gap;
      arrow = { x: ax, y: base - textH * 0.45, w: size * arrowW };
      g.fillText(spec.after, ax + arrow.w + size * gap, base);
    }
    const ink = g.getImageData(0, 0, W, H).data;
    // arrow on its own layer so its dots read as the red accent
    let acc: Uint8ClampedArray | null = null;
    if (arrow) {
      g.clearRect(0, 0, W, H);
      g.strokeStyle = "#000";
      g.lineCap = "round";
      g.lineJoin = "round";
      g.lineWidth = size * 0.085;
      g.beginPath();
      g.moveTo(arrow.x, arrow.y);
      g.lineTo(arrow.x + arrow.w, arrow.y);
      g.moveTo(arrow.x + arrow.w - size * 0.2, arrow.y - size * 0.17);
      g.lineTo(arrow.x + arrow.w, arrow.y);
      g.lineTo(arrow.x + arrow.w - size * 0.2, arrow.y + size * 0.17);
      g.stroke();
      acc = g.getImageData(0, 0, W, H).data;
    }
    const alphaAt = (d: Uint8ClampedArray, x: number, y: number) => {
      const xi = x | 0;
      const yi = y | 0;
      if (xi < 0 || yi < 0 || xi >= W || yi >= H) return 0;
      return d[(yi * W + xi) * 4 + 3] / 255;
    };
    // ink area → grid step so the count lands near fill * N
    let area = 0;
    for (let i = 3; i < ink.length; i += 4) if (ink[i] > 128 || (acc && acc[i] > 128)) area++;
    const want = this.N * this.o.fill;
    const step = Math.max(3.2, Math.sqrt(area / want));
    const pts: Target[] = [];
    const sub = [0.2, 0.5, 0.8];
    const rj = rng(spec.text.length * 131 + (spec.after ? 7 : 0));
    let row = 0;
    for (let y = step / 2; y < H; y += step * 0.866, row++) {
      for (let x = step / 2 + (row % 2) * step * 0.5; x < W; x += step) {
        let cov = 0;
        let cova = 0;
        for (const sy of sub)
          for (const sx of sub) {
            const px = x + (sx - 0.5) * step;
            const py = y + (sy - 0.5) * step;
            cov += alphaAt(ink, px, py);
            if (acc) cova += alphaAt(acc, px, py);
          }
        cov /= 9;
        cova /= 9;
        const c2 = Math.max(cov, cova);
        if (c2 < 0.18) continue;
        pts.push({
          x: x + (rj() - 0.5) * step * 0.18,
          y: y + (rj() - 0.5) * step * 0.18,
          r: step * (0.2 + 0.24 * Math.sqrt(c2)),
          accent: cova > cov,
        });
      }
    }
    const box = { x: x0, y: base - textH, w: m.total, h: textH };
    return { pts, box, step };
  }

  /* ------------------------------------------------------------ loop */

  private kick() {
    if (!this.ready || this.destroyed || this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.raf = 0;
    if (this.destroyed || !this.ready) return;
    const dt = Math.max(0, Math.min(64, now - this.last));
    this.last = now;
    const k = 1 - Math.exp(-dt / this.o.tau);
    this.b += (this.bT - this.b) * k;
    this.t += (this.tT - this.t) * k;
    if (Math.abs(this.bT - this.b) < 0.0008) this.b = this.bT;
    if (Math.abs(this.tT - this.t) < 0.0008) this.t = this.tT;
    const handing = !!this.hand && this.b > 0 && this.b < 1;
    if ((this.visible || handing || this.hActive) && (this.b !== this.drawnB || this.t !== this.drawnT))
      this.draw();
    if (this.hand) this.onHand?.(this.b, this.hActive);
    this.o.onFrame?.(this.b, this.t);
    if (this.b !== this.bT || this.t !== this.tT) this.raf = requestAnimationFrame(this.tick);
  };

  private draw() {
    this.drawnB = this.b;
    this.drawnT = this.t;
    const { ctx, W, H, N } = this;
    const dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const handing = !!this.hand && this.b > 0 && this.b < 1 && this.t < 0.5;
    if (handing) {
      this.drawHandoff();
      return;
    }
    if (this.hActive) this.endHandoff();
    const b = this.b;
    const t = this.t;
    const last = this.o.years.length - 1;
    const k0 = Math.max(0, Math.min(last, Math.floor(t)));
    const k1 = Math.min(last, k0 + 1);
    const f = clamp01(t - k0);
    const ax = this.tx[k0];
    const ay = this.ty[k0];
    const ar = this.tr[k0];
    const aa = this.tacc[k0];
    const bx = this.tx[k1];
    const by = this.ty[k1];
    const br = this.tr[k1];
    const ba = this.tacc[k1];
    const ink = getComputedStyle(this.canvas).color || "#121212";
    const paths = [new Path2D(), new Path2D(), new Path2D()];
    const glyphs: [number, number, number, string, number][] = [];
    const diag = Math.hypot(W, H);
    for (let i = 0; i < N; i++) {
      // morph between neighbouring years
      const p2 = clamp01((f - this.delay2[i] * 0.35) / 0.65);
      const e2 = inOut(p2);
      let x = ax[i] + (bx[i] - ax[i]) * e2;
      let y = ay[i] + (by[i] - ay[i]) * e2;
      let r = ar[i] + (br[i] - ar[i]) * e2;
      const acc = e2 < 0.5 ? aa[i] : ba[i];
      if (e2 > 0 && e2 < 1) {
        const dx = bx[i] - ax[i];
        const dy = by[i] - ay[i];
        const s = Math.sin(Math.PI * e2) * this.curl[i] * 0.22;
        x += -dy * s;
        y += dx * s;
      }
      // build from the loose positions
      let alpha = 1;
      if (b < 1) {
        const p = clamp01((b - this.delay[i] * 0.45) / 0.55);
        const e = backOut(p, 1.35);
        const lx = this.lx[i] * W;
        const ly = this.ly[i] * H;
        const dx = x - lx;
        const dy = y - ly;
        const s = Math.sin(Math.PI * Math.min(1, p)) * this.curl[i] * 0.18;
        x = lx + dx * e - dy * s;
        y = ly + dy * e + dx * s;
        const dist = Math.hypot(dx, dy) / diag;
        r = r * (0.55 + 0.45 * Math.min(1, e)) + (1 - p) * 0.4 * dist;
        alpha = 0.25 + 0.75 * p;
        if (b <= 0) alpha *= 0.6;
      }
      if (r <= 0.05 || alpha <= 0.02) continue;
      let kind = this.kind[i];
      if (acc === 1) kind = 1;
      if (kind === 3) {
        // glyphs live in the orbit and the loose cloud; inside a year they read as dots
        if (acc === 2 || alpha < 1) {
          glyphs.push([x, y, r, this.glyph[i], alpha]);
          continue;
        }
        kind = 0;
      }
      const rr = r * this.size[i];
      const path = paths[kind];
      path.moveTo(x + rr, y);
      path.arc(x, y, rr, 0, Math.PI * 2);
    }
    const fade = b < 1 ? 0.35 + 0.65 * b : 1;
    ctx.globalAlpha = fade;
    ctx.fillStyle = ink;
    ctx.fill(paths[0]);
    ctx.fillStyle = RED;
    ctx.fill(paths[1]);
    ctx.fillStyle = CYAN;
    ctx.fill(paths[2]);
    if (glyphs.length) {
      ctx.fillStyle = ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const [x, y, r, ch, a] of glyphs) {
        ctx.globalAlpha = fade * a;
        ctx.font = `italic 500 ${Math.max(9, r * 7)}px ${this.family}`;
        ctx.fillText(ch, x, y);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------ hand-off */

  private endHandoff() {
    this.hActive = false;
    const o = this.overlay;
    if (o) {
      o.style.display = "none";
      o.width = o.height = 0;
    }
  }

  /** particle ↔ source pairing: strips by x, then y, so the face's left feeds the year's left */
  private assignHandoff(h: HandoffSource) {
    const N = this.N;
    const tx = this.tx[0];
    const ty = this.ty[0];
    const n = h.x.length;
    const pIdx = [...Array(N).keys()].sort((p, q) => tx[p] - tx[q]);
    const sIdx = [...Array(N).keys()].map((i) => i % n).sort((p, q) => h.x[p] - h.x[q]);
    const map = new Uint32Array(N);
    const strips = Math.max(1, Math.round(Math.sqrt(N) * 0.5));
    for (let s = 0; s < strips; s++) {
      const a = Math.floor((s * N) / strips);
      const z = Math.floor(((s + 1) * N) / strips);
      const ps = pIdx.slice(a, z).sort((p, q) => ty[p] - ty[q]);
      const ss = sIdx.slice(a, z).sort((p, q) => h.y[p] - h.y[q]);
      for (let j = 0; j < ps.length; j++) map[ps[j]] = ss[j];
    }
    // the side of the face nearest the stage (left) peels off first
    const r = rng(9);
    const del = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const u = (h.x[map[i]] - h.box.x) / (h.box.w || 1);
      const v = (h.y[map[i]] - h.box.y) / (h.box.h || 1);
      del[i] = clamp01(0.45 * u + 0.15 * (1 - v) + 0.4 * r());
    }
    const C = h.cx.length;
    const cMap = new Uint32Array(C);
    const cDel = new Float32Array(C);
    for (let c = 0; c < C; c++) {
      cMap[c] = Math.floor(r() * N);
      cDel[c] = r();
    }
    this.hMap = map;
    this.hDel = del;
    this.cMap = cMap;
    this.cDel = cDel;
  }

  private drawHandoff() {
    const h = this.hand!;
    const o = this.overlay!;
    const key = `${this.gen}:${h.x.length}:${h.cx.length}`;
    if (key !== this.hKey || !this.hMap) {
      this.assignHandoff(h);
      this.hKey = key;
    }
    const map = this.hMap!;
    const del = this.hDel!;
    const cMap = this.cMap!;
    const cDel = this.cDel!;
    if (!this.hActive) {
      this.hActive = true;
      o.style.display = "block";
    }
    const VW = Math.max(1, o.clientWidth);
    const VH = Math.max(1, o.clientHeight);
    const dpr = this.dpr;
    const bw = Math.round(VW * dpr);
    const bh = Math.round(VH * dpr);
    if (o.width !== bw || o.height !== bh) {
      o.width = bw;
      o.height = bh;
    }
    const c = o.getContext("2d");
    if (!c) return;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, bw, bh);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const b = this.b;
    const ar = h.ref.getBoundingClientRect();
    const cr = this.canvas.getBoundingClientRect();
    const sxo = ar.left;
    const syo = ar.top;
    const txo = cr.left;
    const tyo = cr.top;

    // the face that stays behind fades as its dots leave
    const restA = 1 - smooth01(b / 0.32);
    if (restA > 0.003) {
      c.globalAlpha = restA;
      c.drawImage(h.rest, sxo + h.box.x, syo + h.box.y, h.box.w, h.box.h);
      c.globalAlpha = 1;
    }

    const tx = this.tx[0];
    const ty = this.ty[0];
    const tr = this.tr[0];
    const ta = this.tacc[0];
    const ink = getComputedStyle(this.canvas).color || h.ink;
    // ink paths by opacity bucket, then red / cyan
    const buckets = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    const BA = [1, 0.8, 0.6, 0.4];
    const red = new Path2D();
    const cyan = new Path2D();
    const glyphs: [number, number, number, string, number][] = [];
    const add = (path: Path2D, x: number, y: number, r: number) => {
      path.moveTo(x + r, y);
      path.arc(x, y, r, 0, Math.PI * 2);
    };
    const bucket = (a: number) => (a > 0.9 ? 0 : a > 0.7 ? 1 : a > 0.5 ? 2 : 3);
    // one shared stream: every path is a cubic through two common control
    // points (plus a per-dot lane offset), so mid-flight the dots gather into
    // a ribbon that sweeps from the face down into the year
    const fcx = sxo + h.box.x + h.box.w * 0.5;
    const fcy = syo + h.box.y + h.box.h * 0.45;
    const ycx = txo + this.W * 0.5;
    const ycy = tyo + this.H * 0.5;
    const Dx = ycx - fcx;
    const Dy = ycy - fcy;
    const Dl = Math.hypot(Dx, Dy) || 1;
    const nx = Dy / Dl; // bulge to the lower right of the line, then curl in
    const ny = -Dx / Dl;
    const ax = fcx + Dx * 0.28 - nx * Dl * 0.32;
    const ay = fcy + Dy * 0.28 - ny * Dl * 0.32;
    const bx = fcx + Dx * 0.78 + nx * Dl * 0.22;
    const by = fcy + Dy * 0.78 + ny * Dl * 0.22;
    const lane = Dl * 0.09;
    const route = (x0: number, y0: number, x1: number, y1: number, e: number, l: number, o: { x: number; y: number }) => {
      const u = 1 - e;
      const w0 = u * u * u;
      const w1 = 3 * u * u * e;
      const w2 = 3 * u * e * e;
      const w3 = e * e * e;
      const lx = nx * l * lane;
      const ly = ny * l * lane;
      o.x = w0 * x0 + w1 * (ax + lx) + w2 * (bx + lx) + w3 * x1;
      o.y = w0 * y0 + w1 * (ay + ly) + w2 * (by + ly) + w3 * y1;
    };
    const P = { x: 0, y: 0 };

    for (let i = 0; i < this.N; i++) {
      const j = map[i];
      const x0 = sxo + h.x[j];
      const y0 = syo + h.y[j];
      const x1 = txo + tx[i];
      const y1 = tyo + ty[i];
      const p = clamp01((b - del[i] * 0.42) / 0.58);
      const e = backOut(p, 1.25);
      route(x0, y0, x1, y1, e, this.curl[i], P);
      const x = P.x;
      const y = P.y;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const rt = tr[i] * this.size[i];
      const ce = clamp01(e);
      let r = h.r[j] + (rt - h.r[j]) * ce + Math.sin(Math.PI * p) * 0.6;
      if (rt <= 0.05 && p >= 1) continue;
      if (r < 0.2) r = 0.2;
      const a = h.a[j] + (1 - h.a[j]) * p;
      if (p <= 0.04) {
        add(buckets[bucket(a)], x, y, r);
        continue;
      }
      let kind = this.kind[i];
      if (ta[i] === 1 && p > 0.6) kind = 1;
      // leading dots carry the red/cyan fringe while they fly
      if (p < 0.92 && del[i] < 0.3) {
        const f = Math.max(1, r * 0.6);
        const l = Math.hypot(dx, dy) || 1;
        add(red, x - (dx / l) * f, y - (dy / l) * f, r * 0.85);
        add(cyan, x + (dx / l) * f, y + (dy / l) * f, r * 0.85);
      }
      if (kind === 3 && p > 0.12 && (p < 0.9 || ta[i] === 2)) {
        glyphs.push([x, y, r, this.glyph[i], a]);
        continue;
      }
      if (kind === 1 && p > 0.3) add(red, x, y, r);
      else if (kind === 2 && p > 0.3) add(cyan, x, y, r);
      else add(buckets[bucket(a)], x, y, r);
    }

    // the copy's letters drift into the same stream and dissolve into it
    const show = smooth01(b / 0.05);
    const copyBuckets = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    for (let q = 0; q < h.cx.length; q++) {
      const p = clamp01((b * 1.2 - cDel[q] * 0.4) / 0.6);
      const a = show * (1 - smooth01((p - 0.62) / 0.38));
      if (a < 0.03) continue;
      const i = cMap[q];
      const x0 = sxo + h.cx[q];
      const y0 = syo + h.cy[q];
      const x1 = txo + tx[i];
      const y1 = tyo + ty[i];
      const e = inOut(p);
      route(x0, y0, x1, y1, e, this.curl[i] * 1.4, P);
      const x = P.x;
      const y = P.y;
      const r = h.cr[q] * (1 - 0.45 * e);
      if (h.ck[q]) add(red, x, y, r);
      else add(copyBuckets[bucket(a)], x, y, r);
    }

    c.fillStyle = RED;
    c.fill(red);
    c.fillStyle = CYAN;
    c.fill(cyan);
    c.fillStyle = ink;
    for (let z = 0; z < 4; z++) {
      c.globalAlpha = BA[z];
      c.fill(buckets[z]);
      c.fill(copyBuckets[z]);
    }
    if (glyphs.length) {
      c.textAlign = "center";
      c.textBaseline = "middle";
      for (const [x, y, r, ch, a] of glyphs) {
        c.globalAlpha = a;
        c.font = `italic 500 ${Math.max(9, r * 7)}px ${this.family}`;
        c.fillText(ch, x, y);
      }
    }
    c.globalAlpha = 1;
  }
}
