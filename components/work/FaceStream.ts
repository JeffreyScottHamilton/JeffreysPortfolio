/**
 * Work hero → projects set piece (desktop, motion allowed).
 *
 * Driven by one scrubbed progress value p ∈ [0, 1]:
 *   0.00–0.25  the hero ribbon tightens into a loop around the portrait; copy,
 *              certificates and experience slide out to the left
 *   0.20–0.55  the portrait's own halftone dots (same field as <Portrait/>,
 *              rebuilt from lib/halftone for the same box) peel off, outer edge
 *              first, and circle the loop
 *   0.48–0.66  the stream unspools off to the right
 *   0.58–0.95  Plainkit / Bedulo slide in from the right; the particles land on
 *              a halftone rendering of each preview
 *   0.90–1.00  the real previews cross-fade in over the dots
 *
 * Everything is a pure function of p (reversible, no per-particle state).
 * Drawing happens in a single rAF that is only scheduled when p changes.
 */
import {
  buildHalftone,
  computeLayout,
  drawField,
  hash01,
  loadCutout,
  palette,
  type Layout,
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
  sampleDots,
  type DotGrid,
  type Painter,
} from "./dots";

export type StreamEls = {
  canvas: HTMLCanvasElement;
  hero: HTMLElement;
  portrait: HTMLElement; // the .portrait root inside .wk-hero-portrait
  ribbon: SVGSVGElement | null; // main hero ribbon
  ribbon2: SVGSVGElement | null;
  slideOut: HTMLElement[]; // copy, orbit, experience, floating letters
  items: HTMLElement[]; // .wk-pair-item
  frames: HTMLElement[]; // .wk-pair-frame
};

const P_SWAP = 0.2;
const TAU = Math.PI * 2;

