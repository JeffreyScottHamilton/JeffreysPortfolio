/**
 * Work hero → project board set piece (desktop ≥1025, motion allowed).
 *
 * One pinned stage, driven by a single scrubbed progress p ∈ [0, 1]:
 *   0.00–0.16  both hero ribbons rise and bend into ONE circle around the
 *              portrait (the letters ride it); copy and certificates fade left
 *   0.12–0.40  the portrait's own halftone dots (same field as <Portrait/>)
 *              peel off, outside first, and pour into the circle
 *   0.36–0.62  the circle unspools from its tail into one thread that leaves
 *              via the bottom-right corner; the dots ride along it and exit
 *   0.60–0.90  the dots come back along the thread and settle into each card /
 *              strip of the board (halftone of its picture)
 *   0.84–0.94  the real previews, titles and rules fade in; then a short hold
 *
 * Everything is a pure function of p (reversible, nothing drifts at rest).
 * Drawing happens in a single rAF that is only scheduled when p changes.
 */
import {
  buildHalftone,
  computeLayout,
  drawField,
  hash01,
  loadCutout,
  palette,
} from "@/lib/halftone";
import { GLYPHS } from "@/components/shared/context";
import {
  clamp01,
  coverPainter,
  easeIn,
  easeInOut,
  easeOut,
  fillDots,
  journalPainter,
  loadImage,
  norm,
  parsePosition,
  pendingPainter,
  plannedPainter,
  sampleDots,
  type Painter,
} from "./dots";

export type StreamEls = {
  canvas: HTMLCanvasElement;
  stage: HTMLElement; // pinned wrapper; hero sits at its top-left
  hero: HTMLElement;
  portrait: HTMLElement; // the .portrait root inside .wk-hero-portrait
  ribbon: SVGSVGElement | null; // main hero ribbon (with letters)
  ribbon2: SVGSVGElement | null;
  slideOut: HTMLElement[]; // copy, orbit, experience, floating letters
  board: HTMLElement; // section#projects
  targets: HTMLElement[]; // .wk-bd-target (pair frames, row strip wrappers)
};

const TAU = Math.PI * 2;
const M = 220; // samples along the ribbon / thread
const SPAN = TAU * 1.04;
/** where the thread leaves the circle (top-left, heading down-left) */
const THL = -0.75 * Math.PI;
/** circle parameter: θ(s) = TH0 - s·SPAN, ending at THL */
const TH0 = THL + SPAN;
const P_SWAP = 0.12;
const SKEW = Math.tan((-9 * Math.PI) / 180);
const ROT = (-12 * Math.PI) / 180;
const PERSP = 1200;

type Geo = {
  W: number;
  H: number;
  dpr: number;
  pox: number;
  poy: number;
  headX: number;
  headY: number;
  cx: number;
  cy: number;
  R: number;
  dmax: number;
  faceLayer: HTMLCanvasElement;
  work: HTMLCanvasElement;
  /** stage px → ribbon user units (uniform scale + offset) */
  us: number;
  ux: number;
  uy: number;
  base1: Float32Array; // sampled base paths, stage px (x,y interleaved)
  base2: Float32Array;
  /** thread Bézier control points (x0,y0,…,x3,y3) and its rough length */
  T: number[];
  tLen: number;
};

/** Cubic Bézier coordinate. */
const bz = (a: number, b: number, c: number, d: number, t: number) => {
  const m = 1 - t;
  return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d;
};

export class FaceStream {
  private els: StreamEls;
  private ctx: CanvasRenderingContext2D;
  private pal = palette("dark");
  private p = 0;
  private raf = 0;
  private ready = false;
  private destroyed = false;
  private buildId = 0;
  private g: Geo | null = null;

