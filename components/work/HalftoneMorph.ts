/**
 * Work hero → project board set piece (desktop ≥1025, motion allowed).
 *
 * The dots never leave. One regular dot lattice (the portrait's own grid,
 * extended across the viewport) carries two precomputed radius fields: the
 * portrait halftone and a halftone of the Plainkit / Bedulo cards at featured
 * size. Scrolling sweeps a soft radial front out from the face; each dot
 * resizes from one field to the other with a little curl-noise "ink flow"
 * drift and a faint red/cyan fringe while it is in motion. Everything is a
 * pure function of the scrubbed progress p ∈ [0, 1] (reversible, still at
 * rest; the canvas only redraws when p changes):
 *
 *   0.00–0.12  (copy, certificates and experience are absorbed into the
 *              face by ./absorb, driven from WorkMode); the ribbons fade; the
 *              canvas takes over from the Portrait (first frame identical),
 *              the portrait's small glyphs and letters fade into dots.
 *   0.12–0.60  the morph: face → halftones of the two screenshots.
 *   0.60–0.72  the cards resolve: borders, the real pictures over the dots
 *              (same rect, so the halftone registers), titles fade up.
 *   0.72–0.82  the pair glides into its slot at the top of the board.
 *   0.82–0.98  the other ten rows pop in.
 *
 * Dots are drawn with WebGL points (≈150–200k at 1440×900, all attributes in
 * static buffers, so a frame is three draw calls). Without WebGL the portrait
 * simply cross-fades into the cards.
 *
 * The pointer stirs the dots for the whole time the canvas is up (as the
 * live Portrait does at rest): a short wake of pointer samples (position +
 * velocity, each fading over ~0.4 s) is passed as uniforms and the vertex
 * shader pushes / swirls the dots within ~90 px of it, with a red/cyan fringe
 * on the displaced ones. The stir is the only thing that animates on its
 * own; it runs on one rAF that stops as soon as the wake has died out.
 */
import {
  buildHalftone,
  computeLayout,
  drawField,
  loadCutout,
  palette,
  hash01,
  type Field,
} from "@/lib/halftone";
import { GLYPHS } from "@/components/shared/context";
import { TextDots, type TDGroup } from "./TextDots";
import { layoutRect } from "./absorb";

export type MorphEls = {
  stage: HTMLElement; // pinned wrapper; hero sits at its top-left
  portraitWrap: HTMLElement; // .wk-hero-portrait
  portrait: HTMLElement; // the .portrait root inside it
  ribbons: SVGSVGElement[]; // hero ribbons
  board: HTMLElement; // section#projects
};

type Rect = { x: number; y: number; w: number; h: number };

/* timeline */
const OUT1 = 0.12;
const MORPH0 = 0.12;
const MORPH1 = 0.6;
const RES0 = 0.6;
const RES1 = 0.72;
const GLIDE0 = 0.72;
const GLIDE1 = 0.82;
const ROW0 = 0.82;
const ROW_STEP = 0.0125;
const ROW_DUR = 0.04;

const SPREAD = 0.8; // share of the morph spent sweeping the front across
const DRIFT = 4.5; // px, peak ink-flow drift
const FRINGE = 1.6; // px, peak red/cyan offset
const RAD = 12; // card corner radius

