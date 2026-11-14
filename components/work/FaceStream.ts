/**
 * Work hero → project board set piece (desktop ≥1025, motion allowed).
 *
 * One pinned stage, driven by a single scrubbed progress p ∈ [0, 1]. The main
 * hero ribbon is a string that slides along one track:
 *   bottom ribbon → connector → the circle around the portrait (several laps)
 *   → a thread leaving the bottom of the ring, curving down → straight down.
 *
 *   0.00–0.16  the ribbon slides along itself and feeds INTO the circle (the
 *              letters ride it); copy and certificates fade left
 *   0.16–0.40  the line keeps circling the ring (≥ 1 lap); the portrait's own
 *              halftone dots peel off, outside first, and pour into it
 *   0.40–0.66  the line leaves the ring at the bottom and goes down (the view
 *              follows it down); the dots flow down the thread and peel off to
 *              build the two selected projects, large and centred
 *   0.60–0.75  frames, titles and the real pictures resolve; the dots give way
 *   0.76–0.84  the pair glides into its slot at the top of the board
 *   0.83–0.99  the other nine rows pop up one by one (dot flash on each strip)
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
  easeInOut,
  easeOut,
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
};

const TAU = Math.PI * 2;
const M = 220; // samples along the ribbon
const BOTTOM = Math.PI / 2; // ring entry / exit angle (screen y points down)
const SPAN2 = TAU * 1.04;
const TH2 = -0.75 * Math.PI + SPAN2;
const P_SWAP = 0.12;
const SKEW = Math.tan((-9 * Math.PI) / 180);
const ROT = (-12 * Math.PI) / 180;
const PERSP = 1200;
const ROW_CAP = 1200;

/* timeline */
const T_FEED = 0.16; // string fully on the ring
const T_EXIT = 0.4; // head reaches the exit at the bottom of the ring
const T_DONE = 0.66; // every dot has left the thread for its card
const POUR0 = P_SWAP;
const POUR1 = 0.4;
const CAM0 = 0.4;
const CAM1 = 0.58;
const FADE_PAIR0 = 0.68;
const FADE_PAIR1 = 0.75;
const GLIDE0 = 0.76;
const GLIDE1 = 0.84;
const ROW0 = 0.83;
const ROW_STEP = 0.0145;
const ROW_DUR = 0.045;

type Rect = { x: number; y: number; w: number; h: number };

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
  bn: Float32Array; // unit normals of base1
  /** track segment lengths (px): base ribbon, connector, ring laps, thread */
  Lb: number;
  Lc: number;
  Cc: number;
  Lt: number;
  CN: number[]; // connector Bézier (x0,y0,…,x3,y3)
  TH: number[]; // thread Bézier
  sEnd: number; // track position of the thread end
  lead: number;
  span: number;
  F1: number;
  F2: number;
  Fmax: number;
  camEnd: number;
  /** featured frames (viewport px at the end of the camera move) */
  feat: Rect[];
  slot: Rect[]; // pair frames in the finished board
  textD: { dx: number; dy: number }[];
  textS: number;
  rows: { cx: number; cy: number; start: number; end: number }[];
};