type Geo = {
  W: number;
  H: number;
  dpr: number;
  heroW: number;
  heroH: number;
  pox: number;
  poy: number;
  L: Layout;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  dmax: number;
  faceLayer: HTMLCanvasElement;
  work: HTMLCanvasElement;
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
  private th = new Float32Array(0);
  private off = new Float32Array(0);
  private spin = new Float32Array(0);
  private h1 = new Float32Array(0);
  private h2 = new Float32Array(0);
  private h3 = new Float32Array(0);
  private tk = new Int8Array(0);
  private tu = new Float32Array(0);
  private tv = new Float32Array(0);
  private tr = new Float32Array(0);
  private tred = new Uint8Array(0);
  // per-frame scratch
  private X = new Float32Array(0);
  private Y = new Float32Array(0);
  private R = new Float32Array(0);
  private C = new Uint8Array(0); // 0 ink, 1 red, 2 cyan, 3 hidden

  // ribbon morph
  private baseD = "";
  private base: number[] = [];
  private loop: number[] = [];
  private pathEl: SVGPathElement | null = null;

  constructor(
    els: StreamEls,
    private maxParticles: number,
  ) {
    const ctx = els.canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    this.els = els;
    this.ctx = ctx;
    this.pathEl = els.ribbon?.querySelector("defs path") ?? null;
    this.baseD = this.pathEl?.getAttribute("d") ?? "";
    this.base = (this.baseD.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  }

  /** (Re)measures the layout and rebuilds dot fields. Safe to call on resize. */
  async build() {
    const id = ++this.buildId;
    const { hero, portrait, frames, canvas } = this.els;
    const W = Math.round(portrait.clientWidth);
    const H = Math.round(portrait.clientHeight);
    if (W < 40 || H < 40 || frames.length < 2) return;
    const fam = getComputedStyle(portrait).fontFamily || "sans-serif";
    const sources: Promise<Painter>[] = frames.map((f) => {
      const img = f.querySelector("img");
      return img
        ? loadImage(img.currentSrc || img.src).then((im) =>
            coverPainter(im, 0, 0),
          )
        : Promise.resolve(journalPainter);
    });
    let face: HTMLImageElement;
    let painters: Painter[];
    try {
      [face, painters] = await Promise.all([
        loadCutout(),
        Promise.all(sources),
      ]);
    } catch {
      return;
    }
    if (this.destroyed || id !== this.buildId) return;

    const hr = hero.getBoundingClientRect();
    const pr = portrait.getBoundingClientRect();
    const pox = Math.round(pr.left - hr.left);
    const poy = Math.round(pr.top - hr.top);
    const heroW = hero.clientWidth;
    const heroH = hero.clientHeight;
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

    // loop around the bust (hero-local px)
    const cx = pox + L.dx + L.dw * 0.5;
    let cy = poy + L.dy + L.dh * 0.52;
    let ry = L.dh * 0.56;
    ry = Math.min(ry, heroH - cy - 14);
    if (cy - ry < 70) {
      cy = Math.min(heroH - 14 - ry, 70 + ry);
    }
    const rx = Math.min(L.dw * 0.64, cx - 40, heroW - cx - 24);

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
      const x = F.x[k];
      const y = F.y[k];
      this.fx[i] = x;
      this.fy[i] = y;
      this.fr[i] = F.g[k] >= 0 ? F.pitch * 0.35 : F.r[k];
      dmax = Math.max(dmax, Math.hypot(x - hx, (y - hy) * 0.9));
      this.h1[i] = hash01(i, 1, 91);
      this.h2[i] = hash01(i, 2, 92);
      this.h3[i] = hash01(i, 3, 93);
    }
    for (let i = 0; i < N; i++) {
      const x = this.fx[i] + pox;
      const y = this.fy[i] + poy;
      const dn = Math.hypot(this.fx[i] - hx, (this.fy[i] - hy) * 0.9) / dmax;
      // outer edge first, centre last, with seeded noise
      this.t0[i] = (1 - dn) * 0.4 + this.h1[i] * 0.15;
      this.th[i] = Math.atan2((y - cy) / ry, (x - cx) / rx);
      this.off[i] = (this.h2[i] - 0.5) * 2 * 16 + (this.h3[i] - 0.5) * 6;
      this.spin[i] = TAU * (0.7 + 0.5 * this.h3[i]);
    }

    // preview targets: one halftone grid per frame, sized to ~N cells
    const sizes = frames.map((f) => [f.clientWidth, f.clientHeight] as const);
    const area = sizes.reduce((s, [w, h]) => s + w * h, 0);
    const pitch = Math.max(4, Math.sqrt(area / (N * 0.97)));
    const grids: DotGrid[] = sizes.map(([w, h], k) =>
      sampleDots(painters[k], w, h, pitch),
    );
    this.tk.fill(-1);
    // seeded shuffle so neighbours on the face scatter across the previews
    const order = Uint32Array.from({ length: N }, (_, i) => i);
    for (let i = N - 1; i > 0; i--) {
      const j = Math.floor(hash01(i, 5, 77) * (i + 1));
      const t = order[i];
      order[i] = order[j];
      order[j] = t;
    }
    let q = 0;
    grids.forEach((G, k) => {
      for (let c = 0; c < G.n && q < N; c++, q++) {
        const i = order[q];
        this.tk[i] = k;
        this.tu[i] = G.u[c];
        this.tv[i] = G.v[c];
        this.tr[i] = G.r[c];
        this.tred[i] = G.red[c];
      }
    });

    // ribbon loop in the SVG's user units
    this.loop = [];
    const svg = this.els.ribbon;
    const m = svg?.getScreenCTM();
    if (svg && m && this.base.length === 32) {
      const inv = m.inverse();
      const u = (x: number, y: number) => [
        inv.a * (x + hr.left) + inv.c * (y + hr.top) + inv.e,
        inv.b * (x + hr.left) + inv.d * (y + hr.top) + inv.f,
      ];
      const E = (a: number) => [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
      const D = (a: number) => [rx * Math.sin(a), -ry * Math.cos(a)]; // motion for decreasing angle
      const a0 = Math.PI / 2;
      const span = TAU + 0.5;
      const d = span / 4;
      const kk = (4 / 3) * Math.tan(d / 4);
      // start stays where the hero ribbon starts
      const start = [this.base[0], this.base[1]];
      const out: number[] = [...start];
      const e0 = E(a0);
      const d0 = D(a0);
      const e0u = u(e0[0], e0[1]);
      const c1 = u(e0[0] - rx * 1.1, e0[1] + 30);
      const c2 = u(e0[0] - d0[0] * 0.6, e0[1] - d0[1] * 0.6);
      out.push(c1[0], c1[1], c2[0], c2[1], e0u[0], e0u[1]);
      for (let s = 0; s < 4; s++) {
        const a = a0 - s * d;
        const b = a - d;
        const P0 = E(a);
        const P3 = E(b);
        const Da = D(a);
        const Db = D(b);
        const C1 = u(P0[0] + kk * Da[0], P0[1] + kk * Da[1]);
        const C2 = u(P3[0] - kk * Db[0], P3[1] - kk * Db[1]);
        const P3u = u(P3[0], P3[1]);
        out.push(C1[0], C1[1], C2[0], C2[1], P3u[0], P3u[1]);
      }
      this.loop = out;
    }

    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    this.g = {
      W,
      H,
      dpr,
      heroW,
      heroH,
      pox,
      poy,
      L,
      cx,
      cy,
      rx,
      ry,
      dmax,
      faceLayer,
      work,
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
    this.th = f();
    this.off = f();
    this.spin = f();
    this.h1 = f();
    this.h2 = f();
    this.h3 = f();
    this.tk = new Int8Array(N);
    this.tu = f();
    this.tv = f();
    this.tr = f();
    this.tred = new Uint8Array(N);
    this.X = f();
    this.Y = f();
    this.R = f();
    this.C = new Uint8Array(N);
  }

  /** Sync DOM state for progress p (called from the ScrollTrigger). */
  update(p: number) {
    if (this.destroyed) return;
    this.p = p;
    const { slideOut, ribbon, ribbon2, items, frames, portrait, canvas } =
      this.els;
    const rest = p <= 0;
    const a = easeInOut(norm(p, 0, 0.25));

    for (const el of slideOut) {
      if (rest) {
        el.style.removeProperty("transform");
        el.style.removeProperty("opacity");
        el.style.removeProperty("transition");
      } else {
        el.style.transition = "none";
        el.style.transform = `translate3d(${(-a * 14).toFixed(3)}vw,0,0)`;
        el.style.opacity = (1 - a).toFixed(3);
      }
    }

    // ribbon: tighten into the loop, then let go as the stream leaves
    if (this.pathEl) {
      if (rest || !this.loop.length) {
        this.pathEl.setAttribute("d", this.baseD);
      } else {
        const v = this.base.map((b, i) => b + (this.loop[i] - b) * a);
        let d = `M${v[0].toFixed(1)},${v[1].toFixed(1)}`;
        for (let i = 2; i < v.length; i += 6)
          d += ` C${v[i].toFixed(1)},${v[i + 1].toFixed(1)} ${v[i + 2].toFixed(1)},${v[i + 3].toFixed(1)} ${v[i + 4].toFixed(1)},${v[i + 5].toFixed(1)}`;
        this.pathEl.setAttribute("d", d);
      }
    }
    if (ribbon) {
      if (rest) ribbon.style.removeProperty("opacity");
      else ribbon.style.opacity = (1 - norm(p, 0.46, 0.62)).toFixed(3);
    }
    if (ribbon2) {
      if (rest) ribbon2.style.removeProperty("opacity");
      else ribbon2.style.opacity = (0.55 * (1 - norm(p, 0, 0.15))).toFixed(3);
    }

    // previews slide in from the right
    const done = p >= 1;
    const slide = 1 - easeOut(norm(p, 0.58, 0.95));
    for (const it of items) {
      if (done) it.style.removeProperty("transform");
      else it.style.transform = `translate3d(${(slide * 62).toFixed(3)}vw,0,0)`;
    }
    const reveal = this.ready ? easeInOut(norm(p, 0.88, 0.98)) : 1;
    for (const f of frames) {
      if (done || reveal >= 1) f.style.removeProperty("opacity");
      else f.style.opacity = reveal.toFixed(3);
    }

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
    if (
      this.els.canvas.width !== Math.round(vw * dpr) ||
      this.els.canvas.height !== Math.round(vh * dpr)
    ) {
      this.els.canvas.width = Math.round(vw * dpr);
      this.els.canvas.height = Math.round(vh * dpr);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.els.canvas.width, this.els.canvas.height);
    if (p < P_SWAP || p >= 1) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const hr = this.els.hero.getBoundingClientRect();
    const ox = hr.left;
    const oy = hr.top;
    const rects = this.els.frames.map((f) => f.getBoundingClientRect());

    const b = norm(p, P_SWAP, 0.55);
    const e = norm(p, 0.48, 0.66);
    const gc = norm(p, 0.6, 0.93);
    const fade = 1 - norm(p, 0.92, 0.995);
    const { cx, cy, rx, ry, pox, poy, L, dmax } = g;

    // the not-yet-peeled face: the exact portrait layer, eroded from outside in
    if (b < 1) {
      const front = 1 - (b - 0.075) / 0.4; // normalised radius still intact
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
          L.headX,
          L.headY,
          Math.max(0, rOut - soft),
          L.headX,
          L.headY,
          rOut + 0.001,
        );
        grad.addColorStop(0, "#000");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        wctx.fillStyle = grad;
        wctx.fillRect(0, 0, g.W, g.H);
      }
      wctx.globalCompositeOperation = "source-over";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(
        g.work,
        Math.round((ox + pox) * dpr),
        Math.round((oy + poy) * dpr),
      );
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const N = this.n;
    const { X, Y, R, C } = this;
    const exitX = vw + 60;
    for (let i = 0; i < N; i++) {
      const h1 = this.h1[i];
      const h2 = this.h2[i];
      const h3 = this.h3[i];
      let x = this.fx[i] + pox;
      let y = this.fy[i] + poy;
      let r = this.fr[i];
      let c = 0;
      const qq = (b - this.t0[i]) / 0.45;
      if (qq > 0) {
        const off = this.off[i];
        const j = easeInOut(clamp01(qq / 0.35));
        const ang =
          this.th[i] - (this.spin[i] * Math.max(0, qq - 0.35)) / 0.65 - e * 1.4;
        const ex = cx + (rx + off) * Math.cos(ang);
        const ey = cy + (ry + off) * Math.sin(ang);
        const curl = Math.sin(Math.PI * j) * (h1 - 0.5) * 40;
        x = x + (ex - x) * j + curl;
        y = y + (ey - y) * j - curl * 0.5;
        r = r + (0.9 + h1 * 0.9 - r) * j;
        if (j > 0.5) c = off < -12 ? 1 : off > 12 ? 2 : 0;
      }
      // hero-local → viewport
      x += ox;
      y += oy;
      if (e > 0) {
        const eps = clamp01((e - h3 * 0.45) / 0.55);
        if (eps > 0) {
          const k = easeIn(eps);
          x = x + (exitX + h2 * 240 - x) * k;
          y =
            y +
            (oy + cy + this.off[i] * 2.4 + (h1 - 0.5) * 90 - y) *
              easeInOut(eps);
        }
      }
      if (gc > 0) {
        const t = this.tk[i];
        if (t < 0) {
          c = 3;
        } else {
          const gam = clamp01((gc - h1 * 0.35) / 0.65);
          if (gam > 0) {
            const rc = rects[t];
            const tx = rc.left + this.tu[i] * rc.width;
            const ty = rc.top + this.tv[i] * rc.height;
            const sx = exitX + h2 * 240 + h3 * vw * 0.25;
            const ge = easeOut(gam);
            x = sx + (tx - sx) * ge;
            y = y + (ty - y) * ge + Math.sin(Math.PI * gam) * (h3 - 0.5) * 70;
            r = r + (this.tr[i] - r) * ge;
            c = gam > 0.6 && this.tred[i] ? 1 : gam > 0.4 ? 0 : c;
          }
        }
      }
      if (x < -10 || x > vw + 10 || y < -10 || y > vh + 10) c = 3;
      X[i] = x;
      Y[i] = y;
      R[i] = r;
      C[i] = c;
    }
    ctx.globalAlpha = fade;
    const cols = [this.pal.ink, this.pal.red, this.pal.cyan];
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = cols[k];
      fillDots(ctx, X, Y, R, (i) => C[i] === k, N);
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
    const { slideOut, ribbon, ribbon2, items, frames, portrait, canvas } =
      this.els;
    for (const el of [...slideOut, ...items, ...frames]) {
      el.style.removeProperty("transform");
      el.style.removeProperty("opacity");
      el.style.removeProperty("transition");
    }
    ribbon?.style.removeProperty("opacity");
    ribbon2?.style.removeProperty("opacity");
    this.pathEl?.setAttribute("d", this.baseD);
    portrait.style.visibility = "";
    canvas.style.visibility = "hidden";
  }
}