/** Progress within ~a pixel of either end counts as the end itself. */
export const snapProgress = (p: number) => (p < 2e-4 ? 0 : p > 1 - 2e-4 ? 1 : p);

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const norm = (x: number, a: number, b: number) => clamp((x - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const smooth = (t: number) => t * t * (3 - 2 * t);
const f1 = (x: number) => x.toFixed(1);
const f3 = (x: number) => x.toFixed(3);

const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
];

/* ------------------------------------------------------------------ GL */

/* pointer stir */
const TRAIL = 10; // wake samples
const STIR_R = 90; // px, reach of a sample
const STIR_T = 0.035; // s: pointer velocity (px/s) -> push (px)
const STIR_MAX = 18; // px, cap per sample
const STIR_CAP = 16; // px, cap on a dot's total displacement
const STIR_TAU = 420; // ms, a sample's fade
const STIR_GAP = 22; // px between wake samples

const VS = `
#define TRAIL ${TRAIL}
#define CAP ${STIR_CAP.toFixed(1)}
attribute vec2 a_p0;
attribute vec2 a_p1;
attribute vec4 a_ra;
attribute vec2 a_dh;
uniform vec2 u_view;
uniform vec2 u_c;
uniform float u_dpr;
uniform float u_M;
uniform float u_S;
uniform float u_amp;
uniform float u_alpha;
uniform float u_pass;
uniform float u_fr;
uniform float u_gl;
uniform float u_bloom;
uniform vec4 u_tr[TRAIL];
uniform float u_pr;
varying float v_r;
varying float v_a;
varying float v_s;

vec2 grad(vec2 p, float t) {
  vec2 g = vec2(0.0);
  vec2 k;
  k = vec2(0.021, 0.013);  g += k * cos(dot(k, p) + t * 3.1 + 0.7);
  k = vec2(-0.012, 0.027); g += k * cos(dot(k, p) - t * 2.3 + 2.1);
  k = vec2(0.034, -0.019); g += 0.6 * k * cos(dot(k, p) + t * 4.2 + 4.0);
  k = vec2(-0.045, -0.031); g += 0.45 * k * cos(dot(k, p) - t * 3.7 + 1.3);
  return g;
}

// pointer wake: each sample pushes along its velocity and swirls the dots
// either side of its path (a vortex pair, like a stroke through fluid)
vec2 stir(vec2 p) {
  vec2 s = vec2(0.0);
  for (int i = 0; i < TRAIL; i++) {
    vec4 t = u_tr[i];
    vec2 d = (p - t.xy) / u_pr;
    float q = dot(d, d);
    if (q > 4.0) continue;
    float w = exp(-2.2 * q);
    vec2 V = t.zw;
    float cr = d.x * V.y - d.y * V.x;
    s += w * (V * 0.8 + vec2(-d.y, d.x) * cr * 1.1 + d * length(V) * 0.45);
  }
  float l = length(s);
  return l > CAP ? s * (CAP / l) : s;
}

void main() {
  float e = clamp((u_M - a_dh.x * u_S) / (1.0 - u_S), 0.0, 1.0);
  float ee = e * e * (3.0 - 2.0 * e);
  float mo = sin(3.14159265 * e);
  float glyph = step(2.0, a_dh.y);
  float h = a_dh.y - 2.0 * glyph;
  vec2 g = grad(a_p1, u_M);
  vec2 cu = vec2(g.y, -g.x) / 0.05;
  vec2 pos = mix(a_p0, a_p1, ee) + cu * u_amp * mo;
  vec2 st = stir(pos);
  float dm = length(st);
  pos += st;
  float rf = a_ra.x * mix(1.0, u_gl, glyph);
  float r = mix(rf, a_ra.y, ee) + u_bloom * mo * mo;
  float a = mix(a_ra.z, a_ra.w, ee) * u_alpha;
  if (u_pass > 0.5) {
    float mm = mo * mo;
    float mp = 0.8 * smoothstep(0.8, 7.0, dm);
    float m = max(mm, mp);
    if (m < 0.03 || r < 0.05) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      v_r = 0.0; v_a = 0.0; v_s = 1.0;
      return;
    }
    vec2 d;
    if (mm >= mp) {
      vec2 dv = pos - u_c;
      float dl = length(dv);
      d = dv / max(dl, 0.001) * smoothstep(0.0, 80.0, dl);
    } else {
      // stirred dots split along their own displacement
      d = st / max(dm, 0.001) * 1.4;
    }
    pos += d * u_fr * m * (u_pass > 1.5 ? 1.0 : -1.0);
    a *= 0.75 * m;
  }
  float rd = r * u_dpr;
  // area-preserving for sub-pixel dots
  float re = max(rd, 0.75);
  a *= (rd * rd) / (re * re);
  v_r = re;
  v_a = a;
  v_s = ceil(re * 2.0 + 2.0);
  gl_PointSize = v_s;
  vec2 c = pos / u_view * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
}`;

const FS = `
precision mediump float;
uniform vec3 u_col;
varying float v_r;
varying float v_a;
varying float v_s;
void main() {
  float d = length(gl_PointCoord - 0.5) * v_s;
  float c = clamp(v_r - d + 0.5, 0.0, 1.0) * v_a;
  if (c <= 0.002) discard;
  gl_FragColor = vec4(u_col * c, c);
}`;

type GLState = {
  gl: WebGLRenderingContext;
  prog: WebGLProgram;
  bufs: WebGLBuffer[];
  u: Record<string, WebGLUniformLocation | null>;
  n: number;
};

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) throw new Error("shader");
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) || "shader");
  return s;
}

/* -------------------------------------------------------------- images */

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("image failed"));
    im.src = src;
  });

function roundRect(ctx: CanvasRenderingContext2D, r: Rect, q: number) {
  ctx.beginPath();
  ctx.moveTo(r.x + q, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, q);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, q);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, q);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, q);
  ctx.closePath();
}

