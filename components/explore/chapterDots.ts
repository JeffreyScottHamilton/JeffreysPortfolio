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
 * DOM; only its opacity is driven (see `chapterAlpha`). Sampling, flight
 * paths and the dot canvas are the shared ones (components/shared/dotText.ts).
 */
import { hash01 } from "@/lib/halftone";
import { swirl } from "@/components/shared/swirl";
import {
  DotPaths,
  Palette,
  acquireLayer,
  easeIO,
  flight,
  fontsReady,
  norm,
  rankOrder,
  sampleText,
  scaledPitch,
  smooth,
  type Cloud,
  type LayerHandle,
} from "@/components/shared/dotText";

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

/** Sample text blocks (with their small rules / inline icons), px relative to `origin`. */
function sampleBlocks(blocks: HTMLElement[], origin: DOMRect, palette: Palette): Promise<Cloud> {
  return sampleText(blocks, { palette, origin, pitch: scaledPitch });
}

/* ------------------------------------------------------------ the field */

/** A chapter's N slots: real targets (r > 0) plus duplicates (r = 0), in rank order. */
type Slots = { x: Float32Array; y: Float32Array; r: Float32Array; c: Uint16Array };

function toSlots(D: Cloud, N: number, seed: number): Slots {
  const n = D.n;
  // keep at most N real targets (even subsample)
  let keep = [...Array(n).keys()];
  if (n > N) keep = keep.filter((_, i) => hash01(i, seed, 7) < N / n).slice(0, N);
  const m = keep.length;
  const x = new Float32Array(N);
  const y = new Float32Array(N);
  const r = new Float32Array(N);
  const col = new Uint16Array(N);
  for (let i = 0; i < N; i++) {
    const real = i < m;
    const src = real ? keep[i] : keep[Math.floor(hash01(i, seed, 9) * m)];
    x[i] = D.x[src];
    // duplicates sit on their twin (tiny offset keeps the rank stable)
    y[i] = D.y[src] + (real ? 0 : 0.001);
    r[i] = real ? D.r[src] : 0;
    col[i] = D.c[src];
  }
  const order = rankOrder(x, y, N, 36);
  const s: Slots = {
    x: new Float32Array(N),
    y: new Float32Array(N),
    r: new Float32Array(N),
    c: new Uint16Array(N),
  };
  order.forEach((o, j) => {
    s.x[j] = x[o];
    s.y[j] = y[o];
    s.r[j] = r[o];
    s.c[j] = col[o];
  });
  return s;
}

/** the hand-off: arrival copy dots → chapter 0 slots (M movers) */
type Build = {
  M: number;
  sx: Float32Array; // arrival-local
  sy: Float32Array;
  sr: Float32Array;
  sc: Uint16Array;
  p: Uint32Array; // chapter 0 slot
  pr: Float32Array; // radius at the slot (0 = merges)
};

export class ChapterDots {
  private layer: LayerHandle;
  private pal = new Palette();
  private box: HTMLElement;
  private chapters: HTMLElement[];
  private last: number;
  private N = 0;
  private slots: Slots[] = [];
  private bend = new Float32Array(0);
  private amp = new Float32Array(0);
  private dly = new Float32Array(0);
  private src: Cloud | null = null;
  private srcEl: HTMLElement | null = null;
  private build: Build | null = null;
  private buildId = 0;
  private destroyed = false;
  ready = false;

  constructor(box: HTMLElement, chapters: HTMLElement[]) {
    this.layer = acquireLayer();
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
    await fontsReady();
    if (id !== this.buildId || this.destroyed) return false;
    const origin = this.box.getBoundingClientRect();
    // layout is read synchronously for every chapter before any await
    const jobs = this.chapters.map((ch) => sampleBlocks(ChapterDots.blocks(ch), origin, this.pal));
    const sets = await Promise.all(jobs);
    if (id !== this.buildId || this.destroyed) return false;
    const N = Math.min(MAX_DOTS, Math.max(1, ...sets.map((s) => s.n)));
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
    const set = await sampleBlocks(blocks, arrival.getBoundingClientRect(), this.pal);
    if (this.destroyed) return;
    this.src = set.n ? set : null;
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
    const C = S.n;
    const order = rankOrder(S.x, S.y, C, 36);
    const M = Math.max(N, C);
    const b: Build = {
      M,
      sx: new Float32Array(M),
      sy: new Float32Array(M),
      sr: new Float32Array(M),
      sc: new Uint16Array(M),
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
      b.sc[m] = S.c[s];
      b.p[m] = p;
      b.pr[m] = p === prevP ? 0 : T.r[p];
      prevS = s;
      prevP = p;
    }
    this.build = b;
  }