  // particles
  private n = 0;
  private fx = new Float32Array(0);
  private fy = new Float32Array(0);
  private fr = new Float32Array(0);
  private t0 = new Float32Array(0);
  private sig = new Float32Array(0);
  private off = new Float32Array(0);
  private h1 = new Float32Array(0);
  private h2 = new Float32Array(0);
  private h3 = new Float32Array(0);
  private tx = new Float32Array(0); // board target, stage px
  private ty = new Float32Array(0);
  private tr = new Float32Array(0);
  private tk = new Int8Array(0); // -1 = no target
  private tred = new Uint8Array(0);
  // per-frame scratch
  private X = new Float32Array(0);
  private Y = new Float32Array(0);
  private Rr = new Float32Array(0);
  private C = new Uint8Array(0); // 0 ink, 1 red, 2 cyan, 3 hidden
  private path = new Float32Array(M * 2);
  private tmp = [0, 0, 0, 0];
  private nrm = new Float32Array(M * 2);
  private path2 = new Float32Array(M * 2);

  private p1: SVGPathElement | null;
  private p2: SVGPathElement | null;
  private d1: string;
  private d2: string;

  constructor(
    els: StreamEls,
    private maxParticles: number,
  ) {
    const ctx = els.canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    this.els = els;
    this.ctx = ctx;
    this.p1 = els.ribbon?.querySelector("defs path") ?? null;
    this.p2 = els.ribbon2?.querySelector("defs path") ?? null;
    this.d1 = this.p1?.getAttribute("d") ?? "";
    this.d2 = this.p2?.getAttribute("d") ?? "";
  }

  private painter(t: HTMLElement): Promise<Painter> {
    const img = t.querySelector("img");
    if (img) {
      const pos: [number, number] = t.classList.contains("wk-pair-frame")
        ? [0, 0]
        : parsePosition(img.style.objectPosition);
      return loadImage(img.currentSrc || img.src).then((im) =>
        coverPainter(im, pos[0], pos[1]),
      );
    }
    if (t.querySelector(".wk-journal")) return Promise.resolve(journalPainter);
    if (t.querySelector(".wk-strip-planned"))
      return Promise.resolve(plannedPainter);
    return Promise.resolve(pendingPainter);
  }