/** Paints a card's media exactly as the DOM shows it at rect r. */
function paintCard(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  img: HTMLImageElement | null,
  journal: { kicker: string; label: string; family: string } | null,
) {
  ctx.save();
  roundRect(ctx, r, RAD);
  ctx.clip();
  ctx.fillStyle = "#0c0c0d";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  if (img) {
    // object-fit: cover; object-position: 0 0
    const s = Math.max(r.w / img.naturalWidth, r.h / img.naturalHeight);
    ctx.drawImage(img, r.x, r.y, img.naturalWidth * s, img.naturalHeight * s);
  } else if (journal) {
    const p: Rect = { x: r.x + 12, y: r.y + 12, w: r.w - 24, h: r.h - 24 };
    ctx.save();
    roundRect(ctx, p, 8);
    ctx.clip();
    ctx.fillStyle = "#f7f2e9";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    // ruled lines (42px repeat, offset 58px) and the red margin, inked a
    // little heavier than the DOM so they survive the screen
    ctx.fillStyle = "rgba(5,5,5,0.42)";
    for (let y = p.y + 15; y < p.y + p.h; y += 42) ctx.fillRect(p.x, y - 0.5, p.w, 2);
    ctx.fillStyle = "rgba(232,64,42,0.85)";
    ctx.fillRect(p.x + p.w * 0.07 - 0.5, p.y, 2, p.h);
    const big = clamp(innerWidth * 0.015, 16.8, 22.4);
    const small = 11.52;
    const gap = 6.4;
    const cy = p.y + p.h / 2;
    const top = cy - (small * 1.2 + gap + big * 1.2) / 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(5,5,5,0.42)";
    ctx.font = `400 ${small}px ${journal.family}`;
    const k = journal.kicker.toUpperCase().split("").join("  ");
    ctx.fillText(k, p.x + p.w / 2, top + small * 0.6);
    ctx.fillStyle = "rgba(5,5,5,0.78)";
    ctx.font = `italic 400 ${big}px ${journal.family}`;
    ctx.fillText(journal.label, p.x + p.w / 2, top + small * 1.2 + gap + big * 0.6);
    ctx.restore();
  }
  ctx.restore();
}

/* --------------------------------------------------------------- class */

type Geo = {
  featY: number;
  featH: number;
  slot: Rect[]; // pair media in the finished board (stage px)
  pr: Rect; // portrait root (stage px)
};

export class HalftoneMorph {
  private els: MorphEls;
  private canvas: HTMLCanvasElement;
  private glyphCanvas: HTMLCanvasElement;
  private gs: GLState | null = null;
  private glFailed = false;
  private pairMedia: HTMLElement[];
  private pairText: HTMLElement[];
  private rowEls: HTMLElement[];
  private head: HTMLElement | null;
  private td: TextDots;
  private g: Geo | null = null;
  private built = false;
  private buildId = 0;
  private center: [number, number] = [0, 0];
  private pitch = 3;
  private view: [number, number, number] = [0, 0, 1];
  private p = 0;
  private drawn = -1;
  private destroyed = false;
  // pointer stir: wake samples [x, y, vx, vy] (canvas px, push px) + birth times
  private trail = new Float32Array(TRAIL * 4);
  private trailT = new Float64Array(TRAIL).fill(-1e9);
  private trailU = new Float32Array(TRAIL * 4);
  private tHead = 0;
  private ptr = { cx: 0, cy: 0, moved: false, x: 0, y: 0, t: 0, has: false, vx: 0, vy: 0 };
  private stirLive = false; // the last frame drawn had a live wake
  private showing = false;
  private raf = 0;

  constructor(els: MorphEls) {
    this.els = els;
    const c = document.createElement("canvas");
    c.className = "wk-morph";
    c.setAttribute("aria-hidden", "true");
    this.canvas = c;
    const gc = document.createElement("canvas");
    gc.className = "wk-morph wk-morph-glyphs";
    gc.setAttribute("aria-hidden", "true");
    this.glyphCanvas = gc;
    els.stage.append(c, gc);
    const b = els.board;
    const all = (s: string) => [...b.querySelectorAll<HTMLElement>(s)];
    this.pairMedia = all(".wk-pair-media");
    this.pairText = all(".wk-pair-text");
    this.rowEls = all(".wk-row");
    this.head = b.querySelector<HTMLElement>(".wk-board-head");
    this.td = new TextDots(els.stage);
    this.initGL();
    if (this.gs) addEventListener("pointermove", this.onPointer, { passive: true });
  }