  /** Draw for build b and chapter position t (the year morph's values). */
  /** flying chapter dots swirl with the cursor (shared swirl) */
  private bt: [number, number] = [0, 0];
  private offSwirl = swirl.on(() => this.update(...this.bt));

  update(b: number, t: number) {
    this.bt = [b, t];
    if (this.destroyed || !this.ready) return;
    const last = this.last;
    const k0 = Math.max(0, Math.min(last, Math.floor(t)));
    const f = k0 >= last ? 0 : t - k0;
    const building = b < 1 && k0 === 0 && f < 0.5;
    const moving = !building && f > 0 && f < 1;
    if (!(building ? b > 0 : moving)) {
      this.layer.paint(null);
      return;
    }
    const br = this.box.getBoundingClientRect();
    if (!building && (br.bottom < 0 || br.top > innerHeight)) {
      this.layer.paint(null);
      return;
    }
    const ar = building && this.build && this.srcEl ? this.srcEl.getBoundingClientRect() : null;
    this.layer.paint((ctx, W, H) => {
      const P = new DotPaths(W, H);
      const stir = swirl.live;
      const sw: [number, number] = [0, 0];
      const add = (c: number, x: number, y: number, r: number) => {
        if (stir) {
          swirl.at(x, y, sw);
          P.add(c, x + sw[0], y + sw[1], r);
        } else P.add(c, x, y, r);
      };
      let alpha = 1;
      const T = this.slots[0];
      if (building) {
        const B = this.build;
        alpha = 1 - smooth(norm(b, B_DOT_OUT, 1));
        if (B && ar) {
          for (let m = 0; m < B.M; m++) {
            const p = B.p[m];
            const dl = this.dly[p];
            const u = norm(b, B_FLY0 + dl * B_STAG, B_FLY0 + dl * B_STAG + B_FLY);
            const e = easeIO(u);
            const r = (B.sr[m] + (B.pr[m] - B.sr[m]) * e) * (1 - 0.4 * Math.sin(Math.PI * e));
            if (r < 0.15) continue;
            const [x, y] = this.path(ar.left + B.sx[m], ar.top + B.sy[m], br.left + T.x[p], br.top + T.y[p], e, p, b, 0.45);
            add(e < 0.5 ? B.sc[m] : T.c[p], x, y, r);
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
            const ang = hash01(p, 5, 1) * Math.PI * 2;
            const dist = 40 + 140 * hash01(p, 5, 2);
            const x1 = br.left + T.x[p];
            const y1 = br.top + T.y[p];
            const x0 = x1 + Math.cos(ang) * dist * 1.3;
            const y0 = y1 + Math.sin(ang) * dist * 0.7 + 30;
            const [x, y] = this.path(x0, y0, x1, y1, e, p, b, 1);
            add(T.c[p], x, y, tr * Math.min(1, u / 0.15));
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
          const r = (ra + (rb - ra) * e) * (1 - 0.35 * Math.sin(Math.PI * e));
          const [x, y] = this.path(br.left + A.x[j], br.top + A.y[j], br.left + Bs.x[j], br.top + Bs.y[j], e, j, f, 1);
          add(e < 0.5 ? A.c[j] : Bs.c[j], x, y, r);
        }
      }
      P.fill(ctx, this.pal, alpha);
    });
  }

  /** curved path with a curl drift that peaks mid-flight */
  private path(x0: number, y0: number, x1: number, y1: number, e: number, j: number, time: number, bendScale: number) {
    return flight(x0, y0, x1, y1, e, this.bend[j] * bendScale, time, DRIFT * this.amp[j]);
  }

  destroy() {
    this.destroyed = true;
    this.offSwirl();
    this.buildId++;
    this.layer.release();
  }
}
