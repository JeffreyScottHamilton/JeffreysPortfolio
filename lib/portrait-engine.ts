/**
 * Canvas engine for <Portrait/>. Owns all per-frame work (no React state).
 *
 * Static layers are pre-rendered once per size/tone. The pointer reveal is a
 * real fluid: pointer strokes inject velocity + dye into a coarse stable-fluids
 * solver (lib/fluid.ts). Each frame the dye is upsampled bilinearly and
 * thresholded into an organic mask; the registered colour photo (same
 * drawSource mapping as the dots) shows through it, dots inside fade out and
 * dots near the flow are displaced by the local velocity (capped). Dye
 * dissipates over ~2 s so the portrait heals; velocity keeps the mask swirling
 * as it fades. When the fluid has no energy left the cached static layer is
 * drawn untransformed (pixel-exact rest frame) and the rAF loop stops.
 */
import { Fluid } from "./fluid";
import {
  buildHalftone,
  buildHalo,
  computeLayout,
  drawField,
  drawSource,
  fieldCoverage,
  glyphFont,
  hash01,
  loadCutout,
  palette,
  type Field,
  type Framing,
  type Layout,
  type Palette,
  type Tone,
} from "./halftone";

export type EngineOptions = {
  variant: "halftone" | "cutout";
  tone: Tone;
  framing: Framing;
  interactive: boolean;
  reducedMotion: boolean;
  glyphs: string;
};

const ASSEMBLE_MS = 900;
const MASK_RES = 2; // CSS px per reveal-mask cell
const FLUID_LONG = 128; // solver cells on the long side
/** dye -> mask smooth threshold (thin soft band) */
const T0 = 0.4;
const T1 = 0.5;
/** hairline fringe bands either side of the threshold (dye units) */
const FR_OUT: [number, number, number] = [0.3, 0.37, 0.42];
const FR_IN: [number, number, number] = [0.48, 0.53, 0.6];
const FRINGE_ALPHA = 0.55;
/** velocity (CSS px/s) -> dot displacement: seconds of travel, soft-capped */
const DISP_T = 0.03;
const DISP_CAP = 4.5;
const DISP_EPS = 0.2; // px; below this a dot counts as at rest
const MAX_FORCE = 240; // cells/s
const ALPHA_STEPS = 12;
/* aura: loose dots + letters outside the silhouette drift and twinkle on their own */
const AURA_MAX = 1000;
const AURA_FRAME_MS = 31; // ~30 fps
const AURA_RAMP_S = 1.6;
const AURA_PUSH = 1.1; // fluid velocity -> aura offset (s of travel)
const AURA_PUSH_TAU = 0.8; // s
const AURA_PUSH_CAP = 28; // px
const AURA_STEPS = 10;

type Aura = {
  n: number;
  x0: Float32Array;
  y0: Float32Array;
  r: Float32Array;
  a: Float32Array;
  /** glyph index, -1 = dot, -2 = floating letter (index into letters via `li`) */
  g: Int16Array;
  li: Int16Array;
  tx: Float32Array;
  ty: Float32Array;
  amp: Float32Array;
  w1: Float32Array;
  ph1: Float32Array;
  ph2: Float32Array;
  w2: Float32Array;
  ph3: Float32Array;
  ox: Float32Array;
  oy: Float32Array;
};

const sm = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
/** smooth bump: 0 at a, 1 at b, 0 at c */
const bump = (a: number, b: number, c: number, x: number) => (x <= a || x >= c ? 0 : x < b ? sm(a, b, x) : 1 - sm(b, c, x));
/** drawField's opacity buckets for round dots (so live dots match the static layer) */
const dotBucket = (op: number) => (op > 0.9 ? 1 : op > 0.7 ? 0.8 : op > 0.5 ? 0.6 : 0.4);

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