  private onPointer = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    const q = this.ptr;
    q.cx = e.clientX;
    q.cy = e.clientY;
    q.moved = true;
    if (this.showing) this.kick();
  };

  private kick() {
    if (!this.raf && !this.destroyed) this.raf = requestAnimationFrame(this.tick);
  }

  /** One rAF: turn pointer motion into wake samples, redraw while it lives. */
  private tick = (now: number) => {
    this.raf = 0;
    if (this.destroyed || !this.showing) return;
    const q = this.ptr;
    if (q.moved) {
      q.moved = false;
      const cr = this.canvas.getBoundingClientRect();
      const x = q.cx - cr.left;
      const y = q.cy - cr.top;
      if (!q.has || now - q.t > 250) {
        // (re)entering: nothing to smear yet
        q.vx = q.vy = 0;
      } else {
        const dt = Math.max(8, now - q.t) / 1000;
        q.vx += ((x - q.x) / dt - q.vx) * 0.5;
        q.vy += ((y - q.y) / dt - q.vy) * 0.5;
      }
      q.x = x;
      q.y = y;
      q.t = now;
      q.has = true;
      let vx = q.vx * STIR_T;
      let vy = q.vy * STIR_T;
      const m = Math.hypot(vx, vy);
      if (m > STIR_MAX) {
        vx *= STIR_MAX / m;
        vy *= STIR_MAX / m;
      }
      if (m > 0.05) {
        const T = this.trail;
        let h = this.tHead;
        // a new sample every STIR_GAP px; the head follows the pointer
        if (Math.hypot(x - T[h * 4], y - T[h * 4 + 1]) > STIR_GAP || now - this.trailT[h] > 120) {
          h = this.tHead = (h + 1) % TRAIL;
        }
        T[h * 4] = x;
        T[h * 4 + 1] = y;
        T[h * 4 + 2] = vx;
        T[h * 4 + 3] = vy;
        this.trailT[h] = now;
      }
    }
    this.render(this.p);
    if (this.stirLive && this.built) this.kick();
  };

  /** Wake uniforms at time now; false when nothing is left to stir. */
  private wake(now: number) {
    const T = this.trail;
    const U = this.trailU;
    let live = false;
    for (let i = 0; i < TRAIL; i++) {
      const k = Math.exp(-(now - this.trailT[i]) / STIR_TAU);
      const on = k > 0.02;
      live ||= on;
      U[i * 4] = T[i * 4];
      U[i * 4 + 1] = T[i * 4 + 1];
      U[i * 4 + 2] = on ? T[i * 4 + 2] * k : 0;
      U[i * 4 + 3] = on ? T[i * 4 + 3] * k : 0;
    }
    return live;
  }

  private initGL() {
    try {
      const gl = this.canvas.getContext("webgl", {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
      });
      if (!gl) throw new Error("no webgl");
      const prog = gl.createProgram();
      if (!prog) throw new Error("program");
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
      const u: GLState["u"] = {};
      for (const k of ["view", "c", "dpr", "M", "S", "amp", "alpha", "pass", "fr", "gl", "bloom", "col", "tr", "pr"])
        u[k] = gl.getUniformLocation(prog, `u_${k}`);
      this.gs = { gl, prog, bufs: [], u, n: 0 };
      this.canvas.addEventListener("webglcontextlost", this.onLost);
    } catch {
      this.gs = null;
      this.glFailed = true;
    }
  }

  private onLost = (e: Event) => {
    e.preventDefault();
    this.gs = null;
    this.glFailed = true;
    this.built = false;
    this.update(this.p);
  };

  /** Remove every inline style the set piece writes on the board. */
  private resetBoard() {
    const { board } = this.els;
    for (const v of ["--bd-frame", "--bd-head", "--bd-foot", "pointer-events"])
      board.style.removeProperty(v);
    for (const m of this.pairMedia)
      for (const k of ["height", "bottom", "transform", "--bd-media"]) m.style.removeProperty(k);
    for (const t of this.pairText)
      for (const k of ["transform", "--bd-text"]) t.style.removeProperty(k);
    for (const r of this.rowEls)
      for (const k of ["--pop", "--bd-img", "pointer-events"]) r.style.removeProperty(k);
  }

  private resetPortrait() {
    for (const k of ["opacity", "visibility", "transition"])
      this.els.portraitWrap.style.removeProperty(k);
  }

  /** Featured rect of card i (k = 1 featured, 0 = in the board). */
  private cardRect(i: number, k: number): Rect {
    const { slot, featY, featH } = this.g!;
    const s = slot[i];
    return { x: s.x, y: lerp(s.y, featY, k), w: s.w, h: lerp(s.h, featH, k) };
  }

  /** Measure from the DOM and rebuild the dot fields (call on refresh). */
  measure() {
    if (this.destroyed) return;
    const { stage, portrait } = this.els;
    this.resetPortrait();
    this.resetBoard();
    const sr = stage.getBoundingClientRect();
    const rel = (el: Element): Rect => {
      const r = el.getBoundingClientRect();
      return { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
    };
    const VW = innerWidth;
    const VH = innerHeight;
    const slot = this.pairMedia.map((el) => rel(el));
    const textH = this.pairText[0] ? this.pairText[0].offsetHeight + 10 : 40;
    const featH = Math.round(Math.min(VH * 0.55, VH - 220));
    const featY = Math.round(Math.max(110, (VH - featH - textH) / 2));
    // the portrait as laid out: its wrapper may still be easing out of the
    // intro's scale(0.97) (mode switch / skipped intro), and baking that into
    // the lattice put the canvas face ~10 px low / right of the settled one
    const lr = layoutRect(portrait);
    const pr: Rect = { x: lr.left - sr.left, y: lr.top - sr.top, w: lr.width, h: lr.height };
    this.g = { featY, featH, slot, pr };

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.view = [VW, VH, dpr];
    for (const c of [this.canvas]) {
      c.width = Math.round(VW * dpr);
      c.height = Math.round(VH * dpr);
      c.style.width = `${VW}px`;
      c.style.height = `${VH}px`;
    }
    this.built = false;
    this.drawn = -1;
    const id = ++this.buildId;
    if (this.gs) {
      this.build(id).catch(() => {
        if (id === this.buildId) {
          this.glFailed = true;
          this.update(this.p);
        }
      });
    }
    // the board's text materialises from dots
    const leaves = (el: Element | null) =>
      el ? [...el.querySelectorAll<HTMLElement>(".wk-row-index, .wk-ptitle, .wk-pdesc, .wk-board-label, .wk-board-count")] : [];
    const groups: TDGroup[] = [
      ...this.pairText.map((t, i) => ({
        leaves: leaves(t),
        from: RES0 - 0.01 + i * 0.015,
        to: GLIDE0 - 0.02 + i * 0.012,
        src: this.cardRect(i, 1),
      })),
      { leaves: leaves(this.head), from: GLIDE0 - 0.02, to: GLIDE1 + 0.04, src: null },
      ...this.rowEls.map((r, i) => ({
        leaves: leaves(r),
        from: ROW0 + i * ROW_STEP - 0.025,
        to: ROW0 + i * ROW_STEP + ROW_DUR + 0.005,
        src: null,
      })),
    ];
    this.td.measure(groups, () => this.resetBoard()).then(() => {
      this.update(this.p);
    });
    this.update(this.p);
  }

  private async build(id: number) {
    const g = this.g!;
    const { portrait } = this.els;
    const family = getComputedStyle(portrait).fontFamily || "sans-serif";
    const srcs = this.pairMedia.map((m) => m.querySelector("img")?.currentSrc || m.querySelector("img")?.src || "");
    const [cut, ...imgs] = await Promise.all([
      loadCutout(),
      ...srcs.map((s) => (s ? loadImg(s).catch(() => null) : Promise.resolve(null))),
    ]);
    if (id !== this.buildId || this.destroyed || !this.gs) return;

    // ---- the portrait's own field (same size + options as the Portrait engine)
    const W = Math.round(portrait.clientWidth);
    const H = Math.round(portrait.clientHeight);
    const L = computeLayout(W, H, "bust");
    const F = buildHalftone(cut, L, { tone: "dark", framing: "bust", glyphs: GLYPHS });
    const P = F.pitch;
    this.pitch = P;
    const pr = g.pr;
    // the lattice: the portrait grid, extended over the whole viewport
    const gx = pr.x + F.ox;
    const gy = pr.y + F.oy;
    const [VW, VH] = this.view;
    const I0 = Math.floor(-gx / P) - 1;
    const J0 = Math.floor(-gy / P) - 1;
    const NC = Math.ceil((VW - gx) / P) - I0 + 1;
    const NR = Math.ceil((VH - gy) / P) - J0 + 1;
    const idx = new Int32Array(NC * NR).fill(-1);
    const cx = pr.x + L.headX;
    const cy = pr.y + L.headY;
    this.center = [cx, cy];

    const p0x: number[] = [];
    const p0y: number[] = [];
    const p1x: number[] = [];
    const p1y: number[] = [];
    const rf: number[] = [];
    const rc: number[] = [];
    const af: number[] = [];
    const ac: number[] = [];
    const flag: number[] = [];
    const push = (I: number, J: number) => {
      const n = (J - J0) * NC + (I - I0);
      if (n < 0 || n >= idx.length || I < I0 || I >= I0 + NC) return -1;
      if (idx[n] >= 0) return idx[n];
      const k = p0x.length;
      idx[n] = k;
      const x = gx + (I + 0.5) * P;
      const y = gy + (J + 0.5) * P;
      p0x.push(x);
      p0y.push(y);
      p1x.push(x);
      p1y.push(y);
      rf.push(0);
      rc.push(0);
      af.push(0);
      ac.push(0);
      flag.push(0);
      return k;
    };

    for (let q = 0; q < F.live.length; q++) {
      const p = F.live[q];
      const i = p % F.cols;
      const j = (p - i) / F.cols;
      const k = push(i, j);
      if (k < 0) continue;
      p0x[k] = pr.x + F.x[p];
      p0y[k] = pr.y + F.y[p];
      rf[k] = F.r[p];
      const op = F.a[p];
      af[k] = op > 0.9 ? 1 : op > 0.7 ? 0.8 : op > 0.5 ? 0.6 : 0.4; // drawField buckets
      flag[k] = F.g[p] >= 0 ? 2 : 0;
    }

    // ---- the two cards at featured size, sampled onto the same lattice
    const journalKicker = this.pairMedia.map((m) => m.querySelector(".wk-journal-kicker")?.textContent ?? "");
    const journalLabel = this.pairMedia.map((m) => m.querySelector(".wk-journal-label")?.textContent ?? "");
    for (let c = 0; c < this.pairMedia.length; c++) {
      const R = this.cardRect(c, 1);
      const a0 = Math.ceil((R.x - gx) / P - 0.5);
      const a1 = Math.floor((R.x + R.w - gx) / P - 0.5);
      const b0 = Math.ceil((R.y - gy) / P - 0.5);
      const b1 = Math.floor((R.y + R.h - gy) / P - 0.5);
      const cols = a1 - a0 + 1;
      const rows = b1 - b0 + 1;
      if (cols < 2 || rows < 2) continue;
      const ss = 3;
      const cv = document.createElement("canvas");
      cv.width = cols * ss;
      cv.height = rows * ss;
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const f = ss / P;
      ctx.setTransform(f, 0, 0, f, -(gx + a0 * P) * f, -(gy + b0 * P) * f);
      const img = imgs[c] ?? null;
      paintCard(
        ctx,
        R,
        img,
        img ? null : { kicker: journalKicker[c], label: journalLabel[c], family },
      );
      const cw = cv.width;
      const d = ctx.getImageData(0, 0, cw, cv.height).data;
      cv.width = cv.height = 0;
      const n = cols * rows;
      const Lm = new Float32Array(n);
      const Am = new Float32Array(n);
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          let lum = 0;
          let al = 0;
          for (let v = 0; v < ss; v++) {
            let o = ((j * ss + v) * cw + i * ss) * 4;
            for (let u = 0; u < ss; u++, o += 4) {
              const aa = d[o + 3] / 255;
              lum += aa * (0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]);
              al += aa;
            }
          }
          const q = j * cols + i;
          Am[q] = al / (ss * ss);
          Lm[q] = al > 0 ? lum / al / 255 : 0;
        }
      // mild unsharp mask so UI text and rules survive the screen
      const E = new Float32Array(n);
      const vals: number[] = [];
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          let s = 0;
          let w = 0;
          for (let v = -1; v <= 1; v++)
            for (let u = -1; u <= 1; u++) {
              const ii = i + u;
              const jj = j + v;
              if (ii < 0 || jj < 0 || ii >= cols || jj >= rows) continue;
              s += Lm[jj * cols + ii];
              w++;
            }
          const q = j * cols + i;
          E[q] = Lm[q] + 0.9 * (Lm[q] - s / w);
          if (Am[q] > 0.9) vals.push(E[q]);
        }
      vals.sort((x, y) => x - y);
      const pct = (t: number) => vals[Math.min(vals.length - 1, Math.max(0, Math.floor(t * (vals.length - 1))))] ?? 0;
      // auto-levels per card, then even out the overall density so a bright
      // card (Bedulo's paper) doesn't become a solid block and a dark UI
      // (Plainkit) still reads
      const lo = pct(0.01);
      const hi = Math.max(lo + 0.05, pct(0.995));
      let mean = 0;
      for (const v of vals) mean += clamp((v - lo) / (hi - lo));
      mean /= Math.max(1, vals.length);
      const TARGET_LO = 0.3;
      const TARGET_HI = 0.44;
      const gam = mean < TARGET_LO && mean > 0.001 ? clamp(Math.log(TARGET_LO) / Math.log(mean), 0.45, 1) : 1;
      const scale = mean > TARGET_HI ? TARGET_HI / mean : 1;
      const minR = P * 0.08;
      const maxR = P * 0.55;
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const q = j * cols + i;
          const al = Am[q];
          if (al < 0.06) continue;
          let t = clamp((E[q] - lo) / (hi - lo));
          t = Math.pow(t, gam) * scale;
          t = t * 0.2 + smooth(t) * 0.8;
          const rad = (minR + (maxR - minR) * Math.pow(t, 0.78)) * (al < 0.95 ? 0.4 + 0.6 * al : 1);
          const k = push(a0 + i, b0 + j);
          if (k < 0) continue;
          rc[k] = rad;
          ac[k] = 1;
        }
    }

    // ---- per-dot front delay: radial from the face, with a soft ragged edge
    const corners = [
      [0, 0],
      [VW, 0],
      [0, VH],
      [VW, VH],
    ];
    let Dmax = 1;
    for (const [x, y] of corners) Dmax = Math.max(Dmax, Math.hypot(x - cx, y - cy));
    // farthest live dot sets the scale (so the sweep ends with the last dot)
    let far = 1;
    for (let k = 0; k < p0x.length; k++) far = Math.max(far, Math.hypot(p1x[k] - cx, p1y[k] - cy));
    far = Math.min(far, Dmax);
    const N = p0x.length;
    const A0 = new Float32Array(N * 2);
    const A1 = new Float32Array(N * 2);
    const RA = new Float32Array(N * 4);
    const DH = new Float32Array(N * 2);
    for (let k = 0; k < N; k++) {
      A0[2 * k] = p0x[k];
      A0[2 * k + 1] = p0y[k];
      A1[2 * k] = p1x[k];
      A1[2 * k + 1] = p1y[k];
      RA[4 * k] = rf[k];
      RA[4 * k + 1] = rc[k];
      RA[4 * k + 2] = af[k] || ac[k];
      RA[4 * k + 3] = ac[k] || af[k];
      const dx = p1x[k] - cx;
      const dy = p1y[k] - cy;
      const ang = Math.atan2(dy, dx);
      // ragged front: low-frequency angular wobble + fine per-dot grain
      const I = Math.round((p1x[k] - gx) / P);
      const J = Math.round((p1y[k] - gy) / P);
      // (angular terms fade in away from the centre so it never pinches)
      const away = smooth(clamp(Math.hypot(dx, dy) / 220));
      const wob =
        away * (0.05 * Math.sin(ang * 3 + 0.8) + 0.035 * Math.sin(ang * 7 - 1.7)) +
        0.03 * Math.sin(dx * 0.011 + dy * 0.017) +
        0.035 * (hash01(I, J, 31) - 0.5);
      DH[2 * k] = clamp(Math.hypot(dx, dy) / far * 0.92 + wob + 0.04, 0, 1);
      DH[2 * k + 1] = flag[k] + hash01(I, J, 32) * 0.999;
    }

    // ---- upload
    const gs = this.gs!;
    const gl = gs.gl;
    for (const b of gs.bufs) gl.deleteBuffer(b);
    gs.bufs = [];
    gl.useProgram(gs.prog);
    const attr = (name: string, data: Float32Array, size: number) => {
      const b = gl.createBuffer();
      if (!b) throw new Error("buffer");
      gs.bufs.push(b);
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(gs.prog, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    attr("a_p0", A0, 2);
    attr("a_p1", A1, 2);
    attr("a_ra", RA, 4);
    attr("a_dh", DH, 2);
    gs.n = N;

    // ---- the portrait's glyph cells + letters (2D, faded out early)
    const [, , dpr] = this.view;
    const gc = this.glyphCanvas;
    gc.width = Math.round(W * dpr);
    gc.height = Math.round(H * dpr);
    gc.style.width = `${W}px`;
    gc.style.height = `${H}px`;
    gc.style.left = `${f1(pr.x)}px`;
    gc.style.top = `${f1(pr.y)}px`;
    const gctx = gc.getContext("2d");
    if (gctx) {
      gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const glyphOnly: Field = { ...F, live: F.live.filter((q) => F.g[q] >= 0) };
      drawField(gctx, glyphOnly, palette("dark").ink, family, true, true);
    }

    this.built = true;
    this.drawn = -1;
    this.update(this.p);
  }

  private render(p: number) {
    const gs = this.gs;
    if (!gs || !this.built) return;
    const stir = this.wake(performance.now());
    if (p === this.drawn && !stir && !this.stirLive) return;
    this.drawn = p;
    this.stirLive = stir;
    const { gl, u } = gs;
    const [VW, VH, dpr] = this.view;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const alpha = 1 - ease(norm(p, RES0 + 0.025, RES1));
    if (alpha <= 0.001) return;
    gl.useProgram(gs.prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const M = norm(p, MORPH0, MORPH1);
    gl.uniform2f(u.view, VW, VH);
    gl.uniform2f(u.c, this.center[0], this.center[1]);
    gl.uniform1f(u.dpr, dpr);
    gl.uniform1f(u.M, M);
    gl.uniform1f(u.S, SPREAD);
    gl.uniform1f(u.amp, DRIFT);
    gl.uniform1f(u.alpha, alpha);
    gl.uniform1f(u.fr, FRINGE);
    gl.uniform1f(u.gl, ease(norm(p, 0.02, OUT1)));
    gl.uniform1f(u.bloom, this.pitch * 0.08);
    gl.uniform4fv(u.tr, this.trailU);
    gl.uniform1f(u.pr, STIR_R);
    const pal = palette("dark");
    if ((M > 0 && M < 1) || stir) {
      gl.uniform1f(u.pass, 1);
      gl.uniform3fv(u.col, hex(pal.red));
      gl.drawArrays(gl.POINTS, 0, gs.n);
      gl.uniform1f(u.pass, 2);
      gl.uniform3fv(u.col, hex(pal.cyan));
      gl.drawArrays(gl.POINTS, 0, gs.n);
    }
    gl.uniform1f(u.pass, 0);
    gl.uniform3fv(u.col, hex(pal.ink));
    gl.drawArrays(gl.POINTS, 0, gs.n);
  }

  /** Sync DOM state for progress p (called from the ScrollTrigger). */
  update(p: number) {
    if (this.destroyed) return;
    // ScrollTrigger reports ~1e-7 at scrollY 0 (sub-pixel start); that must
    // still be the resting hero with the live, interactive Portrait
    p = snapProgress(p);
    this.p = p;
    const { ribbons, portraitWrap, board } = this.els;
    const g = this.g;
    const rest = p <= 0;
    const done = p >= 1;
    const dots = this.built && !!this.gs && !this.glFailed;

    ribbons.forEach((r, i) => {
      if (rest || !g) r.style.removeProperty("opacity");
      else r.style.opacity = f3((i ? 0.55 : 1) * (1 - ease(norm(p, 0, 0.08))));
    });

    // the canvas takes over from the portrait (or, without WebGL, the
    // portrait simply fades out)
    const live = !!g && !rest && !done;
    const pw = portraitWrap.style;
    if (!live && !done) this.resetPortrait();
    else if (dots || done) {
      pw.transition = "none";
      pw.visibility = "hidden";
      pw.removeProperty("opacity");
    } else {
      pw.transition = "none";
      const f = ease(norm(p, OUT1, 0.4));
      pw.opacity = f3(1 - f);
      pw.visibility = f >= 1 ? "hidden" : "";
    }
    const show = live && dots;
    this.canvas.style.visibility = show ? "visible" : "hidden";
    const gOp = 1 - ease(norm(p, 0.02, OUT1));
    this.glyphCanvas.style.visibility = show && gOp > 0 ? "visible" : "hidden";
    this.glyphCanvas.style.opacity = f3(gOp);
    this.showing = show;
    if (show) {
      this.render(p);
      if (this.stirLive) this.kick();
    } else this.drawn = -1;

    // ------------------------------------------------------------ the board
    const set = (el: HTMLElement, v: string, x: number) => el.style.setProperty(v, f3(done || !g ? 1 : x));
    const resolve = dots ? ease(norm(p, RES0, RES1 - 0.02)) : ease(norm(p, 0.4, RES1 - 0.02));
    set(board, "--bd-frame", ease(norm(p, RES0, RES0 + 0.08)));
    set(board, "--bd-head", norm(p, GLIDE0, GLIDE1));
    set(board, "--bd-foot", norm(p, 0.955, 0.98));
    board.style.pointerEvents = done || !g || p >= GLIDE0 ? "" : "none";

    const k = 1 - ease(norm(p, GLIDE0, GLIDE1));
    this.pairMedia.forEach((m, i) => {
      if (!g || done || k <= 0) {
        for (const s of ["height", "bottom", "transform"]) m.style.removeProperty(s);
      } else {
        const r = this.cardRect(i, k);
        m.style.bottom = "auto";
        m.style.height = `${f1(r.h)}px`;
        m.style.transform = `translate3d(0,${f1(r.y - g.slot[i].y)}px,0)`;
      }
      set(m, "--bd-media", resolve);
    });
    const td = this.td.ready && !!g;
    this.pairText.forEach((t, i) => {
      const t0 = RES0 + 0.035 + i * 0.015;
      // (with text dots the caption itself stays put; its leaves cross-fade)
      const tin = g && !td ? norm(p, t0, t0 + 0.05) : 1;
      set(t, "--bd-text", easeOut(tin));
      if (!g || done) {
        t.style.removeProperty("transform");
        return;
      }
      const r = this.cardRect(i, k);
      const dy = r.y + r.h - (g.slot[i].y + g.slot[i].h) + (1 - easeOut(tin)) * 12;
      t.style.transform = Math.abs(dy) > 0.05 ? `translate3d(0,${f1(dy)}px,0)` : "";
    });

    this.rowEls.forEach((r, i) => {
      if (done || !g) {
        for (const s of ["--pop", "--bd-img", "pointer-events"]) r.style.removeProperty(s);
        return;
      }
      const t0 = ROW0 + i * ROW_STEP;
      const t = norm(p, t0, t0 + ROW_DUR);
      const pop = easeOut(norm(t, 0, 0.45));
      const img = ease(norm(t, 0.35, 0.9));
      r.style.setProperty("--pop", f3(pop));
      r.style.setProperty("--bd-img", f3(img));
      r.style.pointerEvents = pop > 0.5 ? "" : "none";
    });

    if (td && !done) {
      const dy = [
        ...this.pairMedia.map((_, i) => {
          const r = this.cardRect(i, k);
          return r.y + r.h - (g!.slot[i].y + g!.slot[i].h);
        }),
        0,
        ...this.rowEls.map(() => 0),
      ];
      this.td.update(p, dy);
    } else this.td.update(p, null);
  }

  destroy() {
    this.destroyed = true;
    this.buildId++;
    removeEventListener("pointermove", this.onPointer);
    cancelAnimationFrame(this.raf);
    const { ribbons } = this.els;
    for (const r of ribbons) r.style.removeProperty("opacity");
    this.resetPortrait();
    this.resetBoard();
    const gs = this.gs;
    if (gs) {
      for (const b of gs.bufs) gs.gl.deleteBuffer(b);
      gs.gl.deleteProgram(gs.prog);
      gs.gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.gs = null;
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.remove();
    this.td.destroy();
    this.glyphCanvas.width = this.glyphCanvas.height = 0;
    this.glyphCanvas.remove();
  }
}