/** Cubic Bézier coordinate. */
const bz = (a: number, b: number, c: number, d: number, t: number) => {
  const m = 1 - t;
  return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d;
};
/** Cubic Bézier derivative. */
const bzd = (a: number, b: number, c: number, d: number, t: number) => {
  const m = 1 - t;
  return 3 * m * m * (b - a) + 6 * m * t * (c - b) + 3 * t * t * (d - c);
};
const bzLen = (P: number[]) => {
  let L = 0;
  for (let i = 1, px = P[0], py = P[1]; i <= 48; i++) {
    const x = bz(P[0], P[2], P[4], P[6], i / 48);
    const y = bz(P[1], P[3], P[5], P[7], i / 48);
    L += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return L;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

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

  // board parts
  private head: HTMLElement | null;
  private foot: HTMLElement | null;
  private pairFrames: HTMLElement[];
  private pairMedia: HTMLElement[];
  private pairText: HTMLElement[];
  private rowEls: HTMLElement[];

  // face particles
  private n = 0;
  private fx = new Float32Array(0);
  private fy = new Float32Array(0);
  private fr = new Float32Array(0);
  private t0 = new Float32Array(0);
  private sig = new Float32Array(0);
  private off = new Float32Array(0);
  private h1 = new Float32Array(0);
  private h2 = new Float32Array(0);
  private tx = new Float32Array(0); // featured card target, world px
  private ty = new Float32Array(0);
  private tr = new Float32Array(0);
  private tred = new Uint8Array(0);
  // row flash dots
  private nr = 0;
  private rx = new Float32Array(0);
  private ry = new Float32Array(0);
  private rr = new Float32Array(0);
  private rjx = new Float32Array(0);
  private rjy = new Float32Array(0);
  private rh = new Float32Array(0);
  private rred = new Uint8Array(0);
  // per-frame scratch
  private X = new Float32Array(0);
  private Y = new Float32Array(0);
  private Rr = new Float32Array(0);
  private C = new Uint8Array(0); // 0 ink, 1 red, 2 cyan, 3 hidden
  private path = new Float32Array(M * 2);
  private path2 = new Float32Array(M * 2);
  private pt = [0, 0, 0, 0];

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
    const b = els.board;
    const all = (s: string) => [...b.querySelectorAll<HTMLElement>(s)];
    this.head = b.querySelector<HTMLElement>(".wk-board-head");
    this.foot = b.querySelector<HTMLElement>(".wk-board-foot");
    this.pairFrames = all(".wk-pair-frame");
    this.pairMedia = all(".wk-pair-media");
    this.pairText = all(".wk-pair-text");
    this.rowEls = all(".wk-row");
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

  /** Clears every inline board style the timeline writes. */
  private resetBoard() {
    const { board } = this.els;
    for (const v of ["--bd-frame", "--bd-text", "--bd-img", "--bd-foot"])
      board.style.removeProperty(v);
    board.style.removeProperty("pointer-events");
    for (const m of this.pairMedia)
      for (const k of ["left", "top", "width", "height", "right", "bottom"])
        m.style.removeProperty(k);
    for (const t of this.pairText) t.style.removeProperty("transform");
    for (const r of this.rowEls) {
      r.style.removeProperty("--pop");
      r.style.removeProperty("--bd-img");
      r.style.removeProperty("pointer-events");
    }
  }

  /** (Re)measures the layout and rebuilds dot fields. Safe to call on resize. */
  async build() {
    const id = ++this.buildId;
    const { stage, portrait, canvas } = this.els;
    const W = Math.round(portrait.clientWidth);
    const H = Math.round(portrait.clientHeight);
    const rowTargets = this.rowEls
      .map((r) => r.querySelector<HTMLElement>(".wk-bd-target"))
      .filter((t): t is HTMLElement => !!t);
    if (W < 40 || H < 40 || this.pairFrames.length < 2) return;
    const fam = getComputedStyle(portrait).fontFamily || "sans-serif";
    let face: HTMLImageElement;
    let pairP: Painter[];
    let rowP: Painter[];
    const safe = (t: HTMLElement) =>
      this.painter(t).catch(() => pendingPainter);
    try {
      [face, pairP, rowP] = await Promise.all([
        loadCutout(),
        Promise.all(this.pairFrames.map(safe)),
        Promise.all(rowTargets.map(safe)),
      ]);
    } catch {
      return;
    }
    if (this.destroyed || id !== this.buildId) return;

    // measure at rest: ribbon paths and board in their finished layout
    this.p1?.setAttribute("d", this.d1);
    this.p2?.setAttribute("d", this.d2);
    this.resetBoard();

    const sr = stage.getBoundingClientRect();
    const rel = (el: Element): Rect => {
      const r = el.getBoundingClientRect();
      return { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
    };
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
      if (!el) return { out, len: 0 };
      const len = el.getTotalLength();
      for (let i = 0; i < M; i++) {
        const q = el.getPointAtLength((len * i) / (M - 1));
        out[i * 2] = (q.x - ux) / us;
        out[i * 2 + 1] = (q.y - uy) / us;
      }
      return { out, len: len / us };
    };
    const s1 = sample(this.p1);
    const base1 = s1.out;
    const base2 = sample(this.p2).out;
    const Lb = Math.max(200, s1.len);
    const bn = new Float32Array(M * 2);
    for (let i = 0; i < M; i++) {
      const i0 = Math.max(0, i - 1);
      const i1 = Math.min(M - 1, i + 1);
      const dx = base1[i1 * 2] - base1[i0 * 2];
      const dy = base1[i1 * 2 + 1] - base1[i0 * 2 + 1];
      const l = Math.hypot(dx, dy) || 1;
      bn[i * 2] = -dy / l;
      bn[i * 2 + 1] = dx / l;
    }

    // connector: from the ribbon's end into the bottom of the ring, joining
    // it tangentially (heading right, i.e. anticlockwise on screen)
    const e = (M - 1) * 2;
    const Ex = base1[e];
    const Ey = base1[e + 1];
    let tx = Ex - base1[e - 2];
    let ty = Ey - base1[e - 1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const Bx = cx;
    const By = cy + R;
    const dd = Math.max(80, Math.hypot(Bx - Ex, By - Ey));
    const CN = [
      Ex,
      Ey,
      Ex + tx * dd * 0.45,
      Ey + ty * dd * 0.45,
      Bx - dd * 0.45,
      By,
      Bx,
      By,
    ];
    const Lc = bzLen(CN);
    // ring: whole laps, so the line leaves where it came in (the bottom);
    // long enough for the whole string to be wound plus ≥ 1 more lap
    const lap = TAU * R;
    const Cc = Math.ceil(Lb / lap + 1.05) * lap;

    // featured pair: two large frames, centred, side by side
    const head = this.head ? rel(this.head) : { x: 0, y: 0, w: 0, h: 80 };
    const gap = VW * 0.04;
    const fw = Math.min(VW * 0.44, (VW - gap - 48) / 2);
    const textH = 64;
    const fh = Math.max(
      160,
      Math.min(VH * 0.58, VH - (head.y + head.h) - 28 - textH - 20),
    );
    const fy = Math.max(head.y + head.h + 28, (VH - fh - textH) / 2);
    const fx0 = (VW - (fw * 2 + gap)) / 2;
    const feat: Rect[] = [0, 1].map((k) => ({
      x: fx0 + k * (fw + gap),
      y: fy,
      w: fw,
      h: fh,
    }));
    const slot = this.pairFrames.map(rel);
    const textS = 1.25;
    const textD = this.pairText.map((t, k) => {
      const r = rel(t);
      return { dx: feat[k].x - r.x, dy: feat[k].y + fh + 16 - r.y };
    });

    // thread: leaves the ring's bottom heading right, curves down into the
    // gap between the two featured frames (world px = viewport + camEnd)
    const camEnd = VH;
    const gx = VW / 2;
    const TH = [
      Bx,
      By,
      Bx + R * 0.9,
      By,
      gx,
      camEnd + fy - Math.max(160, VH * 0.3),
      gx,
      camEnd + fy + fh * 0.12,
    ];
    const Lt = bzLen(TH);
    const sEnd = Lb + Lc + Cc + Lt;
    const lead = Lt * 0.25;
    const span = Lt * 0.8;

    // face particles: an even, seeded subset of the live dots
    const live = F.live;
    const N = Math.max(1, Math.min(this.maxParticles - ROW_CAP, live.length));
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
    }

    const geo: Geo = {
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
      bn,
      Lb,
      Lc,
      Cc,
      Lt,
      CN,
      TH,
      sEnd,
      lead,
      span,
      F1: Lb + Lc,
      F2: Lc + Cc,
      Fmax: sEnd - lead + span,
      camEnd,
      feat,
      slot,
      textD,
      textS,
      rows: [],
    };
    this.g = geo;

    for (let i = 0; i < N; i++) {
      const x = this.fx[i] + pox;
      const y = this.fy[i] + poy;
      const dn = Math.hypot(this.fx[i] - hx, (this.fy[i] - hy) * 0.9) / dmax;
      this.t0[i] = (1 - dn) * 0.4 + this.h1[i] * 0.15;
      // land on the circling line near where the dot already is
      const pl = lerp(POUR0, POUR1, Math.min(1, this.t0[i] + 0.2));
      const th = Math.atan2(y - cy, x - cx);
      let a = (BOTTOM - th) * R;
      a = ((a % lap) + lap) % lap;
      let v = Lb + Lc + a - this.feed(pl);
      v = ((v % lap) + lap) % lap;
      this.sig[i] = v <= Lb * 0.98 ? v / Lb : this.h2[i] * 0.98;
      // a narrow band, like the ribbon strands
      this.off[i] = (this.h2[i] - 0.5) * 14 + (hash01(i, 3, 93) - 0.5) * 2;
    }

    // featured targets: one halftone grid per frame, ~N cells overall
    const area = feat.reduce((s, b) => s + b.w * b.h, 0);
    const pitch = Math.max(3.5, Math.sqrt(area / N));
    const order = Uint32Array.from({ length: N }, (_, i) => i);
    for (let i = N - 1; i > 0; i--) {
      const j = Math.floor(hash01(i, 5, 77) * (i + 1));
      const t = order[i];
      order[i] = order[j];
      order[j] = t;
    }
    const cells: number[] = []; // x, y, r, red
    feat.forEach((b, k) => {
      const G = sampleDots(pairP[k], b.w, b.h, pitch);
      for (let c = 0; c < G.n; c++)
        cells.push(b.x + G.u[c] * b.w, camEnd + b.y + G.v[c] * b.h, G.r[c], G.red[c]);
    });
    const nc = cells.length / 4;
    for (let q = 0; q < N; q++) {
      const i = order[q];
      // more dots than cells: double up rather than letting any fade away
      const c = nc ? (q % nc) * 4 : 0;
      this.tx[i] = nc ? cells[c] : gx;
      this.ty[i] = nc ? cells[c + 1] : camEnd + VH / 2;
      this.tr[i] = nc ? cells[c + 2] : 1;
      this.tred[i] = nc ? cells[c + 3] : 0;
    }

    // row strips: a brief dot flash as each row pops up
    const boxes = rowTargets.map((t) => {
      const strip = t.querySelector<HTMLElement>(".wk-strip");
      const r = rel(t);
      if (!strip) return { ...r, skew: false, px: 0, py: 0 };
      return {
        x: r.x + strip.offsetLeft,
        y: r.y + strip.offsetTop,
        w: strip.offsetWidth,
        h: strip.offsetHeight,
        skew: true,
        px: r.x + r.w / 2,
        py: r.y + r.h / 2,
      };
    });
    const rArea = boxes.reduce((s, b) => s + b.w * b.h, 0);
    const rPitch = Math.max(4, Math.sqrt(rArea / (ROW_CAP * 0.95)));
    const rx: number[] = [];
    const ry: number[] = [];
    const rr: number[] = [];
    const rred: number[] = [];
    const cosR = Math.cos(ROT);
    const sinR = Math.sin(ROT);
    boxes.forEach((b, k) => {
      const li = rel(this.rowEls[k]);
      const row = {
        cx: li.x + li.w / 2,
        cy: li.y + li.h / 2,
        start: rx.length,
        end: rx.length,
      };
      if (b.w >= 4 && b.h >= 4) {
        const G = sampleDots(rowP[k], b.w, b.h, rPitch);
        for (let c = 0; c < G.n && rx.length < ROW_CAP; c++) {
          let x = b.x + G.u[c] * b.w;
          let y = b.y + G.v[c] * b.h;
          if (b.skew) {
            // rotateY(-12deg) skewX(-9deg), origin right centre, parent
            // perspective 1200px about the wrapper centre
            const ox = b.x + b.w;
            const oy = b.y + b.h / 2;
            const lx = x - ox + SKEW * (y - oy);
            const ly = y - oy;
            const rxx = lx * cosR;
            const rz = -lx * sinR;
            const f = PERSP / (PERSP - rz);
            x = b.px + (ox + rxx - b.px) * f;
            y = b.py + (oy + ly - b.py) * f;
          }
          rx.push(x);
          ry.push(y);
          rr.push(G.r[c]);
          rred.push(G.red[c]);
        }
      }
      row.end = rx.length;
      geo.rows.push(row);
    });
    const NR = rx.length;
    this.nr = NR;
    this.rx = Float32Array.from(rx);
    this.ry = Float32Array.from(ry);
    this.rr = Float32Array.from(rr);
    this.rred = Uint8Array.from(rred);
    this.rjx = new Float32Array(NR);
    this.rjy = new Float32Array(NR);
    this.rh = new Float32Array(NR);
    for (let i = 0; i < NR; i++) {
      this.rjx[i] = (hash01(i, 11, 41) - 0.65) * 70;
      this.rjy[i] = (hash01(i, 12, 42) - 0.5) * 36;
      this.rh[i] = hash01(i, 13, 43);
    }
    const S = Math.max(N, NR);
    this.X = new Float32Array(S);
    this.Y = new Float32Array(S);
    this.Rr = new Float32Array(S);
    this.C = new Uint8Array(S);

    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
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
    this.tx = f();
    this.ty = f();
    this.tr = f();
    this.tred = new Uint8Array(N);
  }

  /** How far the string has slid along its track (px) at progress p. */
  private feed(p: number) {
    const g = this.g!;
    if (p <= 0) return 0;
    if (p < T_FEED) return g.F1 * Math.pow(p / T_FEED, 1.5);
    if (p < T_EXIT) return lerp(g.F1, g.F2, (p - T_FEED) / (T_EXIT - T_FEED));
    return lerp(g.F2, g.Fmax, this.exitShape(p));
  }

  /** Exit phase easing: constant speed leaving the ring, settling at the end. */
  private exitShape(p: number) {
    const u = norm(p, T_EXIT, T_DONE);
    // linear for the first 70 %, then eases out (C1 at the join)
    return u < 0.7 ? u * (1 / 0.85) : 1 - ((1 - u) * (1 - u)) / (0.3 * 2 * 0.85);
  }

  private cam(p: number) {
    return this.g!.camEnd * easeInOut(norm(p, CAM0, CAM1));
  }

  /** Point + unit normal at track position sg (px). */
  private track(sg: number, out: number[]) {
    const g = this.g!;
    if (sg < g.Lb) {
      const f = (Math.max(0, sg) / g.Lb) * (M - 1);
      const i = Math.min(M - 2, Math.floor(f));
      const t = f - i;
      const P = g.base1;
      out[0] = lerp(P[i * 2], P[i * 2 + 2], t);
      out[1] = lerp(P[i * 2 + 1], P[i * 2 + 3], t);
      out[2] = g.bn[i * 2];
      out[3] = g.bn[i * 2 + 1];
      return;
    }
    sg -= g.Lb;
    if (sg < g.Lc) {
      this.cubic(g.CN, sg / g.Lc, out);
      return;
    }
    sg -= g.Lc;
    if (sg < g.Cc) {
      const th = BOTTOM - sg / g.R;
      const c = Math.cos(th);
      const s = Math.sin(th);
      out[0] = g.cx + g.R * c;
      out[1] = g.cy + g.R * s;
      out[2] = c;
      out[3] = s;
      return;
    }
    sg -= g.Cc;
    if (sg < g.Lt) {
      this.cubic(g.TH, sg / g.Lt, out);
      return;
    }
    this.cubic(g.TH, 1, out);
    // straight on past the end (normal = (-dy, dx) → direction = (n.y, -n.x))
    const k = sg - g.Lt;
    out[0] += out[3] * k;
    out[1] -= out[2] * k;
  }

  private cubic(P: number[], t: number, out: number[]) {
    out[0] = bz(P[0], P[2], P[4], P[6], t);
    out[1] = bz(P[1], P[3], P[5], P[7], t);
    const dx = bzd(P[0], P[2], P[4], P[6], t);
    const dy = bzd(P[1], P[3], P[5], P[7], t);
    const l = Math.hypot(dx, dy) || 1;
    out[2] = -dy / l;
    out[3] = dx / l;
  }

  /** Ribbon geometry for progress p (viewport px) into path / path2. */
  private shape(p: number) {
    const g = this.g!;
    const Fd = this.feed(p);
    const cam = this.cam(p);
    const a2 = easeInOut(norm(p, 0, T_FEED));
    const pt = this.pt;
    for (let i = 0; i < M; i++) {
      const s = i / (M - 1);
      this.track(s * g.Lb + Fd, pt);
      this.path[i * 2] = pt[0];
      this.path[i * 2 + 1] = pt[1] - cam;
      // the second ribbon merges into the ring just outside, circling with it
      const th2 = TH2 - s * SPAN2 - Fd / g.R;
      const k2x = g.cx + (g.R + 6) * Math.cos(th2);
      const k2y = g.cy + (g.R + 6) * Math.sin(th2);
      const B = g.base2;
      this.path2[i * 2] = B[i * 2] + (k2x - B[i * 2]) * a2;
      this.path2[i * 2 + 1] = B[i * 2 + 1] + (k2y - B[i * 2 + 1]) * a2 - cam;
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

  /** Sync DOM state for progress p (called from the ScrollTrigger). */
  update(p: number) {
    if (this.destroyed) return;
    this.p = p;
    const { slideOut, ribbon, ribbon2, portrait, canvas, board } = this.els;
    const rest = p <= 0;
    const a = easeInOut(norm(p, 0, 0.14));
    const live = this.ready && !!this.g;

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

    // ribbons: feed into the ring, circle, then leave it going down
    if (live && !rest) {
      this.shape(p);
      this.p1?.setAttribute("d", this.toD(this.path));
      this.p2?.setAttribute("d", this.toD(this.path2));
    } else {
      this.p1?.setAttribute("d", this.d1);
      this.p2?.setAttribute("d", this.d2);
    }
    if (ribbon) {
      if (rest) ribbon.style.removeProperty("opacity");
      else ribbon.style.opacity = (1 - norm(p, 0.56, 0.68)).toFixed(3);
    }
    if (ribbon2) {
      if (rest) ribbon2.style.removeProperty("opacity");
      else
        ribbon2.style.opacity = (
          0.55 *
          (1 - 0.5 * a) *
          (1 - norm(p, 0.26, 0.38))
        ).toFixed(3);
    }

    // the board: the pair first (built by the dots), then the rows pop up
    const done = p >= 1;
    const set = (v: string, x: number) =>
      board.style.setProperty(v, (done ? 1 : x).toFixed(3));
    set("--bd-frame", easeInOut(norm(p, 0.6, 0.68)));
    set("--bd-text", norm(p, 0.62, 0.7));
    set("--bd-img", easeInOut(norm(p, live ? 0.66 : 0.6, 0.73)));
    set("--bd-foot", norm(p, 0.95, 0.98));
    board.style.pointerEvents = done || p >= 0.68 ? "" : "none";

    // featured → slot glide (needs the measured geometry)
    const g = this.g;
    const k = live && g && !done ? 1 - easeInOut(norm(p, GLIDE0, GLIDE1)) : 0;
    this.pairMedia.forEach((m, i) => {
      if (k <= 0 || !g) {
        for (const s of ["left", "top", "width", "height", "right", "bottom"])
          m.style.removeProperty(s);
        return;
      }
      const f = g.feat[i];
      const s = g.slot[i];
      m.style.right = "auto";
      m.style.bottom = "auto";
      m.style.left = `${((f.x - s.x) * k).toFixed(2)}px`;
      m.style.top = `${((f.y - s.y) * k).toFixed(2)}px`;
      m.style.width = `${lerp(s.w, f.w, k).toFixed(2)}px`;
      m.style.height = `${lerp(s.h, f.h, k).toFixed(2)}px`;
    });
    this.pairText.forEach((t, i) => {
      if (k <= 0 || !g) {
        t.style.removeProperty("transform");
        return;
      }
      const d = g.textD[i];
      t.style.transform = `translate3d(${(d.dx * k).toFixed(2)}px,${(d.dy * k).toFixed(2)}px,0) scale(${(1 + (g.textS - 1) * k).toFixed(4)})`;
    });
    this.rowEls.forEach((r, i) => {
      if (done) {
        r.style.removeProperty("--pop");
        r.style.removeProperty("--bd-img");
        r.style.removeProperty("pointer-events");
        return;
      }
      const t = norm(p, ROW0 + i * ROW_STEP, ROW0 + i * ROW_STEP + ROW_DUR);
      const pop = easeOut(norm(t, 0, 0.5));
      r.style.setProperty("--pop", pop.toFixed(3));
      r.style.setProperty("--bd-img", easeInOut(norm(t, 0.4, 0.8)).toFixed(3));
      r.style.pointerEvents = pop > 0.5 ? "" : "none";
    });

    const streaming = live && p >= P_SWAP && p < 1;
    portrait.style.visibility = live && p >= P_SWAP ? "hidden" : "";
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

    const sr = this.els.stage.getBoundingClientRect();
    const ox = sr.left;
    const oy = sr.top;
    const cam = this.cam(p);
    const b = norm(p, POUR0, POUR1);
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
        Math.round((oy + poy - cam) * dpr),
      );
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = [this.pal.ink, this.pal.red, this.pal.cyan];
    const { X, Y, Rr, C } = this;

    // face dots: pour into the ring, circle, flow down, build the pair
    const pairA = 1 - norm(p, FADE_PAIR0, FADE_PAIR1);
    if (pairA > 0) {
      const N = this.n;
      const Fd = this.feed(p);
      const pt = this.pt;
      const edge = (off: number) => (off < -5 ? 1 : off > 5 ? 2 : 0);
      for (let i = 0; i < N; i++) {
        const h1 = this.h1[i];
        const off = this.off[i];
        let x = this.fx[i] + pox;
        let y = this.fy[i] + poy;
        let r = this.fr[i];
        let col = 0;
        const qq = (b - this.t0[i]) / 0.45;
        if (qq > 0) {
          const j = easeInOut(clamp01(qq / 0.5));
          const sl = this.sig[i] * g.Lb;
          this.track(Math.min(sl + Fd, g.sEnd), pt);
          const curl = Math.sin(Math.PI * j) * (h1 - 0.5) * 36;
          const r0 = 0.9 + h1 * 0.8;
          x = x + (pt[0] + pt[2] * off - x) * j + curl;
          y = y + (pt[1] + pt[3] * off - y) * j - curl * 0.5;
          r = r + (r0 - r) * j;
          if (j > 0.5) col = edge(off);
          // reached the thread's end: peel off into the featured card
          const e = (Fd - (g.sEnd - g.lead - sl)) / g.span;
          if (e > 0) {
            const g2 = easeInOut(clamp01(e));
            const sw = Math.sin(Math.PI * g2) * (this.h2[i] - 0.5) * 30;
            x = x + (this.tx[i] - x) * g2 + sw;
            y = y + (this.ty[i] - y) * g2;
            r = r0 + (this.tr[i] - r0) * g2;
            col = g2 > 0.5 ? (this.tred[i] ? 1 : 0) : edge(off);
          }
        }
        x += ox;
        y += oy - cam;
        if (x < -10 || x > vw + 10 || y < -10 || y > vh + 10) col = 3;
        X[i] = x;
        Y[i] = y;
        Rr[i] = r;
        C[i] = col;
      }
      ctx.globalAlpha = pairA;
      this.fill(cols, 0, N);
    }

    // row flashes: each strip assembles briefly from dots as its row pops
    g.rows.forEach((row, k) => {
      const t = norm(p, ROW0 + k * ROW_STEP, ROW0 + k * ROW_STEP + ROW_DUR);
      if (t <= 0 || t >= 1 || row.end <= row.start) return;
      const alpha = clamp01(t * 5) * (1 - norm(t, 0.55, 1));
      if (alpha <= 0) return;
      const sc = 0.92 + 0.08 * easeOut(norm(t, 0, 0.5));
      for (let i = row.start; i < row.end; i++) {
        const e = easeOut(clamp01((t - this.rh[i] * 0.2) / 0.35));
        const x = row.cx + (this.rx[i] + this.rjx[i] * (1 - e) - row.cx) * sc;
        const y = row.cy + (this.ry[i] + this.rjy[i] * (1 - e) - row.cy) * sc;
        X[i] = x + ox;
        Y[i] = y + oy;
        Rr[i] = this.rr[i] * (0.4 + 0.6 * e);
        C[i] = this.rred[i] ? 1 : 0;
      }
      ctx.globalAlpha = alpha;
      this.fill(cols, row.start, row.end);
    });
    ctx.globalAlpha = 1;
  };

  /** One path per colour over [from, to). */
  private fill(cols: string[], from: number, to: number) {
    const ctx = this.ctx;
    const { X, Y, Rr, C } = this;
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = cols[k];
      ctx.beginPath();
      for (let i = from; i < to; i++) {
        if (C[i] !== k) continue;
        const r = Rr[i];
        if (r <= 0.05) continue;
        if (r < 0.75) {
          ctx.rect(X[i] - r, Y[i] - r, r * 2, r * 2);
        } else {
          ctx.moveTo(X[i] + r, Y[i]);
          ctx.arc(X[i], Y[i], r, 0, TAU);
        }
      }
      ctx.fill();
    }
  }

  isReady() {
    return this.ready;
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const { slideOut, ribbon, ribbon2, portrait, canvas } = this.els;
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
    this.resetBoard();
    portrait.style.visibility = "";
    canvas.style.visibility = "hidden";
  }
}