function hexRGB(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export class PortraitEngine {
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private opts: EngineOptions;
  private img: HTMLImageElement | null = null;
  private family = "sans-serif";
  private pal: Palette;

  private W = 0;
  private H = 0;
  private dpr = 1;
  private L: Layout | null = null;
  private F: Field | null = null;
  private staticLayer: HTMLCanvasElement | null = null;
  /** dots without the floating letters (letters are drawn live while animating) */
  private baseLayer: HTMLCanvasElement | null = null;
  private photoLayer: HTMLCanvasElement | null = null;
  private reveal: HTMLCanvasElement | null = null;
  private mask: HTMLCanvasElement | null = null;
  private maskData: ImageData | null = null;
  private fringe: HTMLCanvasElement | null = null;
  private fringeData: ImageData | null = null;
  private maskCols = 0;
  private maskRows = 0;
  private dirty: [number, number, number, number] | null = null; // mask dirty rect (cells)

  // fluid
  private fluid: Fluid | null = null;
  private hot: Uint8Array | null = null;
  private R = 32; // splat radius (CSS px)

  // aura
  private auraCanvas: HTMLCanvasElement | null = null;
  private actx: CanvasRenderingContext2D | null = null;
  private aura: Aura | null = null;
  private isAura: Uint8Array | null = null;
  private auraRaf = 0;
  private auraLast = 0;
  private auraT0 = 0;

  // pointer
  private px = 0;
  private py = 0;
  private lastMoveT = 0;
  private inside = false;

  // assemble
  private assembleT0: number | null = null;
  private asm: { sx: Float32Array; sy: Float32Array; delay: Float32Array } | null = null;

  private raf = 0;
  private lastFrame = 0;
  private visible = true;
  private destroyed = false;
  private ready = false;
  private io: IntersectionObserver | null = null;
  private ro: ResizeObserver | null = null;
  private resizeTimer = 0;
  private cleanup: (() => void)[] = [];

  constructor(root: HTMLElement, canvas: HTMLCanvasElement, opts: EngineOptions) {
    this.root = root;
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
    this.opts = opts;
    this.pal = palette(opts.tone);
    if (opts.variant === "halftone" && opts.interactive && !opts.reducedMotion) {
      // separate layer over the cached halftone for the ambient aura
      const ac = document.createElement("canvas");
      const actx = ac.getContext("2d");
      if (actx) {
        ac.className = "portrait__canvas portrait__aura";
        ac.setAttribute("aria-hidden", "true");
        root.appendChild(ac);
        this.auraCanvas = ac;
        this.actx = actx;
      }
    }
  }

  async start() {
    const fam = getComputedStyle(this.root).fontFamily;
    if (fam) this.family = fam;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    const fontWait = fonts
      ? Promise.race([
          Promise.all([fonts.load(`italic 500 16px ${this.family}`), fonts.load(`500 16px ${this.family}`)]).catch(() => undefined),
          new Promise((r) => setTimeout(r, 900)),
        ])
      : Promise.resolve();
    const [img] = await Promise.all([loadCutout(), fontWait]);
    if (this.destroyed) return;
    this.img = img;
    this.build();
    this.observe();
    if (this.opts.interactive && this.opts.variant === "halftone" && !this.opts.reducedMotion) this.bindPointer();
  }

  /** null = render formed; number = performance.now() time when dots start flying in. */
  setAssemble(t0: number | null) {
    if (this.opts.reducedMotion || this.opts.variant !== "halftone") t0 = null;
    this.assembleT0 = t0;
    this.asm = null;
    if (t0 !== null && performance.now() > t0 + ASSEMBLE_MS) this.assembleT0 = null;
    if (this.assembleT0 !== null) this.clearAura();
    if (this.ready) {
      this.kick(true);
      this.auraKick();
    }
  }

  /**
   * Stir the fluid along a segment (element-local CSS px) with a velocity in
   * CSS px/ms. Used by the pointer handlers; public so callers/tests can drive it.
   */
  stroke(x0: number, y0: number, x1: number, y1: number, vx: number, vy: number) {
    const f = this.fluid;
    if (!f || this.opts.reducedMotion || !this.ready) return;
    const k = 1000 / f.h; // px/ms -> cells/s
    let fx = vx * k * 0.9;
    let fy = vy * k * 0.9;
    const m = Math.hypot(fx, fy);
    if (m > MAX_FORCE) {
      fx *= MAX_FORCE / m;
      fy *= MAX_FORCE / m;
    }
    const sp = Math.hypot(vx, vy);
    // faster strokes carry a slightly wider wake
    const r = this.R * (1 + Math.min(0.35, sp * 0.12));
    f.splatSegment(x0, y0, x1, y1, r * 1.25, fx, fy, 0.6, r);
    this.kick();
  }

  /** Small radial splat (touch tap): a brief reveal that blooms and heals. */
  tap(x: number, y: number) {
    const f = this.fluid;
    if (!f || this.opts.reducedMotion || !this.ready) return;
    f.splatRadial(x, y, this.R * 0.95, 70, 0.95);
    this.kick();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.auraRaf);
    clearTimeout(this.resizeTimer);
    this.io?.disconnect();
    this.ro?.disconnect();
    this.cleanup.forEach((f) => f());
    for (const c of [this.staticLayer, this.baseLayer, this.photoLayer, this.reveal, this.mask, this.fringe]) if (c) c.width = c.height = 0;
    this.staticLayer = this.baseLayer = this.photoLayer = this.reveal = this.mask = this.fringe = null;
    this.maskData = this.fringeData = null;
    if (this.auraCanvas) {
      this.auraCanvas.width = this.auraCanvas.height = 0;
      this.auraCanvas.remove();
    }
    this.auraCanvas = null;
    this.actx = null;
    this.aura = null;
    this.isAura = null;
    this.fluid = null;
    this.hot = null;
    this.F = null;
  }

  /* ------------------------------------------------------------ build */

  private build() {
    const img = this.img;
    if (!img || this.destroyed) return;
    const W = Math.round(this.root.clientWidth);
    const H = Math.round(this.root.clientHeight);
    if (W < 4 || H < 4) return;
    this.W = W;
    this.H = H;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const dpr = this.dpr;
    const bw = Math.round(W * dpr);
    const bh = Math.round(H * dpr);
    this.canvas.width = bw;
    this.canvas.height = bh;
    const L = computeLayout(W, H, this.opts.framing);
    this.L = L;
    const bopts = { tone: this.opts.tone, framing: this.opts.framing, glyphs: this.opts.glyphs };

    const st = this.staticLayer && this.staticLayer.width === bw && this.staticLayer.height === bh ? this.staticLayer : makeCanvas(bw, bh);
    const sctx = st.getContext("2d")!;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, bw, bh);
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.imageSmoothingQuality = "high";

    if (this.opts.variant === "cutout") {
      this.F = buildHalo(img, L, bopts);
      drawSource(sctx, img, L);
      drawField(sctx, this.F, this.pal.ink, this.family, true, false);
    } else {
      this.F = buildHalftone(img, L, bopts);
      this.aura = null;
      this.isAura = null;
      if (this.actx && this.auraCanvas) {
        // loose dots + letters outside the silhouette move to the aura layer;
        // the cached layer keeps everything else (still, pixel-exact at rest)
        this.buildAura(img, L);
        const F = this.F;
        const isA = this.isAura!;
        const inner: Field = { ...F, live: F.live.filter((q) => !isA[q]), letters: [] };
        drawField(sctx, inner, this.pal.ink, this.family, false);
        this.auraCanvas.width = bw;
        this.auraCanvas.height = bh;
        this.auraT0 = performance.now() / 1000;
        this.auraLast = 0;
      } else drawField(sctx, this.F, this.pal.ink, this.family, true, true);
      if (this.opts.interactive && !this.opts.reducedMotion) {
        const fit = (cv: HTMLCanvasElement | null, w: number, h: number) => (cv && cv.width === w && cv.height === h ? cv : makeCanvas(w, h));
        const ph = fit(this.photoLayer, bw, bh);
        const pctx = ph.getContext("2d")!;
        pctx.setTransform(1, 0, 0, 1, 0, 0);
        pctx.clearRect(0, 0, bw, bh);
        pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        pctx.imageSmoothingQuality = "high";
        drawSource(pctx, img, L); // identical mapping to the dot sampling
        this.photoLayer = ph;
        this.reveal = fit(this.reveal, bw, bh);
        this.maskCols = Math.ceil(W / MASK_RES);
        this.maskRows = Math.ceil(H / MASK_RES);
        this.mask = makeCanvas(this.maskCols, this.maskRows);
        this.maskData = new ImageData(this.maskCols, this.maskRows);
        this.fringe = makeCanvas(this.maskCols, this.maskRows);
        this.fringeData = new ImageData(this.maskCols, this.maskRows);
        this.dirty = null;
        // splat radius ~5% of the portrait width (clamped for tiny / huge boxes)
        this.R = Math.max(14, Math.min(56, Math.min(W, L.dw) * 0.05));
        this.fluid = new Fluid(W, H, FLUID_LONG);
        this.hot = new Uint8Array(this.fluid.nx * this.fluid.ny);
        if (this.aura) this.baseLayer = st; // letters already live on the aura layer
        else {
          // dots w/o letters (letters are drawn live while the fluid moves)
          const base = fit(this.baseLayer === st ? null : this.baseLayer, bw, bh);
          const bctx = base.getContext("2d")!;
          bctx.setTransform(1, 0, 0, 1, 0, 0);
          bctx.clearRect(0, 0, bw, bh);
          bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          drawField(bctx, this.F, this.pal.ink, this.family, false);
          this.baseLayer = base;
        }
      }
    }
    this.staticLayer = st;
    this.asm = null;
    this.ready = true;
    this.kick(true);
    this.auraKick();
    this.root.dataset.ready = "1";
  }

  private observe() {
    this.ro = new ResizeObserver(() => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => {
        const W = Math.round(this.root.clientWidth);
        const H = Math.round(this.root.clientHeight);
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        if (W !== this.W || H !== this.H || dpr !== this.dpr) this.build();
      }, 120);
    });
    this.ro.observe(this.root);
    this.io = new IntersectionObserver((ents) => {
      this.visible = ents.some((e) => e.isIntersecting);
      if (this.visible) {
        this.kick();
        this.auraKick();
      }
    });
    this.io.observe(this.root);
    const onVis = () => {
      if (!document.hidden) {
        this.kick();
        this.auraKick();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    this.cleanup.push(() => document.removeEventListener("visibilitychange", onVis));
  }

  /* ------------------------------------------------------------ pointer */

  private bindPointer() {
    const el = this.root;
    const touchOnly = window.matchMedia("(hover: none)").matches;
    const local = (e: PointerEvent) => {
      const b = el.getBoundingClientRect();
      return [e.clientX - b.left, e.clientY - b.top] as const;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch" || touchOnly) return;
      const [x, y] = local(e);
      const now = performance.now();
      if (!this.inside || now - this.lastMoveT > 250) {
        // (re)entering: start a stroke here, nothing to smear yet
        this.inside = true;
        this.px = x;
        this.py = y;
        this.lastMoveT = now;
        return;
      }
      const dt = Math.max(8, now - this.lastMoveT);
      const dx = x - this.px;
      const dy = y - this.py;
      if (dx * dx + dy * dy < 0.25) return;
      this.stroke(this.px, this.py, x, y, dx / dt, dy / dt);
      this.px = x;
      this.py = y;
      this.lastMoveT = now;
    };
    const leave = () => {
      this.inside = false;
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch" && !touchOnly) return;
      const [x, y] = local(e);
      this.tap(x, y);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointercancel", leave);
    el.addEventListener("pointerdown", down);
    this.cleanup.push(() => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointercancel", leave);
      el.removeEventListener("pointerdown", down);
    });
  }

  /* ------------------------------------------------------------ frames */

  private kick(force = false) {
    if (this.destroyed || !this.ready) return;
    if (this.raf) return;
    if (!force && (!this.visible || document.hidden)) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.raf = 0;
    if (this.destroyed || !this.ready) return;
    const dt = this.lastFrame ? Math.min(33, now - this.lastFrame) : 16;
    this.lastFrame = now;
    let more = false;
    if (this.assembleT0 !== null) {
      more = this.drawAssemble(now);
      if (!more) {
        this.assembleT0 = null;
        this.asm = null;
        this.auraT0 = now / 1000;
        this.auraLast = 0;
        this.auraKick();
        more = this.drawLive(dt);
      }
    } else {
      more = this.drawLive(dt);
    }
    if (more && this.visible && !document.hidden) this.raf = requestAnimationFrame(this.frame);
    else this.lastFrame = 0;
  };

  private clearMain() {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Fly-in of the dots during the intro. Returns true while still running. */
  private drawAssemble(now: number) {
    const F = this.F!;
    const L = this.L!;
    const t0 = this.assembleT0!;
    const c = this.ctx;
    this.clearMain();
    if (now < t0) return true;
    if (!this.asm) {
      const n = F.live.length;
      const sx = new Float32Array(n);
      const sy = new Float32Array(n);
      const delay = new Float32Array(n);
      let seed = 1337;
      const rnd = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      const maxD = Math.hypot(L.W, L.H);
      for (let q = 0; q < n; q++) {
        const p = F.live[q];
        const dx = F.x[p] - L.headX;
        const dy = F.y[p] - L.headY;
        const d = Math.hypot(dx, dy) || 1;
        const ang = Math.atan2(dy, dx) + (rnd() - 0.5) * 1.6;
        const dist = 50 + rnd() * 320;
        sx[q] = F.x[p] + Math.cos(ang) * dist;
        sy[q] = F.y[p] + Math.sin(ang) * dist;
        delay[q] = (d / maxD) * 260 + rnd() * 120;
      }
      this.asm = { sx, sy, delay };
    }
    const { sx, sy, delay } = this.asm;
    const el = now - t0;
    if (el >= ASSEMBLE_MS) return false;
    const dur = ASSEMBLE_MS - 380;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = this.pal.ink;
    const buckets = [0.25, 0.5, 0.75, 1];
    const paths = buckets.map(() => new Path2D());
    for (let q = 0; q < F.live.length; q++) {
      const p = F.live[q];
      const t = Math.min(1, Math.max(0, (el - delay[q]) / dur));
      if (t <= 0) continue;
      const e = 1 - Math.pow(1 - t, 3);
      const x = sx[q] + (F.x[p] - sx[q]) * e;
      const y = sy[q] + (F.y[p] - sy[q]) * e;
      const r = (F.g[p] >= 0 ? F.pitch * 0.3 : F.r[p]) * (0.35 + 0.65 * e);
      const op = F.a[p] * Math.min(1, t * 2.2);
      const b = op > 0.8 ? 3 : op > 0.55 ? 2 : op > 0.3 ? 1 : 0;
      paths[b].moveTo(x + r, y);
      paths[b].arc(x, y, r, 0, Math.PI * 2);
    }
    paths.forEach((p, b) => {
      c.globalAlpha = buckets[b];
      c.fill(p);
    });
    c.globalAlpha = 1;
    return true;
  }

  /** Steps the fluid and composites one frame. Returns true while anything moves. */
  private drawLive(dtMs: number) {
    const c = this.ctx;
    const f = this.fluid;
    const live = this.opts.variant === "halftone" && f && this.photoLayer && this.baseLayer && this.maskData && this.hot;
    if (live && f.active) f.step(dtMs / 1000);
    if (!live || !f.active) return this.drawRest();

    /* 1. which solver cells matter this frame (dots move / fade only where there is dye) */
    const nx = f.nx;
    const ny = f.ny;
    const h = f.h;
    const hot = this.hot!;
    const D = f.dye;
    hot.fill(0);
    let hx0 = nx;
    let hy0 = ny;
    let hx1 = -1;
    let hy1 = -1;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const q = j * nx + i;
        if (D[q] <= 0) continue;
        hot[q] = 1;
        if (i < hx0) hx0 = i;
        if (i > hx1) hx1 = i;
        if (j < hy0) hy0 = j;
        if (j > hy1) hy1 = j;
      }
    if (hx1 < 0) return this.drawRest(true);
    // dilate by one cell (bilinear sampling reaches into the neighbours)
    for (let j = hy0; j <= hy1; j++)
      for (let i = hx0; i <= hx1; i++) {
        const q = j * nx + i;
        if (hot[q] !== 1) continue;
        for (let b = Math.max(0, j - 1); b <= Math.min(ny - 1, j + 1); b++)
          for (let a = Math.max(0, i - 1); a <= Math.min(nx - 1, i + 1); a++) if (!hot[b * nx + a]) hot[b * nx + a] = 2;
      }
    hx0 = Math.max(0, hx0 - 1);
    hy0 = Math.max(0, hy0 - 1);
    hx1 = Math.min(nx - 1, hx1 + 1);
    hy1 = Math.min(ny - 1, hy1 + 1);

    this.clearMain();
    c.drawImage(this.baseLayer!, 0, 0);

    /* 2. mask from the dye: bilinear upsample + smooth threshold (+ hairline fringe bands) */
    const db = f.dyeBox;
    const hasDye = db[2] > db[0] && db[3] > db[1];
    let mbox: [number, number, number, number] | null = null;
    if (hasDye) mbox = this.updateMask(f, db);
    else if (this.dirty) this.clearMask();

    /* 3. cut the dots that change, draw the revealed photo, redraw those dots */
    const dpr = this.dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cut = this.collectDots(f, hx0 * h, hy0 * h, (hx1 + 1) * h, (hy1 + 1) * h);
    c.globalCompositeOperation = "destination-out";
    c.fill(cut.cut);
    c.globalCompositeOperation = "source-over";
    if (mbox) this.drawPhoto(mbox);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = this.pal.ink;
    for (let s = 1; s <= ALPHA_STEPS; s++) {
      if (!cut.paths[s]) continue;
      c.globalAlpha = s / ALPHA_STEPS;
      c.fill(cut.paths[s]!);
    }
    if (cut.glyphs.length) {
      const F = this.F!;
      c.font = glyphFont(F.pitch * F.glyphScale, this.family);
      c.textAlign = "center";
      c.textBaseline = "middle";
      for (const g of cut.glyphs) {
        c.globalAlpha = g.a;
        c.fillText(g.ch, g.x, g.y);
      }
    }
    c.globalAlpha = 1;

    /* 4. hairline red/cyan along the mask edge (no glow) */
    if (mbox) {
      const [a0, b0, a1, b1] = mbox;
      c.globalAlpha = FRINGE_ALPHA;
      c.imageSmoothingEnabled = true;
      c.drawImage(this.fringe!, a0, b0, a1 - a0, b1 - b0, a0 * MASK_RES, b0 * MASK_RES, (a1 - a0) * MASK_RES, (b1 - b0) * MASK_RES);
      c.globalAlpha = 1;
    }

    if (!this.aura) this.drawLetters(f);
    return true;
  }

  /** Rest frame: the cached layer, untransformed -> pixel-exact still image. */
  private drawRest(more = false) {
    this.clearMain();
    this.ctx.drawImage(this.staticLayer!, 0, 0);
    if (this.dirty) this.clearMask();
    return more;
  }

  /** Writes mask + fringe cells for the dye bbox. Returns the touched mask-cell rect. */
  private updateMask(f: Fluid, db: [number, number, number, number]): [number, number, number, number] {
    const h = f.h;
    const mcols = this.maskCols;
    const mrows = this.maskRows;
    const mc0 = Math.max(0, Math.floor(((db[0] - 1) * h) / MASK_RES));
    const mr0 = Math.max(0, Math.floor(((db[1] - 1) * h) / MASK_RES));
    const mc1 = Math.min(mcols, Math.ceil(((db[2] + 1) * h) / MASK_RES));
    const mr1 = Math.min(mrows, Math.ceil(((db[3] + 1) * h) / MASK_RES));
    const md = this.maskData!.data;
    const fd = this.fringeData!.data;
    if (this.dirty) {
      const [a0, b0, a1, b1] = this.dirty;
      for (let j = b0; j < b1; j++) {
        md.fill(0, (j * mcols + a0) * 4, (j * mcols + a1) * 4);
        fd.fill(0, (j * mcols + a0) * 4, (j * mcols + a1) * 4);
      }
    }
    const [rr, rg, rb] = hexRGB(this.pal.red);
    const [cr, cg, cb] = hexRGB(this.pal.cyan);
    const dye = f.dye;
    for (let j = mr0; j < mr1; j++) {
      const y = (j + 0.5) * MASK_RES;
      for (let i = mc0; i < mc1; i++) {
        const d = f.sample(dye, (i + 0.5) * MASK_RES, y);
        if (d < FR_OUT[0]) continue;
        const q = (j * mcols + i) * 4;
        const a = sm(T0, T1, d);
        if (a > 0) {
          md[q] = md[q + 1] = md[q + 2] = 255;
          md[q + 3] = a * 255;
        }
        const ro = bump(FR_OUT[0], FR_OUT[1], FR_OUT[2], d);
        if (ro > 0) {
          fd[q] = rr;
          fd[q + 1] = rg;
          fd[q + 2] = rb;
          fd[q + 3] = ro * 255;
          continue;
        }
        const ci = bump(FR_IN[0], FR_IN[1], FR_IN[2], d);
        if (ci > 0) {
          fd[q] = cr;
          fd[q + 1] = cg;
          fd[q + 2] = cb;
          fd[q + 3] = ci * 255;
        }
      }
    }
    const da = this.dirty ? Math.min(this.dirty[0], mc0) : mc0;
    const dbb = this.dirty ? Math.min(this.dirty[1], mr0) : mr0;
    const dc = this.dirty ? Math.max(this.dirty[2], mc1) : mc1;
    const dd = this.dirty ? Math.max(this.dirty[3], mr1) : mr1;
    if (dc > da && dd > dbb) {
      this.mask!.getContext("2d")!.putImageData(this.maskData!, 0, 0, da, dbb, dc - da, dd - dbb);
      this.fringe!.getContext("2d")!.putImageData(this.fringeData!, 0, 0, da, dbb, dc - da, dd - dbb);
    }
    this.dirty = [mc0, mr0, mc1, mr1];
    return [mc0, mr0, mc1, mr1];
  }

  /** Registered colour photo through the mask (same drawSource mapping as the dots). */
  private drawPhoto(mbox: [number, number, number, number]) {
    const c = this.ctx;
    const dpr = this.dpr;
    const [mc0, mr0, mc1, mr1] = mbox;
    if (mc1 <= mc0 || mr1 <= mr0) return;
    const rv = this.reveal!;
    const rctx = rv.getContext("2d")!;
    const bx = Math.max(0, Math.floor(mc0 * MASK_RES * dpr));
    const by = Math.max(0, Math.floor(mr0 * MASK_RES * dpr));
    const bw = Math.min(rv.width, Math.ceil(mc1 * MASK_RES * dpr)) - bx;
    const bh = Math.min(rv.height, Math.ceil(mr1 * MASK_RES * dpr)) - by;
    if (bw <= 0 || bh <= 0) return;
    // mask cells padded by 1 so the bilinear upscale edge is clean
    const ma0 = Math.max(0, mc0 - 1);
    const mb0 = Math.max(0, mr0 - 1);
    const mw = Math.min(this.maskCols, mc1 + 1) - ma0;
    const mh = Math.min(this.maskRows, mr1 + 1) - mb0;
    rctx.setTransform(1, 0, 0, 1, 0, 0);
    rctx.globalCompositeOperation = "source-over";
    rctx.clearRect(bx, by, bw, bh);
    rctx.imageSmoothingEnabled = true;
    rctx.imageSmoothingQuality = "high";
    rctx.save();
    rctx.beginPath();
    rctx.rect(bx, by, bw, bh);
    rctx.clip();
    rctx.drawImage(this.mask!, ma0, mb0, mw, mh, ma0 * MASK_RES * dpr, mb0 * MASK_RES * dpr, mw * MASK_RES * dpr, mh * MASK_RES * dpr);
    rctx.restore();
    rctx.globalCompositeOperation = "source-in";
    rctx.drawImage(this.photoLayer!, bx, by, bw, bh, bx, by, bw, bh);
    rctx.globalCompositeOperation = "source-over";
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.drawImage(rv, bx, by, bw, bh, bx, by, bw, bh);
  }

  /** Displacement (CSS px) of a mark at (x, y) from the local fluid velocity, soft-capped. */
  private disp(f: Fluid, x: number, y: number, out: { x: number; y: number }) {
    const k = f.h * DISP_T;
    const dx = f.sample(f.u, x, y) * k;
    const dy = f.sample(f.v, x, y) * k;
    const l = Math.hypot(dx, dy);
    if (l < 1e-6) {
      out.x = out.y = 0;
      return 0;
    }
    const s = (DISP_CAP * Math.tanh(l / DISP_CAP)) / l;
    out.x = dx * s;
    out.y = dy * s;
    return l * s;
  }

  /**
   * Dots in the active region: those under the mask or displaced by the flow are
   * cut (merged per-row runs of cells) and redrawn displaced / faded.
   */
  private collectDots(f: Fluid, x0: number, y0: number, x1: number, y1: number) {
    const F = this.F!;
    const hot = this.hot!;
    const p = F.pitch;
    const ci0 = Math.max(0, Math.floor((x0 - F.ox) / p) - 1);
    const cj0 = Math.max(0, Math.floor((y0 - F.oy) / p) - 1);
    const ci1 = Math.min(F.cols, Math.ceil((x1 - F.ox) / p) + 1);
    const cj1 = Math.min(F.rows, Math.ceil((y1 - F.oy) / p) + 1);
    const cut = new Path2D();
    const paths: (Path2D | null)[] = new Array(ALPHA_STEPS + 1).fill(null);
    const glyphs: { x: number; y: number; ch: string; a: number }[] = [];
    const h = f.h;
    const nx = f.nx;
    const ny = f.ny;
    const o = { x: 0, y: 0 };
    for (let j = cj0; j < cj1; j++) {
      let run = -1;
      for (let i = ci0; i <= ci1; i++) {
        let on = false;
        if (i < ci1) {
          const q = j * F.cols + i;
          const r0 = F.r[q];
          if (r0 > 0 && !(this.isAura && this.isAura[q])) {
            const fi = Math.min(nx - 1, Math.max(0, Math.floor(F.x[q] / h)));
            const fj = Math.min(ny - 1, Math.max(0, Math.floor(F.y[q] / h)));
            if (hot[fj * nx + fi]) {
              const d = f.sample(f.dye, F.x[q], F.y[q]);
              const m = sm(T0, T1, d);
              // displacement only in the dye's tail around the mask edge
              const w = sm(0.02, 0.3, d);
              let dl = 0;
              o.x = o.y = 0;
              if (w > 0) {
                dl = this.disp(f, F.x[q], F.y[q], o) * w;
                o.x *= w;
                o.y *= w;
              }
              if (m > 0.002 || dl > DISP_EPS) {
                on = true;
                const glyph = F.g[q] >= 0;
                const a = (glyph ? F.a[q] : dotBucket(F.a[q])) * (1 - m);
                const s = Math.round(a * ALPHA_STEPS);
                if (s > 0) {
                  const x = F.x[q] + o.x;
                  const y = F.y[q] + o.y;
                  if (glyph) glyphs.push({ x, y, ch: F.glyphs[F.g[q]], a: s / ALPHA_STEPS });
                  else {
                    const path = paths[s] ?? (paths[s] = new Path2D());
                    path.moveTo(x + r0, y);
                    path.arc(x, y, r0, 0, Math.PI * 2);
                  }
                }
              }
            }
          }
        }
        if (on && run < 0) run = i;
        else if (!on && run >= 0) {
          cut.rect(F.ox + run * p, F.oy + j * p, (i - run) * p, p);
          run = -1;
        }
      }
    }
    return { cut, paths, glyphs };
  }

  /** Floating letters (not in the base layer): ride the flow, fade under the reveal. */
  private drawLetters(f: Fluid) {
    const F = this.F!;
    if (!F.letters.length) return;
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.globalCompositeOperation = "source-over";
    c.fillStyle = this.pal.ink;
    c.textAlign = "center";
    c.textBaseline = "middle";
    const o = { x: 0, y: 0 };
    for (const l of F.letters) {
      this.disp(f, l.x, l.y, o);
      const a = l.a * (1 - sm(T0, T1, f.sample(f.dye, l.x, l.y)));
      if (a < 0.02) continue;
      c.globalAlpha = a;
      c.font = glyphFont(l.size, this.family, true);
      c.fillText(l.ch, l.x + o.x, l.y + o.y);
    }
    c.globalAlpha = 1;
  }

  /* ------------------------------------------------------------ aura */

  /** Picks the loose dots outside the silhouette (+ floating letters) as aura particles. */
  private buildAura(img: HTMLImageElement, L: Layout) {
    const F = this.F!;
    const cov = fieldCoverage(img, L, F);
    const cand: number[] = [];
    for (let k = 0; k < F.live.length; k++) {
      const q = F.live[k];
      if (cov.A[q] < 0.06) cand.push(q);
    }
    // uniform deterministic subsample keeps the existing falloff (dense at the edge, thin outward)
    const keep = cand.length > AURA_MAX ? AURA_MAX / cand.length : 1;
    const pick = keep < 1 ? cand.filter((q) => hash01(q % F.cols, Math.floor(q / F.cols), 9) < keep) : cand;
    const isA = new Uint8Array(F.cols * F.rows);
    const n = pick.length + F.letters.length;
    const f32 = () => new Float32Array(n);
    const A: Aura = {
      n,
      x0: f32(),
      y0: f32(),
      r: f32(),
      a: f32(),
      g: new Int16Array(n),
      li: new Int16Array(n),
      tx: f32(),
      ty: f32(),
      amp: f32(),
      w1: f32(),
      ph1: f32(),
      ph2: f32(),
      w2: f32(),
      ph3: f32(),
      ox: f32(),
      oy: f32(),
    };
    const TAU = Math.PI * 2;
    const set = (k: number, x: number, y: number, d: number, s: number) => {
      A.x0[k] = x;
      A.y0[k] = y;
      // slow tangential orbit around the head, plus a shared curl drift
      const th = Math.atan2(y - L.headY, x - L.headX);
      A.tx[k] = -Math.sin(th);
      A.ty[k] = Math.cos(th);
      A.amp[k] = 3 + 17 * (1 - Math.exp(-d / 12)) * (0.6 + 0.4 * hash01(s, 1, 11));
      A.w1[k] = (TAU / (7 + 7 * hash01(s, 2, 11))) * (hash01(s, 3, 11) < 0.5 ? -1 : 1);
      A.ph1[k] = hash01(s, 4, 11) * TAU;
      A.ph2[k] = hash01(s, 5, 11) * TAU;
      A.w2[k] = TAU / (1.8 + 3.2 * hash01(s, 6, 11));
      A.ph3[k] = hash01(s, 7, 11) * TAU;
    };
    pick.forEach((q, k) => {
      isA[q] = 1;
      set(k, F.x[q], F.y[q], cov.D[q], q);
      A.r[k] = F.r[q];
      A.g[k] = F.g[q];
      A.a[k] = F.g[q] >= 0 ? F.a[q] : dotBucket(F.a[q]);
      A.li[k] = -1;
    });
    F.letters.forEach((l, i) => {
      const k = pick.length + i;
      const ci = Math.min(F.cols - 1, Math.max(0, Math.floor((l.x - F.ox) / F.pitch)));
      const cj = Math.min(F.rows - 1, Math.max(0, Math.floor((l.y - F.oy) / F.pitch)));
      set(k, l.x, l.y, cov.D[cj * F.cols + ci], 100000 + i);
      A.r[k] = l.size;
      A.g[k] = -2;
      A.a[k] = l.a;
      A.li[k] = i;
    });
    this.isAura = isA;
    this.aura = A;
  }

  private auraKick() {
    if (!this.actx || !this.aura || this.destroyed || !this.ready || this.auraRaf) return;
    if (this.assembleT0 !== null || !this.visible || document.hidden) return;
    this.auraRaf = requestAnimationFrame(this.auraFrame);
  }

  private auraFrame = (now: number) => {
    this.auraRaf = 0;
    if (this.destroyed || !this.aura || this.assembleT0 !== null) return;
    if (!this.visible || document.hidden) {
      this.auraLast = 0; // paused; resumes on the next kick
      return;
    }
    if (!this.auraLast || now - this.auraLast >= AURA_FRAME_MS) {
      const dt = this.auraLast ? Math.min(0.1, (now - this.auraLast) / 1000) : 1 / 30;
      this.auraLast = now;
      this.drawAura(now / 1000, dt);
    }
    this.auraRaf = requestAnimationFrame(this.auraFrame);
  };

  private clearAura() {
    const ac = this.auraCanvas;
    if (!ac || !this.actx) return;
    this.actx.setTransform(1, 0, 0, 1, 0, 0);
    this.actx.clearRect(0, 0, ac.width, ac.height);
  }

  private drawAura(t: number, dt: number) {
    const A = this.aura!;
    const F = this.F!;
    const c = this.actx!;
    const f = this.fluid;
    this.clearAura();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.globalCompositeOperation = "source-over";
    const age = t - this.auraT0;
    const ramp = sm(0, AURA_RAMP_S, age);
    const flow = !!f && f.active;
    const hasDye = !!f && f.maxDye > 0;
    const decay = Math.exp(-dt / AURA_PUSH_TAU);
    const pushK = f ? f.h * AURA_PUSH * dt : 0;
    const paths: (Path2D | null)[] = new Array(AURA_STEPS + 1).fill(null);
    const texts: { x: number; y: number; k: number; a: number }[] = [];
    for (let k = 0; k < A.n; k++) {
      const x0 = A.x0[k];
      const y0 = A.y0[k];
      // fluid push: integrated offset that relaxes back to rest
      let ox = A.ox[k] * decay;
      let oy = A.oy[k] * decay;
      if (flow) {
        ox += f!.sample(f!.u, x0 + ox, y0 + oy) * pushK;
        oy += f!.sample(f!.v, x0 + ox, y0 + oy) * pushK;
        const l = Math.hypot(ox, oy);
        if (l > AURA_PUSH_CAP) {
          ox *= AURA_PUSH_CAP / l;
          oy *= AURA_PUSH_CAP / l;
        }
      }
      if (Math.abs(ox) < 0.01 && Math.abs(oy) < 0.01) ox = oy = 0;
      A.ox[k] = ox;
      A.oy[k] = oy;
      // slow orbit + divergence-free drift (curl of sin(ax+bt)·sin(cy+dt))
      const amp = A.amp[k] * ramp;
      const orb = amp * Math.sin(A.w1[k] * t + A.ph1[k]);
      const sa = x0 * 0.013 + t * 0.21 + A.ph2[k] * 0.15;
      const sc = y0 * 0.011 - t * 0.17;
      const cx = Math.sin(sa) * Math.cos(sc) * amp * 0.45;
      const cy = -Math.cos(sa) * Math.sin(sc) * amp * 0.45;
      const x = x0 + A.tx[k] * orb + cx + ox;
      const y = y0 + A.ty[k] * orb + cy + oy;
      // gentle twinkle (dims only, never brighter than the still dot)
      const tw = 0.8 + 0.2 * Math.sin(A.w2[k] * t + A.ph3[k]);
      let a = A.a[k] * (1 - ramp + ramp * tw);
      if (hasDye) a *= 1 - sm(T0, T1, f!.sample(f!.dye, x, y));
      if (A.g[k] === -1) {
        const s = Math.round(a * AURA_STEPS);
        if (s <= 0) continue;
        const path = paths[s] ?? (paths[s] = new Path2D());
        path.moveTo(x + A.r[k], y);
        path.arc(x, y, A.r[k], 0, Math.PI * 2);
      } else if (a > 0.02) texts.push({ x, y, k, a });
    }
    c.fillStyle = this.pal.ink;
    for (let s = 1; s <= AURA_STEPS; s++) {
      if (!paths[s]) continue;
      c.globalAlpha = s / AURA_STEPS;
      c.fill(paths[s]!);
    }
    if (texts.length) {
      c.textAlign = "center";
      c.textBaseline = "middle";
      const gf = glyphFont(F.pitch * F.glyphScale, this.family);
      for (const it of texts) {
        const g = A.g[it.k];
        c.globalAlpha = it.a;
        if (g >= 0) {
          c.font = gf;
          c.fillText(F.glyphs[g], it.x, it.y);
        } else {
          const l = F.letters[A.li[it.k]];
          c.font = glyphFont(l.size, this.family, true);
          c.fillText(l.ch, it.x, it.y);
        }
      }
    }
    c.globalAlpha = 1;
  }

  private clearMask() {
    const [a0, b0, a1, b1] = this.dirty!;
    const mcols = this.maskCols;
    const md = this.maskData!.data;
    const fd = this.fringeData!.data;
    for (let j = b0; j < b1; j++) {
      md.fill(0, (j * mcols + a0) * 4, (j * mcols + a1) * 4);
      fd.fill(0, (j * mcols + a0) * 4, (j * mcols + a1) * 4);
    }
    if (a1 > a0 && b1 > b0) {
      this.mask!.getContext("2d")!.putImageData(this.maskData!, 0, 0, a0, b0, a1 - a0, b1 - b0);
      this.fringe!.getContext("2d")!.putImageData(this.fringeData!, 0, 0, a0, b0, a1 - a0, b1 - b0);
    }
    this.dirty = null;
  }
}
