/**
 * Canvas engine for <Portrait/>. Owns all per-frame work (no React state).
 *
 * Static layers are pre-rendered once per size/tone. Per frame we only
 * composite: static dots -> cut the liquid blob -> registered colour photo
 * through the same blob -> re-draw the displaced dots around the blob edge
 * (with red/cyan fringes) -> wake particles. When nothing moves, no rAF runs.
 *
 * Impacts: entering the portrait, a fast stroke or a tap emits a shockwave ring
 * that travels across the whole field. Rings are drawn by re-drawing only the
 * ring band (an annulus) from a cached dot layer, warped radially in thin
 * concentric slices, plus a brightening pass and red/cyan copies on the leading
 * edge. Strong impacts shake the whole canvas (a canvas transform shared by the
 * dots AND the revealed photo, so registration holds). Once everything settles
 * the cached static layer is drawn untransformed: the rest frame is pixel-exact.
 */
import {
  buildHalftone,
  buildHalo,
  computeLayout,
  drawField,
  drawSource,
  glyphFont,
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

type Blob = { x: number; y: number; r: number; vx: number; vy: number; wob: boolean };
type TrailSample = { x: number; y: number; t: number; vx: number; vy: number };
type Particle = { x: number; y: number; vx: number; vy: number; t: number; life: number; r: number; c: 0 | 1 | 2 };

type Wave = { x: number; y: number; t: number; amp: number; rMax: number };
type Ring = { x: number; y: number; r: number; A: number; k: number };

const TRAIL_MS = 600;
const WAVE_SPEED = 0.98; // CSS px per ms (~980 px/s)
const WAVE_SIGMA = 16; // ring half-width (gaussian sigma, CSS px)
const WAVE_TAU = 820; // amplitude decay (ms)
const MAX_WAVES = 4;
const EMIT_MS = 120; // min gap between strong waves
const SOFT_EMIT_MS = 320; // min gap between gentle waves
const SHAKE_MS = 260;
const SHAKE_PX = 3;
const SHAKE_ROT = (0.4 * Math.PI) / 180;
const SWELL_MS = 700;
const BANDS = 8; // radial slices per ring
const TAU = Math.PI * 2;
/** Pointer speed (CSS px/ms) -> impact energy 0..1. */
const energyOf = (sp: number) => Math.min(1, Math.max(0, (sp - 0.15) / 2));
const MAX_SAMPLES = 12;
const ASSEMBLE_MS = 900;
const MASK_RES = 3; // CSS px per reveal-mask cell

const sm = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
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
  /** dot layers tinted red / cyan (1x resolution) for the ring's chromatic split */
  private redLayer: HTMLCanvasElement | null = null;
  private cyanLayer: HTMLCanvasElement | null = null;
  private photoLayer: HTMLCanvasElement | null = null;
  private reveal: HTMLCanvasElement | null = null;
  private mask: HTMLCanvasElement | null = null;
  private maskData: ImageData | null = null;
  private maskCols = 0;
  private maskRows = 0;
  private dirty: [number, number, number, number] | null = null; // mask dirty rect (cells)

  // pointer
  private px = 0;
  private py = 0;
  private vx = 0;
  private vy = 0;
  private lastMoveT = 0;
  private inside = false;
  private hover = 0;
  private samples: TrailSample[] = [];
  private particles: Particle[] = [];
  private tap: { x: number; y: number; t: number } | null = null;
  private R = 32;

  // impact
  private waves: Wave[] = [];
  private lastEmit = -1e9;
  private shakeImp: { t: number; m: number; ph: number } | null = null;
  private swell: { t: number; a: number } | null = null;
  private sh = { tx: 0, ty: 0, rot: 0 };

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
    if (this.opts.interactive && this.opts.variant === "halftone") this.bindPointer();
  }

  /** null = render formed; number = performance.now() time when dots start flying in. */
  setAssemble(t0: number | null) {
    if (this.opts.reducedMotion || this.opts.variant !== "halftone") t0 = null;
    this.assembleT0 = t0;
    this.asm = null;
    if (t0 !== null && performance.now() > t0 + ASSEMBLE_MS) this.assembleT0 = null;
    if (this.ready) this.kick(true);
  }

  /**
   * Emit an impact at (x, y) in element-local CSS px with energy 0..1.
   * Used by the pointer handlers; public so callers/tests can trigger one.
   */
  impact(x: number, y: number, energy: number) {
    if (this.opts.reducedMotion || !this.ready || this.opts.variant !== "halftone" || !this.baseLayer) return;
    const now = performance.now();
    const e = Math.min(1, Math.max(0, energy));
    const [fx, fy] = this.toField(x, y);
    const W = this.W;
    const H = this.H;
    const rMax = Math.max(Math.hypot(fx, fy), Math.hypot(W - fx, fy), Math.hypot(fx, H - fy), Math.hypot(W - fx, H - fy)) + 2 * WAVE_SIGMA;
    this.waves.push({ x: fx, y: fy, t: now, amp: 1.2 + 6.8 * e, rMax });
    if (this.waves.length > MAX_WAVES) this.waves.shift();
    this.lastEmit = now;
    this.swell = { t: now, a: 0.2 + 0.8 * e };
    if (e > 0.5) {
      const m = Math.min(1, (e - 0.35) / 0.65);
      const cur = this.shakeImp ? this.shakeEnv(this.shakeImp, now) : 0;
      if (m > cur) this.shakeImp = { t: now, m, ph: Math.random() * TAU };
    }
    this.kick();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.resizeTimer);
    this.io?.disconnect();
    this.ro?.disconnect();
    this.cleanup.forEach((f) => f());
    for (const c of [this.staticLayer, this.baseLayer, this.redLayer, this.cyanLayer, this.photoLayer, this.reveal, this.mask]) if (c) c.width = c.height = 0;
    this.staticLayer = this.baseLayer = this.redLayer = this.cyanLayer = this.photoLayer = this.reveal = this.mask = null;
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
      drawField(sctx, this.F, this.pal.ink, this.family, true, true);
      if (this.opts.interactive) {
        const ph = this.photoLayer && this.photoLayer.width === bw && this.photoLayer.height === bh ? this.photoLayer : makeCanvas(bw, bh);
        const pctx = ph.getContext("2d")!;
        pctx.setTransform(1, 0, 0, 1, 0, 0);
        pctx.clearRect(0, 0, bw, bh);
        pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        pctx.imageSmoothingQuality = "high";
        drawSource(pctx, img, L); // identical mapping to the dot sampling
        this.photoLayer = ph;
        this.reveal = this.reveal && this.reveal.width === bw && this.reveal.height === bh ? this.reveal : makeCanvas(bw, bh);
        this.maskCols = Math.ceil(W / MASK_RES);
        this.maskRows = Math.ceil(H / MASK_RES);
        this.mask = makeCanvas(this.maskCols, this.maskRows);
        this.maskData = new ImageData(this.maskCols, this.maskRows);
        this.dirty = null;
        this.R = Math.max(18, Math.min(64, L.headR * 0.19));
        // impact layers: dots w/o letters (full res) + tinted copies (1x)
        const fit = (cv: HTMLCanvasElement | null, w: number, h: number) => (cv && cv.width === w && cv.height === h ? cv : makeCanvas(w, h));
        const paint = (cv: HTMLCanvasElement, scale: number, color: string) => {
          const x = cv.getContext("2d")!;
          x.setTransform(1, 0, 0, 1, 0, 0);
          x.clearRect(0, 0, cv.width, cv.height);
          x.setTransform(scale, 0, 0, scale, 0, 0);
          drawField(x, this.F!, color, this.family, false);
          return cv;
        };
        this.baseLayer = paint(fit(this.baseLayer, bw, bh), dpr, this.pal.ink);
        this.redLayer = paint(fit(this.redLayer, W, H), 1, this.pal.red);
        this.cyanLayer = paint(fit(this.cyanLayer, W, H), 1, this.pal.cyan);
        this.waves = [];
        this.shakeImp = null;
        this.sh = { tx: 0, ty: 0, rot: 0 };
      }
    }
    this.staticLayer = st;
    this.asm = null;
    this.ready = true;
    this.kick(true);
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
      if (this.visible) this.kick();
    });
    this.io.observe(this.root);
    const onVis = () => {
      if (!document.hidden) this.kick();
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
      if (e.pointerType === "touch" || touchOnly || this.opts.reducedMotion) return;
      const [x, y] = local(e);
      const now = performance.now();
      const dt = Math.max(8, now - this.lastMoveT);
      const entering = !this.inside;
      if (!entering) {
        const k = 0.35;
        this.vx = this.vx * (1 - k) + ((x - this.px) / dt) * k;
        this.vy = this.vy * (1 - k) + ((y - this.py) / dt) * k;
      } else {
        // entry speed from the browser's movement delta (~one frame)
        const cl = (v: number) => Math.max(-4, Math.min(4, v));
        this.vx = cl((e.movementX || 0) / 16);
        this.vy = cl((e.movementY || 0) / 16);
      }
      this.lastMoveT = now;
      this.px = x;
      this.py = y;
      this.inside = true;
      const en = energyOf(Math.hypot(this.vx, this.vy));
      if (entering) this.impact(x, y, Math.max(0.2, en));
      else if (en > 0.12 && now - this.lastEmit > (en > 0.4 ? EMIT_MS : SOFT_EMIT_MS)) this.impact(x, y, en);
      const last = this.samples[this.samples.length - 1];
      if (!last || Math.hypot(last.x - x, last.y - y) > this.R * 0.18) {
        this.samples.push({ x, y, t: now, vx: this.vx, vy: this.vy });
        if (this.samples.length > MAX_SAMPLES) this.samples.shift();
        this.spawnWake(x, y);
      }
      this.kick();
    };
    const leave = () => {
      this.inside = false;
      this.kick();
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch" && !touchOnly) return;
      if (this.opts.reducedMotion) return;
      const [x, y] = local(e);
      this.tap = { x, y, t: performance.now() };
      this.impact(x, y, 0.7);
      this.kick();
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

  private spawnWake(x: number, y: number) {
    const sp = Math.hypot(this.vx, this.vy);
    if (sp < 0.05) return;
    const n = Math.min(5, 1 + Math.floor(sp * 3));
    const ux = this.vx / sp;
    const uy = this.vy / sp;
    for (let k = 0; k < n; k++) {
      if (this.particles.length > 220) this.particles.shift();
      const side = (Math.random() - 0.5) * this.R * 1.4;
      const roll = Math.random();
      this.particles.push({
        x: x - ux * this.R * (0.6 + Math.random() * 0.5) - uy * side,
        y: y - uy * this.R * (0.6 + Math.random() * 0.5) + ux * side,
        vx: -this.vx * 0.12 + (Math.random() - 0.5) * 0.06,
        vy: -this.vy * 0.12 + (Math.random() - 0.5) * 0.06,
        t: performance.now(),
        life: 420 + Math.random() * 360,
        r: 0.6 + Math.random() * 0.9,
        c: roll < 0.6 ? 0 : roll < 0.8 ? 1 : 2,
      });
    }
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
    const dt = this.lastFrame ? Math.min(50, now - this.lastFrame) : 16;
    this.lastFrame = now;
    let more = false;
    if (this.assembleT0 !== null) {
      more = this.drawAssemble(now);
      if (!more) {
        this.assembleT0 = null;
        this.asm = null;
        more = this.drawLive(now, dt);
      }
    } else {
      more = this.drawLive(now, dt);
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

  private collectBlobs(now: number, dt: number): Blob[] {
    const R = this.R;
    const blobs: Blob[] = [];
    // hover ease in/out
    const target = this.inside ? 1 : 0;
    const k = 1 - Math.exp(-dt / (target ? 110 : 160));
    this.hover += (target - this.hover) * k;
    if (Math.abs(this.hover - target) < 0.005) this.hover = target;
    // velocity relaxes when the pointer is still
    const idle = now - this.lastMoveT;
    if (idle > 40) {
      const d = Math.exp(-dt / 90);
      this.vx *= d;
      this.vy *= d;
    }
    // impact swell: quick overshoot of the reveal, then a small undershoot
    let swell = 1;
    if (this.swell) {
      const age = now - this.swell.t;
      if (age > SWELL_MS) this.swell = null;
      else swell = Math.max(0.75, 1 + this.swell.a * Math.sin((age * TAU) / 380) * Math.exp(-age / 170));
    }
    // blobs live in field space (pointer mapped through the inverse shake)
    if (this.hover > 0.01) {
      const sp = Math.min(1.5, Math.hypot(this.vx, this.vy));
      const [x, y] = this.toField(this.px, this.py);
      blobs.push({ x, y, r: R * this.hover * (1 + sp * 0.12) * swell, vx: this.vx, vy: this.vy, wob: true });
    }
    this.samples = this.samples.filter((s) => now - s.t < TRAIL_MS);
    for (const s of this.samples) {
      const life = 1 - (now - s.t) / TRAIL_MS;
      const [x, y] = this.toField(s.x, s.y);
      blobs.push({ x, y, r: R * 0.82 * Math.pow(life, 1.4), vx: s.vx, vy: s.vy, wob: false });
    }
    if (this.tap) {
      const a = (now - this.tap.t) / 900;
      if (a >= 1) this.tap = null;
      else {
        const [x, y] = this.toField(this.tap.x, this.tap.y);
        blobs.push({ x, y, r: R * 1.15 * Math.sin(Math.PI * a) * swell, vx: 0, vy: 0, wob: true });
      }
    }
    return blobs.filter((b) => b.r > 0.8);
  }

  /** Metaball field + outward gradient at (x,y). */
  private fieldAt(blobs: Blob[], x: number, y: number, now: number, out: { gx: number; gy: number }) {
    let f = 0;
    let gx = 0;
    let gy = 0;
    for (const b of blobs) {
      let dx = x - b.x;
      let dy = y - b.y;
      // far from this blob: its term is negligible (keeps long flick trails cheap)
      const cull = b.r * 4.5;
      if (dx > cull || dx < -cull || dy > cull || dy < -cull) continue;
      let rr = b.r;
      const sp = Math.hypot(b.vx, b.vy);
      let d2: number;
      if (sp > 0.02) {
        // stretch along velocity
        const ux = b.vx / sp;
        const uy = b.vy / sp;
        const par = dx * ux + dy * uy;
        const per = -dx * uy + dy * ux;
        const st = 1 + Math.min(0.7, sp * 0.45);
        d2 = (par / st) * (par / st) + (per * per) / (1 + (st - 1) * 0.2);
      } else d2 = dx * dx + dy * dy;
      if (b.wob) {
        const th = Math.atan2(dy, dx);
        rr *= 1 + 0.07 * Math.sin(3 * th + now * 0.0021) + 0.05 * Math.sin(5 * th - now * 0.0013 + 1.7);
      }
      const term = Math.min(6, (rr * rr) / (d2 + 1));
      f += term;
      const d = Math.sqrt(d2) || 1;
      dx /= d;
      dy /= d;
      gx += dx * term;
      gy += dy * term;
    }
    out.gx = gx;
    out.gy = gy;
    return f;
  }

  /* ------------------------------------------------------------ impact helpers */

  private shakeEnv(s: { t: number; m: number }, now: number) {
    const age = now - s.t;
    if (age >= SHAKE_MS || age < 0) return 0;
    return s.m * Math.exp(-age / 90) * (1 - age / SHAKE_MS);
  }

  /** Updates the damped shake offset. Returns true while shaking. */
  private updateShake(now: number) {
    const s = this.shakeImp;
    const env = s ? this.shakeEnv(s, now) : 0;
    if (!s || env <= 0) {
      this.shakeImp = null;
      this.sh.tx = this.sh.ty = this.sh.rot = 0;
      return false;
    }
    const age = now - s.t;
    this.sh.tx = SHAKE_PX * env * Math.sin(age * 0.13 + s.ph);
    this.sh.ty = SHAKE_PX * env * Math.sin(age * 0.097 + s.ph * 1.9 + 1.1);
    this.sh.rot = SHAKE_ROT * env * Math.sin(age * 0.071 + s.ph * 0.7 + 2.3);
    return true;
  }

  /** Canvas transform: CSS px field space -> device px, including the shake. */
  private setM(c: CanvasRenderingContext2D) {
    const { tx, ty, rot } = this.sh;
    const d = this.dpr;
    const cs = Math.cos(rot);
    const sn = Math.sin(rot);
    const cx = this.W / 2;
    const cy = this.H / 2;
    c.setTransform(d * cs, d * sn, -d * sn, d * cs, d * (cx + tx - (cs * cx - sn * cy)), d * (cy + ty - (sn * cx + cs * cy)));
  }

  /** Element-local CSS px -> field space (inverse of the shake). */
  private toField(x: number, y: number): [number, number] {
    const { tx, ty, rot } = this.sh;
    if (!tx && !ty && !rot) return [x, y];
    const cx = this.W / 2;
    const cy = this.H / 2;
    const px = x - cx - tx;
    const py = y - cy - ty;
    const cs = Math.cos(rot);
    const sn = Math.sin(rot);
    return [cs * px + sn * py + cx, -sn * px + cs * py + cy];
  }

  /** Advances waves; returns the live rings for this frame. */
  private updateWaves(now: number): Ring[] {
    const rings: Ring[] = [];
    this.waves = this.waves.filter((w) => {
      const age = now - w.t;
      const r = age * WAVE_SPEED;
      const A = w.amp * Math.exp(-age / WAVE_TAU);
      if (r - 2 * WAVE_SIGMA > w.rMax || A < 0.15) return false;
      rings.push({ x: w.x, y: w.y, r, A, k: Math.min(1, A / 5.5) });
      return true;
    });
    return rings;
  }

  /** Radial displacement (CSS px) of a ring at distance d from its source. */
  private ringDisp(w: Ring, d: number) {
    const band = d - w.r;
    if (band > 2 * WAVE_SIGMA || band < -2 * WAVE_SIGMA) return 0;
    const s = Math.exp(-(band * band) / (WAVE_SIGMA * WAVE_SIGMA));
    return Math.min(d * 0.4, w.A * (0.4 + 0.6 * Math.exp(-d / 260)) * s);
  }

  /** Draws `img` (full layer) scaled by `sc` about (cx, cy), inside the current clip. */
  private drawScaled(img: HTMLCanvasElement, cx: number, cy: number, sc: number, alpha: number, ox = 0, oy = 0) {
    const c = this.ctx;
    this.setM(c);
    c.translate(cx + ox, cy + oy);
    c.scale(sc, sc);
    c.translate(-cx, -cy);
    c.globalAlpha = alpha;
    c.drawImage(img, 0, 0, this.W, this.H);
  }

  /**
   * Shockwave rings. Only the ring band is touched: erase the annulus, then
   * redraw it from the cached dot layer in thin slices, each pushed outward by
   * that slice's displacement; brighten; chromatic split on the leading edge.
   */
  private drawRings(rings: Ring[]) {
    const c = this.ctx;
    const base = this.baseLayer!;
    const S = WAVE_SIGMA;
    const dark = this.opts.tone === "dark";
    const blend = (dark ? "lighter" : "multiply") as GlobalCompositeOperation;
    const bright = (dark ? "lighter" : "source-over") as GlobalCompositeOperation;
    // nearest-neighbour keeps the slightly scaled dots crisp (bilinear turns them grey)
    c.imageSmoothingEnabled = false;
    for (const w of rings) {
      const rin = Math.max(0, w.r - 2 * S);
      const rout = w.r + 2 * S;
      this.setM(c);
      c.globalCompositeOperation = "destination-out";
      c.globalAlpha = 1;
      c.beginPath();
      c.arc(w.x, w.y, rout, 0, TAU);
      if (rin > 0) c.arc(w.x, w.y, rin, 0, TAU, true);
      c.fill();
      c.globalCompositeOperation = "source-over";
      const step = (rout - rin) / BANDS;
      for (let k = 0; k < BANDS; k++) {
        const a0 = rin + k * step;
        const a1 = a0 + step;
        const dk = (a0 + a1) / 2;
        const band = dk - w.r;
        const s = Math.exp(-(band * band) / (S * S));
        const m = dk < 2 ? 0 : this.ringDisp(w, dk);
        const sc = dk < 2 ? 1 : (dk + m) / dk;
        c.save();
        this.setM(c);
        c.beginPath();
        c.arc(w.x, w.y, a1, 0, TAU);
        if (a0 > 0) c.arc(w.x, w.y, a0, 0, TAU, true);
        c.clip();
        const b = s * w.k;
        const lead = band > -S * 0.3;
        // crest: dots pushed out + brightened; trough behind it: slightly dimmed
        this.drawScaled(base, w.x, w.y, sc, lead ? 1 : 1 - 0.35 * b);
        if (lead && b > 0.03) {
          // crest: dots swell (dilate by ~half a pixel) and glow
          const o = 0.6 / this.dpr + 0.4 * w.k;
          c.globalCompositeOperation = bright;
          this.drawScaled(base, w.x, w.y, sc, Math.min(0.85, b * 0.9), o, 0);
          this.drawScaled(base, w.x, w.y, sc, Math.min(0.85, b * 0.9), 0, o);
          c.globalCompositeOperation = "source-over";
        }
        if (lead && b > 0.05 && dk > 6) {
          const fo = 1.5 + 4.5 * w.k;
          c.globalCompositeOperation = blend;
          c.imageSmoothingEnabled = true; // tinted layers are 1x: smooth them
          this.drawScaled(this.redLayer!, w.x, w.y, (dk + m + fo) / dk, Math.min(1, b * 1.1));
          this.drawScaled(this.cyanLayer!, w.x, w.y, Math.max(0.5, (dk + m - fo) / dk), Math.min(1, b * 1.1));
          c.globalCompositeOperation = "source-over";
          c.imageSmoothingEnabled = false;
        }
        c.restore();
      }
    }
    c.imageSmoothingEnabled = true;
    c.globalAlpha = 1;
  }

  /** Floating letters, drawn live while animating (they ride the rings, fade under the reveal). */
  private drawLetters(rings: Ring[], blobs: Blob[], now: number) {
    const F = this.F!;
    if (!F.letters.length) return;
    const c = this.ctx;
    this.setM(c);
    c.globalCompositeOperation = "source-over";
    c.fillStyle = this.pal.ink;
    c.textAlign = "center";
    c.textBaseline = "middle";
    const g = { gx: 0, gy: 0 };
    for (const l of F.letters) {
      let x = l.x;
      let y = l.y;
      for (const w of rings) {
        const dx = l.x - w.x;
        const dy = l.y - w.y;
        const d = Math.hypot(dx, dy);
        if (d < 1) continue;
        const m = this.ringDisp(w, d);
        x += (dx / d) * m;
        y += (dy / d) * m;
      }
      let a = l.a;
      if (blobs.length) a *= 1 - sm(0.3, 1.05, this.fieldAt(blobs, l.x, l.y, now, g));
      if (a < 0.02) continue;
      c.globalAlpha = a;
      c.font = glyphFont(l.size, this.family, true);
      c.fillText(l.ch, x, y);
    }
    c.globalAlpha = 1;
  }

  private drawLive(now: number, dt: number) {
    const c = this.ctx;
    this.clearMain();
    const interactive = this.opts.variant === "halftone" && this.photoLayer && this.mask && this.maskData && this.baseLayer;
    const shaking = interactive ? this.updateShake(now) : false;
    const rings = interactive ? this.updateWaves(now) : [];
    const blobs = interactive ? this.collectBlobs(now, dt) : [];
    this.particles = this.particles.filter((p) => now - p.t < p.life);

    if (!blobs.length && !rings.length && !shaking) {
      // at rest: the cached layer, untransformed -> pixel-exact still image
      c.drawImage(this.staticLayer!, 0, 0);
      if (this.dirty) this.clearMask();
      this.drawParticles(now, dt);
      return this.particles.length > 0 || this.inside || this.hover > 0;
    }

    if (shaking) {
      this.setM(c);
      c.drawImage(this.baseLayer!, 0, 0, this.W, this.H);
    } else c.drawImage(this.baseLayer!, 0, 0);
    if (rings.length) this.drawRings(rings);
    if (blobs.length) this.drawReveal(now, blobs);
    else if (this.dirty) this.clearMask();
    this.drawLetters(rings, blobs, now);
    this.drawParticles(now, dt);
    return true;
  }

  /** Liquid reveal: registered colour photo through the metaball blob + displaced edge dots. */
  private drawReveal(now: number, blobs: Blob[]) {
    const c = this.ctx;
    const dpr = this.dpr;
    const F = this.F!;
    const R = this.R;
    // bbox of influence
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const b of blobs) {
      const e = b.r * 2.6 + R * 0.6;
      x0 = Math.min(x0, b.x - e);
      y0 = Math.min(y0, b.y - e);
      x1 = Math.max(x1, b.x + e);
      y1 = Math.max(y1, b.y + e);
    }
    x0 = Math.max(0, x0);
    y0 = Math.max(0, y0);
    x1 = Math.min(this.W, x1);
    y1 = Math.min(this.H, y1);
    if (x1 <= x0 || y1 <= y0) return;

    /* 1. reveal mask (low-res metaball field, upscaled smoothly) */
    const mc0 = Math.floor(x0 / MASK_RES);
    const mr0 = Math.floor(y0 / MASK_RES);
    const mc1 = Math.min(this.maskCols, Math.ceil(x1 / MASK_RES));
    const mr1 = Math.min(this.maskRows, Math.ceil(y1 / MASK_RES));
    const md = this.maskData!.data;
    const mcols = this.maskCols;
    // clear previous dirty area
    if (this.dirty) {
      const [a0, b0, a1, b1] = this.dirty;
      for (let j = b0; j < b1; j++) md.fill(0, (j * mcols + a0) * 4, (j * mcols + a1) * 4);
    }
    const g = { gx: 0, gy: 0 };
    for (let j = mr0; j < mr1; j++) {
      for (let i = mc0; i < mc1; i++) {
        const f = this.fieldAt(blobs, (i + 0.5) * MASK_RES, (j + 0.5) * MASK_RES, now, g);
        const a = sm(0.45, 1.6, f);
        if (a > 0) {
          const q = (j * mcols + i) * 4;
          md[q] = md[q + 1] = md[q + 2] = 255;
          md[q + 3] = a * 255;
        }
      }
    }
    const da = this.dirty ? Math.min(this.dirty[0], mc0) : mc0;
    const db = this.dirty ? Math.min(this.dirty[1], mr0) : mr0;
    const dc = this.dirty ? Math.max(this.dirty[2], mc1) : mc1;
    const dd = this.dirty ? Math.max(this.dirty[3], mr1) : mr1;
    this.mask!.getContext("2d")!.putImageData(this.maskData!, 0, 0, da, db, dc - da, dd - db);
    this.dirty = [mc0, mr0, mc1, mr1];

    /* 2. masked photo (same mapping as the dots) */
    const rv = this.reveal!;
    const rctx = rv.getContext("2d")!;
    const bx = Math.floor(x0 * dpr);
    const by = Math.floor(y0 * dpr);
    const bw = Math.ceil((x1 - x0) * dpr) + 2;
    const bh = Math.ceil((y1 - y0) * dpr) + 2;
    // only the bbox region is touched (mask cells padded by 1 so the upscale edge is clean)
    const ma0 = Math.max(0, mc0 - 1);
    const mb0 = Math.max(0, mr0 - 1);
    const mw = Math.min(mcols, mc1 + 1) - ma0;
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

    /* 3. cut dots under blob + the displaced-edge cells */
    const p = F.pitch;
    const ci0 = Math.max(0, Math.floor((x0 - F.ox) / p));
    const cj0 = Math.max(0, Math.floor((y0 - F.oy) / p));
    const ci1 = Math.min(F.cols, Math.ceil((x1 - F.ox) / p));
    const cj1 = Math.min(F.rows, Math.ceil((y1 - F.oy) / p));
    const cut = new Path2D();
    const ink = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    const red = [new Path2D(), new Path2D(), new Path2D()];
    const cyan = [new Path2D(), new Path2D(), new Path2D()];
    const glyphs: { x: number; y: number; ch: string; a: number }[] = [];
    const push = R * 0.2;
    const motion = Math.min(1, 0.3 + Math.hypot(this.vx, this.vy) * 1.4);
    const fr = Math.max(1.2, p * 0.45); // fringe offset
    for (let j = cj0; j < cj1; j++) {
      for (let i = ci0; i < ci1; i++) {
        const q = j * F.cols + i;
        const r0 = F.r[q];
        if (r0 <= 0) continue;
        const f = this.fieldAt(blobs, F.x[q], F.y[q], now, g);
        if (f < 0.26) continue;
        cut.rect(F.ox + i * p, F.oy + j * p, p, p);
        const gl = Math.hypot(g.gx, g.gy) || 1;
        const ux = g.gx / gl;
        const uy = g.gy / gl;
        const s = sm(0.26, 1.0, f);
        const x = F.x[q] + ux * push * s;
        const y = F.y[q] + uy * push * s;
        const a = F.a[q] * (1 - sm(0.3, 1.05, f));
        const chroma = motion * sm(0.22, 0.6, f) * (1 - sm(0.75, 1.1, f));
        if (chroma > 0.05) {
          const cb = chroma > 0.66 ? 2 : chroma > 0.33 ? 1 : 0;
          const rr = Math.max(r0, p * 0.25);
          red[cb].moveTo(x + ux * fr + rr, y + uy * fr);
          red[cb].arc(x + ux * fr, y + uy * fr, rr, 0, Math.PI * 2);
          cyan[cb].moveTo(x - ux * fr + rr, y - uy * fr);
          cyan[cb].arc(x - ux * fr, y - uy * fr, rr, 0, Math.PI * 2);
        }
        if (a < 0.04) continue;
        if (F.g[q] >= 0) {
          glyphs.push({ x, y, ch: F.glyphs[F.g[q]], a });
          continue;
        }
        const b = a > 0.85 ? 3 : a > 0.6 ? 2 : a > 0.35 ? 1 : 0;
        const rr = r0 * (1 - 0.45 * s);
        ink[b].moveTo(x + rr, y);
        ink[b].arc(x, y, rr, 0, Math.PI * 2);
      }
    }
    // everything below shares the shake transform, so photo and dots stay registered
    this.setM(c);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "destination-out";
    c.fill(cut);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.mask!, ma0, mb0, mw, mh, ma0 * MASK_RES, mb0 * MASK_RES, mw * MASK_RES, mh * MASK_RES);
    c.globalCompositeOperation = "source-over";
    c.drawImage(rv, bx, by, bw, bh, bx / dpr, by / dpr, bw / dpr, bh / dpr);

    /* 4. displaced dots with chromatic fringes */
    const fa = [0.2, 0.38, 0.6];
    const blend = this.opts.tone === "dark" ? "lighter" : "multiply";
    c.globalCompositeOperation = blend as GlobalCompositeOperation;
    for (let b = 0; b < 3; b++) {
      c.globalAlpha = fa[b];
      c.fillStyle = this.pal.red;
      c.fill(red[b]);
      c.fillStyle = this.pal.cyan;
      c.fill(cyan[b]);
    }
    c.globalCompositeOperation = "source-over";
    c.fillStyle = this.pal.ink;
    const ia = [0.25, 0.5, 0.75, 1];
    for (let b = 0; b < 4; b++) {
      c.globalAlpha = ia[b];
      c.fill(ink[b]);
    }
    if (glyphs.length) {
      c.font = glyphFont(p * F.glyphScale, this.family);
      c.textAlign = "center";
      c.textBaseline = "middle";
      for (const gl of glyphs) {
        c.globalAlpha = gl.a;
        c.fillText(gl.ch, gl.x, gl.y);
      }
    }
    c.globalAlpha = 1;
  }

  private clearMask() {
    const md = this.maskData!.data;
    const [a0, b0, a1, b1] = this.dirty!;
    const mcols = this.maskCols;
    for (let j = b0; j < b1; j++) md.fill(0, (j * mcols + a0) * 4, (j * mcols + a1) * 4);
    this.mask!.getContext("2d")!.putImageData(this.maskData!, 0, 0, a0, b0, a1 - a0, b1 - b0);
    this.dirty = null;
  }

  private drawParticles(now: number, dt: number) {
    if (!this.particles.length) return;
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const cols = [this.pal.ink, this.pal.red, this.pal.cyan];
    const drag = Math.exp(-dt / 260);
    for (const pt of this.particles) {
      pt.vx *= drag;
      pt.vy *= drag;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      const life = 1 - (now - pt.t) / pt.life;
      c.globalAlpha = Math.pow(Math.max(0, life), 1.5) * 0.85;
      c.fillStyle = cols[pt.c];
      c.beginPath();
      c.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }
}
