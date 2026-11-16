/**
 * "Text from dots": board text (titles with their red period, one-liners,
 * indices, the heading) materialises out of dots instead of fading in.
 *
 * Built on the shared text ⇄ dots utility (components/shared/dotText.ts):
 * each text leaf is sampled glyph by glyph in its computed font and colour
 * (pitch ≈2.25 px). In its progress window the leaf's dots fly in from a
 * source (a card's halftone, or scattered nearby) along a gentle curve with a
 * curl-noise drift, grow and settle into the glyph shapes, then cross-fade
 * into the real DOM text (`--td` on the leaf, 0..1, see styles/work.css). A
 * pure function of the scrubbed progress p (reversible; nothing drawn when no
 * leaf is mid-way). Dots are drawn on the shared fixed dot layer.
 *
 * The pointer stirs the flying dots like the hero morph does (a short wake
 * of pointer samples parting the dots radially, settling back as it fades;
 * mouse / pen only).
 *
 * The real text stays in the DOM (only its opacity is driven), so screen
 * readers and getByText are unaffected.
 */
import { hash01 } from "@/lib/halftone";
import {
  DotPaths,
  Palette,
  acquireLayer,
  clamp,
  easeIO,
  finePitch,
  flight,
  fontsReady,
  norm,
  sampleText,
  smooth,
  type LayerHandle,
} from "@/components/shared/dotText";

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
  c: Uint16Array;
  bend: Float32Array;
  dly: Float32Array;
  td: number; // last written --td (-1 = none)
};

const FLY = 0.5; // share of a leaf's window one dot spends flying
const XF = 0.8; // cross-fade starts here (all dots settled)
const DRIFT = 6; // px, peak curl drift

/* pointer stir (CPU twin of HalftoneMorph's wake) */
const TRAIL = 10; // wake samples
const STIR_R = 70; // px, reach of a sample
const STIR_T = 0.03; // s: pointer speed (px/s) -> push strength (px)
const STIR_MAX = 12; // px, cap per sample
const STIR_CAP = 8; // px, cap on a dot's total displacement
const STIR_TAU = 200; // ms, a sample's fade (dots settle back this fast)
const STIR_GAP = 22; // px between wake samples

/** Pointer wake in viewport px; `at(x, y)` is the displacement of a dot. */
class Wake {
  private T = new Float32Array(TRAIL * 4); // x, y, vx, vy (push px)
  private born = new Float64Array(TRAIL).fill(-1e9);
  private U = new Float32Array(TRAIL * 4); // faded, for this frame
  private head = 0;
  private x = 0;
  private y = 0;
  private vx = 0;
  private vy = 0;
  private t = -1e9;

  move(x: number, y: number, now: number) {
    if (now - this.t > 250) {
      this.vx = this.vy = 0;
    } else {
      const dt = Math.max(8, now - this.t) / 1000;
      this.vx += ((x - this.x) / dt - this.vx) * 0.5;
      this.vy += ((y - this.y) / dt - this.vy) * 0.5;
    }
    this.x = x;
    this.y = y;
    this.t = now;
    let vx = this.vx * STIR_T;
    let vy = this.vy * STIR_T;
    const m = Math.hypot(vx, vy);
    if (m > STIR_MAX) {
      vx *= STIR_MAX / m;
      vy *= STIR_MAX / m;
    }
    if (m <= 0.05) return;
    const T = this.T;
    let h = this.head;
    if (Math.hypot(x - T[h * 4], y - T[h * 4 + 1]) > STIR_GAP || now - this.born[h] > 120) {
      h = this.head = (h + 1) % TRAIL;
    }
    T[h * 4] = x;
    T[h * 4 + 1] = y;
    T[h * 4 + 2] = vx;
    T[h * 4 + 3] = vy;
    this.born[h] = now;
  }