  /** (Re)measures the layout and rebuilds dot fields. Safe to call on resize. */
  async build() {
    const id = ++this.buildId;
    const { stage, portrait, targets, canvas } = this.els;
    const W = Math.round(portrait.clientWidth);
    const H = Math.round(portrait.clientHeight);
    if (W < 40 || H < 40 || !targets.length) return;
    const fam = getComputedStyle(portrait).fontFamily || "sans-serif";
    let face: HTMLImageElement;
    let painters: Painter[];
    try {
      [face, painters] = await Promise.all([
        loadCutout(),
        Promise.all(
          targets.map((t) => this.painter(t).catch(() => pendingPainter)),
        ),
      ]);
    } catch {
      return;
    }
    if (this.destroyed || id !== this.buildId) return;

    // the ribbon paths must be at rest while we sample them
    this.p1?.setAttribute("d", this.d1);
    this.p2?.setAttribute("d", this.d2);

    const sr = stage.getBoundingClientRect();
    const pr = portrait.getBoundingClientRect();
    const pox = Math.round(pr.left - sr.left);
    const poy = Math.round(pr.top - sr.top);
    const VW = stage.clientWidth;
    const VH = Math.min(stage.clientHeight, innerHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    // the exact field <Portrait/> renders for this box
    const L = computeLayout(W, H, "bust");
    const F = buildHalftone(face, L, {
      tone: "dark",
      framing: "bust",
      glyphs: GLYPHS,
    });
    const faceLayer = document.createElement("canvas");
    faceLayer.width = Math.round(W * dpr);
    faceLayer.height = Math.round(H * dpr);
    const fctx = faceLayer.getContext("2d");
    if (!fctx) return;
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawField(fctx, F, this.pal.ink, fam, true, true);
    const work = document.createElement("canvas");
    work.width = faceLayer.width;
    work.height = faceLayer.height;

    // one circle around the bust (stage px)
    const cx = pox + L.dx + L.dw * 0.5;
    let R = Math.min(L.dh * 0.5, L.dw * 0.62);
    R = Math.max(60, Math.min(R, (VH - 150) / 2, VW - cx - 30));
    let cy = poy + L.dy + L.dh * 0.5;
    cy = Math.max(cy, 110 + R);
    cy = Math.min(cy, VH - 30 - R);

    // ribbon user units: the SVG fills the hero with a uniform scale (slice)
    let us = 1;
    let ux = 0;
    let uy = 0;
    const m = this.els.ribbon?.getScreenCTM();
    if (m && m.a) {
      us = 1 / m.a;
      ux = (sr.left - m.e) * us;
      uy = (sr.top - m.f) * us;
    }
    const sample = (el: SVGPathElement | null) => {
      const out = new Float32Array(M * 2);
      if (!el) return out;
      const len = el.getTotalLength();
      for (let i = 0; i < M; i++) {
        const q = el.getPointAtLength((len * i) / (M - 1));
        out[i * 2] = (q.x - ux) / us;
        out[i * 2 + 1] = (q.y - uy) / us;
      }
      return out;
    };
    const base1 = sample(this.p1);
    const base2 = sample(this.p2);

    // the thread: leaves the circle tangentially at THL, then an S-curve
    // out through the bottom-right corner
    const T0x = cx + R * Math.cos(THL);
    const T0y = cy + R * Math.sin(THL);
    const T = [
      T0x,
      T0y,
      T0x + Math.sin(THL) * R * 1.2,
      T0y - Math.cos(THL) * R * 1.2,
      VW * 0.5,
      VH * 1.02,
      VW + 200,
      VH + 70,
    ];
    let tLen = 0;
    for (let i = 1, px = T[0], py = T[1]; i <= 40; i++) {
      const x = bz(T[0], T[2], T[4], T[6], i / 40);
      const y = bz(T[1], T[3], T[5], T[7], i / 40);
      tLen += Math.hypot(x - px, y - py);
      px = x;
      py = y;
    }

    // particles: an even, seeded subset of the live dots
    const live = F.live;
    const N = Math.min(this.maxParticles, live.length);
    const stride = live.length / N;
    this.alloc(N);
    const hx = L.headX;
    const hy = L.headY;
    let dmax = 1;
    for (let i = 0; i < N; i++) {
      const k =
        live[
          Math.min(
            live.length - 1,
            Math.floor(i * stride + hash01(i, 7, 31) * stride),
          )
        ];
      this.fx[i] = F.x[k];
      this.fy[i] = F.y[k];
      this.fr[i] = F.g[k] >= 0 ? F.pitch * 0.35 : F.r[k];
      dmax = Math.max(dmax, Math.hypot(F.x[k] - hx, (F.y[k] - hy) * 0.9));
      this.h1[i] = hash01(i, 1, 91);
      this.h2[i] = hash01(i, 2, 92);
      this.h3[i] = hash01(i, 3, 93);
    }
    for (let i = 0; i < N; i++) {
      const x = this.fx[i] + pox;
      const y = this.fy[i] + poy;
      const dn = Math.hypot(this.fx[i] - hx, (this.fy[i] - hy) * 0.9) / dmax;
      this.t0[i] = (1 - dn) * 0.4 + this.h1[i] * 0.15;
      // land on the circle near where the dot already is
      const th = Math.atan2(y - cy, x - cx);
      let s = (TH0 - th) / SPAN;
      s -= Math.floor(s);
      this.sig[i] = Math.min(0.98, s);
      // a narrow band, like the ribbon strands
      this.off[i] = (this.h2[i] - 0.5) * 14 + (this.h3[i] - 0.5) * 2;
    }

    // board targets: one halftone grid per card / strip, ~N cells overall
    const boxes = targets.map((t) => {
      const strip = t.querySelector<HTMLElement>(".wk-strip");
      const r = t.getBoundingClientRect();
      if (!strip || t.classList.contains("wk-pair-frame"))
        return {
          x: r.left - sr.left,
          y: r.top - sr.top,
          w: r.width,
          h: r.height,
          skew: false,
          px: 0,
          py: 0,
        };
      return {
        x: r.left - sr.left + strip.offsetLeft,
        y: r.top - sr.top + strip.offsetTop,
        w: strip.offsetWidth,
        h: strip.offsetHeight,
        skew: true,
        px: r.left - sr.left + r.width / 2,
        py: r.top - sr.top + r.height / 2,
      };
    });
    const area = boxes.reduce((s, b) => s + b.w * b.h, 0);
    const pitch = Math.max(3.5, Math.sqrt(area / (N * 0.97)));
    this.tk.fill(-1);
    const order = Uint32Array.from({ length: N }, (_, i) => i);
    for (let i = N - 1; i > 0; i--) {
      const j = Math.floor(hash01(i, 5, 77) * (i + 1));
      const t = order[i];
      order[i] = order[j];
      order[j] = t;
    }
    let q = 0;
    const cosR = Math.cos(ROT);
    const sinR = Math.sin(ROT);
    boxes.forEach((b, k) => {
      if (b.w < 4 || b.h < 4) return;
      const G = sampleDots(painters[k], b.w, b.h, pitch);
      for (let c = 0; c < G.n && q < N; c++, q++) {
        const i = order[q];
        let x = b.x + G.u[c] * b.w;
        let y = b.y + G.v[c] * b.h;
        if (b.skew) {
          // rotateY(-12deg) skewX(-9deg), origin right centre, parent
          // perspective 1200px about the wrapper centre
          const ox = b.x + b.w;
          const oy = b.y + b.h / 2;
          const lx = x - ox + SKEW * (y - oy);
          const ly = y - oy;
          const rx = lx * cosR;
          const rz = -lx * sinR;
          const f = PERSP / (PERSP - rz);
          x = b.px + (ox + rx - b.px) * f;
          y = b.py + (oy + ly - b.py) * f;
        }
        this.tk[i] = k;
        this.tx[i] = x;
        this.ty[i] = y;
        this.tr[i] = G.r[c];
        this.tred[i] = G.red[c];
      }
    });

    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    this.g = {
      W,
      H,
      dpr,
      pox,
      poy,
      headX: hx,
      headY: hy,
      cx,
      cy,
      R,
      dmax,
      faceLayer,
      work,
      us,
      ux,
      uy,
      base1,
      base2,
      T,
      tLen,
    };
    this.n = N;
    this.ready = true;
    this.update(this.p);
  }

  private alloc(N: number) {
    const f = () => new Float32Array(N);
    this.fx = f();
    this.fy = f();
    this.fr = f();
    this.t0 = f();
    this.sig = f();
    this.off = f();
    this.h1 = f();
    this.h2 = f();
    this.h3 = f();
    this.tx = f();
    this.ty = f();
    this.tr = f();
    this.tk = new Int8Array(N);
    this.tred = new Uint8Array(N);
    this.X = f();
    this.Y = f();
    this.Rr = f();
    this.C = new Uint8Array(N);
  }

  /** Spool state: a = rise into the circle, q = share still wound on it. */
  private spool(p: number) {
    return {
      a: easeInOut(norm(p, 0, 0.16)),
      q: 1 - easeInOut(norm(p, 0.36, 0.58)),
    };
  }

  /**
   * Point + unit normal on the wound-off string at parameter s (a = 1).
   * s ≤ q lies on the circle (which turns as it unwinds, the arc always
   * ending at the leave point); s > q runs out along the thread, and past
   * its end continues straight off-screen.
   */
  private onString(s: number, q: number, out: number[]) {
    const g = this.g!;
    if (s <= q) {
      const th = THL + (q - s) * SPAN;
      const c = Math.cos(th);
      const n = Math.sin(th);
      out[0] = g.cx + g.R * c;
      out[1] = g.cy + g.R * n;
      out[2] = c;
      out[3] = n;
      return;
    }
    const T = g.T;
    const t = s - q;
    const tt = Math.min(1, t);
    const x = bz(T[0], T[2], T[4], T[6], tt);
    const y = bz(T[1], T[3], T[5], T[7], tt);
    const m = 1 - tt;
    let dx =
      3 * m * m * (T[2] - T[0]) +
      6 * m * tt * (T[4] - T[2]) +
      3 * tt * tt * (T[6] - T[4]);
    let dy =
      3 * m * m * (T[3] - T[1]) +
      6 * m * tt * (T[5] - T[3]) +
      3 * tt * tt * (T[7] - T[5]);
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    const k = t > 1 ? (t - 1) * g.tLen : 0;
    out[0] = x + dx * k;
    out[1] = y + dy * k;
    out[2] = -dy;
    out[3] = dx;
  }

  /** Ribbon geometry for progress p (stage px) into this.path / this.path2. */
  private shape(p: number) {
    const g = this.g!;
    const { a, q } = this.spool(p);
    const { cx, cy, R, base1, base2 } = g;
    const pt = [0, 0, 0, 0];
    for (let i = 0; i < M; i++) {
      const s = i / (M - 1);
      this.onString(s, q, pt);
      this.path[i * 2] = base1[i * 2] + (pt[0] - base1[i * 2]) * a;
      this.path[i * 2 + 1] = base1[i * 2 + 1] + (pt[1] - base1[i * 2 + 1]) * a;
      // the second ribbon merges into the same circle, slightly out of phase
      const th2 = TH0 - s * SPAN - 0.35;
      const k2x = cx + (R + 6) * Math.cos(th2);
      const k2y = cy + (R + 6) * Math.sin(th2);
      this.path2[i * 2] = base2[i * 2] + (k2x - base2[i * 2]) * a;
      this.path2[i * 2 + 1] = base2[i * 2 + 1] + (k2y - base2[i * 2 + 1]) * a;
    }
    for (let i = 0; i < M; i++) {
      const i0 = Math.max(0, i - 1);
      const i1 = Math.min(M - 1, i + 1);
      const dx = this.path[i1 * 2] - this.path[i0 * 2];
      const dy = this.path[i1 * 2 + 1] - this.path[i0 * 2 + 1];
      const l = Math.hypot(dx, dy) || 1;
      this.nrm[i * 2] = -dy / l;
      this.nrm[i * 2 + 1] = dx / l;
    }
  }

  private toD(pts: Float32Array) {
    const { us, ux, uy } = this.g!;
    let d = "";
    for (let i = 0; i < M; i++) {
      const x = pts[i * 2] * us + ux;
      const y = pts[i * 2 + 1] * us + uy;
      d += `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    return d;
  }

  /** Point on the current ribbon at parameter s (extrapolated past 1). */
  private at(s: number, off: number, out: number[], p: number) {
    const { a, q } = this.spool(p);
    if (a >= 1) {
      const r = this.tmp;
      this.onString(s, q, r);
      out[0] = r[0] + r[2] * off;
      out[1] = r[1] + r[3] * off;
      return;
    }
    const P = this.path;
    const Nn = this.nrm;
    const e = (M - 1) * 2;
    if (s >= 1) {
      const dx = P[e] - P[e - 2];
      const dy = P[e + 1] - P[e - 1];
      const k = (s - 1) * (M - 1);
      out[0] = P[e] + dx * k + Nn[e] * off;
      out[1] = P[e + 1] + dy * k + Nn[e + 1] * off;
      return;
    }
    const f = Math.max(0, s) * (M - 1);
    const i = Math.floor(f);
    const t = f - i;
    const j = Math.min(M - 1, i + 1);
    out[0] = P[i * 2] + (P[j * 2] - P[i * 2]) * t + Nn[i * 2] * off;
    out[1] =
      P[i * 2 + 1] + (P[j * 2 + 1] - P[i * 2 + 1]) * t + Nn[i * 2 + 1] * off;
  }

  /** Sync DOM state for progress p (called from the ScrollTrigger). */
  update(p: number) {
    if (this.destroyed) return;
    this.p = p;
    const { slideOut, ribbon, ribbon2, portrait, canvas, board } = this.els;
    const rest = p <= 0;
    const a = easeInOut(norm(p, 0, 0.16));

    for (const el of slideOut) {
      if (rest) {
        el.style.removeProperty("transform");
        el.style.removeProperty("opacity");
        el.style.removeProperty("transition");
        el.style.removeProperty("visibility");
      } else {
        el.style.transition = "none";
        el.style.transform = `translate3d(${(-a * 14).toFixed(3)}vw,0,0)`;
        el.style.opacity = (1 - a).toFixed(3);
        el.style.visibility = a >= 1 ? "hidden" : "";
      }
    }

    // ribbons: rise into one circle, then unspool into the thread
    if (this.ready && this.g && !rest) {
      this.shape(p);
      this.p1?.setAttribute("d", this.toD(this.path));
      this.p2?.setAttribute("d", this.toD(this.path2));
    } else {
      this.p1?.setAttribute("d", this.d1);
      this.p2?.setAttribute("d", this.d2);
    }
    if (ribbon) {
      if (rest) ribbon.style.removeProperty("opacity");
      else ribbon.style.opacity = (1 - norm(p, 0.8, 0.92)).toFixed(3);
    }
    if (ribbon2) {
      if (rest) ribbon2.style.removeProperty("opacity");
      else
        ribbon2.style.opacity = (
          0.55 *
          (1 - 0.5 * a) *
          (1 - norm(p, 0.3, 0.42))
        ).toFixed(3);
    }

    // the board builds in place
    const done = p >= 1;
    const frame = done ? 1 : easeInOut(norm(p, 0.66, 0.84));
    const text = done ? 1 : norm(p, 0.72, 0.92);
    const img = done
      ? 1
      : easeInOut(norm(p, this.ready ? 0.84 : 0.7, 0.94));
    board.style.setProperty("--bd-frame", frame.toFixed(3));
    board.style.setProperty("--bd-text", text.toFixed(3));
    board.style.setProperty("--bd-img", img.toFixed(3));
    board.style.pointerEvents = text > 0.6 ? "" : "none";

    const streaming = this.ready && p >= P_SWAP && p < 1;
    portrait.style.visibility = this.ready && p >= P_SWAP ? "hidden" : "";
    canvas.style.visibility = streaming ? "visible" : "hidden";
    if (streaming && !this.raf) this.raf = requestAnimationFrame(this.draw);
  }

  private draw = () => {
    this.raf = 0;
    const g = this.g;
    if (!g || this.destroyed) return;
    const p = this.p;
    const ctx = this.ctx;
    const { dpr } = g;
    const vw = innerWidth;
    const vh = innerHeight;
    const cw = Math.round(vw * dpr);
    const ch = Math.round(vh * dpr);
    if (this.els.canvas.width !== cw || this.els.canvas.height !== ch) {
      this.els.canvas.width = cw;
      this.els.canvas.height = ch;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    if (p < P_SWAP || p >= 1) return;
    this.shape(p);

    const sr = this.els.stage.getBoundingClientRect();
    const ox = sr.left;
    const oy = sr.top;
    const b = norm(p, P_SWAP, 0.4);
    const c = norm(p, 0.36, 0.62);
    const d = norm(p, 0.6, 0.9);
    const fade = 1 - norm(p, 0.88, 0.96);
    const { pox, poy, headX, headY, dmax } = g;

    // the not-yet-peeled face: the exact portrait layer, eroded outside in
    if (b < 1) {
      const front = 1 - (b - 0.075) / 0.4;
      const wctx = g.work.getContext("2d")!;
      wctx.globalCompositeOperation = "copy";
      wctx.setTransform(1, 0, 0, 1, 0, 0);
      wctx.drawImage(g.faceLayer, 0, 0);
      if (front < 1.05) {
        wctx.globalCompositeOperation = "destination-in";
        wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const rOut = Math.max(0.001, front * dmax);
        const soft = dmax * 0.08;
        const grad = wctx.createRadialGradient(
          headX,
          headY,
          Math.max(0, rOut - soft),
          headX,
          headY,
          rOut + 0.001,
        );
        grad.addColorStop(0, "#000");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        wctx.fillStyle = grad;
        wctx.fillRect(0, 0, g.W, g.H);
      }
      wctx.globalCompositeOperation = "source-over";
      ctx.drawImage(
        g.work,
        Math.round((ox + pox) * dpr),
        Math.round((oy + poy) * dpr),
      );
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const N = this.n;
    const { X, Y, Rr, C } = this;
    const pt = [0, 0];
    const edge = (off: number) => (off < -5 ? 1 : off > 5 ? 2 : 0);
    for (let i = 0; i < N; i++) {
      const h1 = this.h1[i];
      const h2 = this.h2[i];
      const h3 = this.h3[i];
      const off = this.off[i];
      let x = this.fx[i] + pox;
      let y = this.fy[i] + poy;
      let r = this.fr[i];
      let col = 0;
      const qq = (b - this.t0[i]) / 0.45;
      if (qq > 0) {
        // pour into the circle, ease a little along it, then ride the thread
        const j = easeInOut(clamp01(qq / 0.5));
        let s = this.sig[i] + 0.08 * clamp01(qq);
        const k = easeIn(clamp01((c - h3 * 0.3) / 0.7));
        s += k * (1.3 + 0.2 * h1 - s);
        this.at(s, off, pt, p);
        const curl = Math.sin(Math.PI * j) * (h1 - 0.5) * 36;
        x = x + (pt[0] - x) * j + curl;
        y = y + (pt[1] - y) * j - curl * 0.5;
        r = r + (0.9 + h1 * 0.8 - r) * j;
        if (j > 0.5) col = edge(off);
      }
      if (d > 0) {
        if (this.tk[i] < 0) {
          col = 3;
        } else {
          const gam = clamp01((d - h1 * 0.45) / 0.55);
          if (gam > 0) {
            // back in along the thread, then peel off onto the board
            const sx = 0.2 + 0.65 * h2;
            const g1 = easeOut(clamp01(gam / 0.6));
            this.at(1.3 + (sx - 1.3) * g1, off, pt, p);
            const g2 = easeInOut(clamp01((gam - 0.4) / 0.6));
            const r0 = 0.9 + h1 * 0.8;
            x = pt[0] + (this.tx[i] - pt[0]) * g2;
            y = pt[1] + (this.ty[i] - pt[1]) * g2;
            r = r0 + (this.tr[i] - r0) * g2;
            col = g2 > 0.5 ? (this.tred[i] ? 1 : 0) : edge(off);
          }
        }
      }
      x += ox;
      y += oy;
      if (x < -10 || x > vw + 10 || y < -10 || y > vh + 10) col = 3;
      X[i] = x;
      Y[i] = y;
      Rr[i] = r;
      C[i] = col;
    }
    ctx.globalAlpha = fade;
    const cols = [this.pal.ink, this.pal.red, this.pal.cyan];
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = cols[k];
      fillDots(ctx, X, Y, Rr, (i) => C[i] === k, N);
    }
    ctx.globalAlpha = 1;
  };

  isReady() {
    return this.ready;
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const { slideOut, ribbon, ribbon2, portrait, canvas, board } = this.els;
    for (const el of slideOut) {
      el.style.removeProperty("transform");
      el.style.removeProperty("opacity");
      el.style.removeProperty("transition");
      el.style.removeProperty("visibility");
    }
    ribbon?.style.removeProperty("opacity");
    ribbon2?.style.removeProperty("opacity");
    this.p1?.setAttribute("d", this.d1);
    this.p2?.setAttribute("d", this.d2);
    for (const v of ["--bd-frame", "--bd-text", "--bd-img"])
      board.style.removeProperty(v);
    board.style.removeProperty("pointer-events");
    portrait.style.visibility = "";
    canvas.style.visibility = "hidden";
  }
}