  /** fade the samples to time now; false when nothing is left to stir */
  frame(now: number) {
    let live = false;
    for (let i = 0; i < TRAIL; i++) {
      const k = Math.exp(-(now - this.born[i]) / STIR_TAU);
      const on = k > 0.02;
      live ||= on;
      this.U[i * 4] = this.T[i * 4];
      this.U[i * 4 + 1] = this.T[i * 4 + 1];
      this.U[i * 4 + 2] = on ? this.T[i * 4 + 2] * k : 0;
      this.U[i * 4 + 3] = on ? this.T[i * 4 + 3] * k : 0;
    }
    return live;
  }

  at(px: number, py: number, out: [number, number]) {
    let sx = 0;
    let sy = 0;
    const U = this.U;
    for (let i = 0; i < TRAIL; i++) {
      const Vx = U[i * 4 + 2];
      const Vy = U[i * 4 + 3];
      if (Vx === 0 && Vy === 0) continue;
      const dx = (px - U[i * 4]) / STIR_R;
      const dy = (py - U[i * 4 + 1]) / STIR_R;
      const q = dx * dx + dy * dy;
      if (q > 4) continue;
      // radial parting only (see HalftoneMorph stir())
      const w = Math.exp(-2.5 * q) * Math.hypot(Vx, Vy) * 1.9;
      sx += dx * w;
      sy += dy * w;
    }
    const l = Math.hypot(sx, sy);
    if (l > STIR_CAP) {
      sx *= STIR_CAP / l;
      sy *= STIR_CAP / l;
    }
    out[0] = sx;
    out[1] = sy;
  }
}

export class TextDots {
  private stage: HTMLElement;
  private layer: LayerHandle;
  private pal = new Palette();
  private leaves: Leaf[] = [];
  private all: HTMLElement[] = [];
  private buildId = 0;
  private drawn = -1;
  private destroyed = false;
  private wake = new Wake();
  private stirring = false;
  private raf = 0;
  private lastP = 0;
  private lastDy: number[] | null = null;
  /** dots built and ready (the board text is then driven by --td) */
  ready = false;

  constructor(stage: HTMLElement) {
    this.stage = stage;
    this.layer = acquireLayer();
    addEventListener("pointermove", this.onPointer, { passive: true });
  }

  private onPointer = (e: PointerEvent) => {
    if (e.pointerType === "touch" || this.destroyed) return;
    this.wake.move(e.clientX, e.clientY, performance.now());
    // only worth a frame while dots are on screen
    if (this.drawn !== -2 && this.drawn !== -1 && !this.raf) this.raf = requestAnimationFrame(this.tick);
  };

  private tick = () => {
    this.raf = 0;
    if (this.destroyed) return;
    this.drawn = -1; // force a redraw with the current wake
    this.update(this.lastP, this.lastDy);
    if (this.stirring && this.drawn !== -2) this.raf = requestAnimationFrame(this.tick);
  };

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
    this.layer.paint(null);
    if (this.destroyed) return false;
    await fontsReady();
    if (id !== this.buildId || this.destroyed) return false;
    atRest();
    const sr = this.stage.getBoundingClientRect();
    const origin = { left: sr.left, top: sr.top };
    // all layout is read synchronously inside sampleText, before any await
    const jobs = groups.map((g) =>
      g.leaves.map((el) =>
        sampleText([el], { palette: this.pal, origin, pitch: finePitch, rules: false, icons: false }).then((cl) => ({
          el,
          cl,
        })),
      ),
    );
    const rects = groups.map((g) => g.leaves.map((el) => el.getBoundingClientRect()));
    const done = await Promise.all(jobs.map((j) => Promise.all(j)));
    if (id !== this.buildId || this.destroyed) return false;
    const leaves: Leaf[] = [];
    let salt = 0;
    groups.forEach((g, gi) => {
      const n = g.leaves.length;
      const s = n > 1 ? (g.to - g.from) * 0.08 : 0;
      done[gi].forEach(({ el, cl }, k) => {
        ++salt;
        if (!cl.n) return;
        const er = rects[gi][k];
        const L: Leaf = {
          el,
          group: gi,
          a: g.from + s * k,
          b: g.to - s * (n - 1 - k),
          n: cl.n,
          tx: cl.x,
          ty: cl.y,
          sx: new Float32Array(cl.n),
          sy: new Float32Array(cl.n),
          r: cl.r,
          c: cl.c,
          bend: new Float32Array(cl.n),
          dly: new Float32Array(cl.n),
          td: -1,
        };
        const x0 = er.left - sr.left;
        for (let q = 0; q < cl.n; q++) {
          const h1 = hash01(q, salt, 41);
          const h2 = hash01(q, salt, 42);
          if (g.src) {
            // peel off the card's halftone (its lower part, nearest the caption)
            L.sx[q] = g.src.x + g.src.w * h1;
            L.sy[q] = g.src.y + g.src.h * (0.35 + 0.65 * h2);
          } else {
            const ang = h1 * Math.PI * 2;
            const dist = 40 + 120 * h2;
            L.sx[q] = L.tx[q] + Math.cos(ang) * dist * 1.4;
            L.sy[q] = L.ty[q] + Math.sin(ang) * dist * 0.7 + 24;
          }
          L.bend[q] = (0.12 + 0.2 * hash01(q, salt, 43)) * (hash01(q, salt, 44) < 0.5 ? -1 : 1);
          const xf = clamp((L.tx[q] - x0) / Math.max(1, er.width));
          L.dly[q] = (1 - FLY - (1 - XF)) * (0.6 * xf + 0.4 * hash01(q, salt, 45));
        }
        leaves.push(L);
      });
    });
    this.leaves = leaves;
    this.all = leaves.map((l) => l.el);
    for (const el of this.all) el.dataset.td = "";
    this.ready = leaves.length > 0;
    if (this.ready) this.stage.classList.add("has-td");
    return this.ready;
  }

  /**
   * Draw for progress p. `dy[group]` shifts a group (it moves with the
   * featured cards). `off` = text not driven (rest state / done): no --td,
   * nothing drawn.
   */
  update(p: number, dy: number[] | null) {
    if (this.destroyed || !this.ready) return;
    this.lastP = p;
    this.lastDy = dy;
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
    if (off || !any) {
      this.layer.paint(null);
      return;
    }
    const sr = this.stage.getBoundingClientRect();
    const ox = sr.left;
    const oy = sr.top;
    const shifts = dy!;
    const wake = this.wake;
    const stir = (this.stirring = wake.frame(performance.now()));
    const d: [number, number] = [0, 0];
    this.layer.paint((ctx, W, H) => {
      for (const L of this.leaves) {
        const t = norm(p, L.a, L.b);
        if (t <= 0 || t >= 1) continue;
        const shift = oy + (shifts[L.group] ?? 0);
        const paths = new DotPaths(W, H);
        for (let k = 0; k < L.n; k++) {
          const u = norm(t, L.dly[k], L.dly[k] + FLY);
          if (u <= 0) continue;
          const ee = easeIO(u);
          const [x, y] = flight(ox + L.sx[k], oy + L.sy[k], ox + L.tx[k], L.ty[k] + shift, ee, L.bend[k], t, DRIFT);
          const r = (0.55 + (L.r[k] - 0.55) * smooth(norm(ee, 0.45, 1))) * Math.min(1, u / 0.12);
          if (stir) {
            wake.at(x, y, d);
            paths.add(L.c[k], x + d[0], y + d[1], r);
          } else paths.add(L.c[k], x, y, r);
        }
        paths.fill(ctx, this.pal, 1 - smooth(norm(t, XF, 1)));
      }
    });
  }

  destroy() {
    this.destroyed = true;
    removeEventListener("pointermove", this.onPointer);
    cancelAnimationFrame(this.raf);
    this.buildId++;
    this.clearLeaves();
    this.layer.release();
  }
}
