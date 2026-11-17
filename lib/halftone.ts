/**
 * Halftone portrait geometry + sampling + static rendering.
 *
 * Every layer (dots, glyphs, halo, colour photo) is derived from ONE source
 * image (`portrait-cutout.webp`, same pixel grid as portrait-original.jpg)
 * through ONE source rect -> dest rect mapping (`computeLayout`). That shared
 * mapping is what keeps the pointer reveal registered with the dots.
 */

export type Tone = "dark" | "light";
export type Framing = "bust" | "face";

export const CUTOUT_SRC = "/media/portrait-cutout.webp";
export const SRC_W = 1100;
export const SRC_H = 1489;

/** Source rects in portrait-original.jpg pixel space. */
const SOURCE_RECT: Record<Framing, { x: number; y: number; w: number; h: number }> = {
  // head + shoulders, a little air above the hair for scatter
  bust: { x: 0, y: 285, w: 1100, h: 1204 },
  // hairline to chin, ear to ear
  face: { x: 318, y: 335, w: 462, h: 600 },
};

/** Head centre / radius in source pixels (used for letter + assemble placement). */
const HEAD = { x: 548, y: 600, r: 255 };

export type Layout = {
  W: number;
  H: number;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  /** dest px per source px */
  k: number;
  headX: number;
  headY: number;
  headR: number;
};

export function computeLayout(W: number, H: number, framing: Framing): Layout {
  const s = SOURCE_RECT[framing];
  let k: number;
  let dx: number;
  let dy: number;
  if (framing === "face") {
    // head fills the box height; face anchored to the right edge
    k = H / s.h;
    dx = W - s.w * k;
    dy = 0;
  } else {
    // contain, anchored bottom-centre
    k = Math.min(W / s.w, H / s.h);
    dx = (W - s.w * k) / 2;
    dy = H - s.h * k;
  }
  return {
    W,
    H,
    sx: s.x,
    sy: s.y,
    sw: s.w,
    sh: s.h,
    dx,
    dy,
    dw: s.w * k,
    dh: s.h * k,
    k,
    headX: dx + (HEAD.x - s.x) * k,
    headY: dy + (HEAD.y - s.y) * k,
    headR: HEAD.r * k,
  };
}

/** Draws the source image through the shared mapping. */
export function drawSource(ctx: CanvasRenderingContext2D, img: CanvasImageSource, L: Layout) {
  ctx.drawImage(img, L.sx, L.sy, L.sw, L.sh, L.dx, L.dy, L.dw, L.dh);
}

let imgPromise: Promise<HTMLImageElement> | null = null;
export function loadCutout(): Promise<HTMLImageElement> {
  if (!imgPromise) {
    imgPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => {
        imgPromise = null;
        reject(new Error("portrait image failed to load"));
      };
      img.src = CUTOUT_SRC;
    });
  }
  return imgPromise;
}

/* ---------------------------------------------------------------- random */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable per-cell hash in [0,1). */
export function hash01(i: number, j: number, salt = 0) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Edge dissolve where the source photo is cropped (shoulders at the sides in
 * bust framing, chest at the bottom). u, v are positions normalised to the
 * drawn source rect (Layout dx/dy/dw/dh). Shared by the dots and the revealed
 * colour photo so both dissolve together.
 */
export function cropFade(u: number, v: number, framing: Framing) {
  const side = framing === "face" ? 1 : smooth(0, 0.2, Math.min(u, 1 - u));
  return side * smooth(0, 0.26, 1 - v);
}

/* ---------------------------------------------------------------- field */

export type Field = {
  cols: number;
  rows: number;
  pitch: number;
  ox: number;
  oy: number;
  /** rest position of each cell's mark */
  x: Float32Array;
  y: Float32Array;
  /** radius (0 = empty cell) */
  r: Float32Array;
  /** opacity */
  a: Float32Array;
  /** glyph index into glyph string, -1 = round dot */
  g: Int16Array;
  /** indices of non-empty cells */
  live: Uint32Array;
  /** floating italic letters around the head */
  letters: { x: number; y: number; ch: string; size: number; a: number }[];
  glyphs: string;
  glyphScale: number;
};

type Sample = { L: Float32Array; A: Float32Array; cols: number; rows: number };

/** Area-samples the source (through the shared mapping) onto the cell grid. */
function sampleGrid(img: CanvasImageSource, Lay: Layout, cols: number, rows: number, pitch: number, ox: number, oy: number): Sample {
  const ss = 3; // supersample per cell
  const cw = cols * ss;
  const ch = rows * ss;
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const f = ss / pitch;
  ctx.setTransform(f, 0, 0, f, -ox * f, -oy * f);
  drawSource(ctx, img, Lay);
  const d = ctx.getImageData(0, 0, cw, ch).data;
  const L = new Float32Array(cols * rows);
  const A = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let lum = 0;
      let al = 0;
      for (let v = 0; v < ss; v++) {
        let p = ((j * ss + v) * cw + i * ss) * 4;
        for (let u = 0; u < ss; u++, p += 4) {
          const a = d[p + 3] / 255;
          lum += a * (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]);
          al += a;
        }
      }
      const n = j * cols + i;
      A[n] = al / (ss * ss);
      L[n] = al > 0 ? lum / al / 255 : 0;
    }
  }
  return { L, A, cols, rows };
}

/** Separable box blur restricted to body cells (alpha-weighted). */
function blurMasked(L: Float32Array, W: Float32Array, cols: number, rows: number, rad: number) {
  const tmpV = new Float32Array(L.length);
  const tmpW = new Float32Array(L.length);
  const out = new Float32Array(L.length);
  for (let j = 0; j < rows; j++) {
    let sv = 0;
    let sw = 0;
    const row = j * cols;
    for (let i = -rad; i < cols + rad; i++) {
      const ia = i + rad;
      if (ia < cols && ia >= 0) {
        sv += L[row + ia] * W[row + ia];
        sw += W[row + ia];
      }
      const ir = i - rad - 1;
      if (ir >= 0 && ir < cols) {
        sv -= L[row + ir] * W[row + ir];
        sw -= W[row + ir];
      }
      if (i >= 0 && i < cols) {
        tmpV[row + i] = sv;
        tmpW[row + i] = sw;
      }
    }
  }
  for (let i = 0; i < cols; i++) {
    let sv = 0;
    let sw = 0;
    for (let j = -rad; j < rows + rad; j++) {
      const ja = j + rad;
      if (ja < rows && ja >= 0) {
        sv += tmpV[ja * cols + i];
        sw += tmpW[ja * cols + i];
      }
      const jr = j - rad - 1;
      if (jr >= 0 && jr < rows) {
        sv -= tmpV[jr * cols + i];
        sw -= tmpW[jr * cols + i];
      }
      if (j >= 0 && j < rows) {
        const n = j * cols + i;
        out[n] = sw > 1e-4 ? sv / sw : L[n];
      }
    }
  }
  return out;
}

/** Chamfer distance (in cells) from the silhouette (alpha >= 0.5). */
function distanceOutside(A: Float32Array, cols: number, rows: number) {
  const INF = 1e9;
  const D = new Float32Array(cols * rows);
  for (let n = 0; n < D.length; n++) D[n] = A[n] >= 0.5 ? 0 : INF;
  const a = 1;
  const b = Math.SQRT2;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const n = j * cols + i;
      let v = D[n];
      if (i > 0) v = Math.min(v, D[n - 1] + a);
      if (j > 0) {
        v = Math.min(v, D[n - cols] + a);
        if (i > 0) v = Math.min(v, D[n - cols - 1] + b);
        if (i < cols - 1) v = Math.min(v, D[n - cols + 1] + b);
      }
      D[n] = v;
    }
  for (let j = rows - 1; j >= 0; j--)
    for (let i = cols - 1; i >= 0; i--) {
      const n = j * cols + i;
      let v = D[n];
      if (i < cols - 1) v = Math.min(v, D[n + 1] + a);
      if (j < rows - 1) {
        v = Math.min(v, D[n + cols] + a);
        if (i < cols - 1) v = Math.min(v, D[n + cols + 1] + b);
        if (i > 0) v = Math.min(v, D[n + cols - 1] + b);
      }
      D[n] = v;
    }
  return D;
}

function makeGrid(Lay: Layout, pitch: number) {
  const cols = Math.max(1, Math.floor(Lay.W / pitch));
  const rows = Math.max(1, Math.floor(Lay.H / pitch));
  const ox = (Lay.W - cols * pitch) / 2;
  const oy = (Lay.H - rows * pitch) / 2;
  return { cols, rows, ox, oy };
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  values.sort((x, y) => x - y);
  return values[Math.min(values.length - 1, Math.max(0, Math.floor(p * (values.length - 1))))];
}

/** loose characters scattered over the portrait: code symbols */
const LETTERS = "{}<>/;=()[]#$&*|";

function placeLetters(Lay: Layout, framing: Framing, D: Float32Array, cols: number, rows: number, pitch: number, ox: number, oy: number, count: number) {
  const rnd = mulberry32(framing === "face" ? 917 : 4242);
  const out: Field["letters"] = [];
  const base = Math.max(11, Math.min(22, Lay.headR * 0.075));
  let tries = 0;
  while (out.length < count && tries++ < 600) {
    // ring around the head, biased to the sides/top
    const ang = -Math.PI * 1.05 + rnd() * Math.PI * 1.35 + (rnd() < 0.5 ? 0 : Math.PI * 0.35);
    const rad = Lay.headR * (1.25 + rnd() * 1.1);
    const x = Lay.headX + Math.cos(ang) * rad * 1.15;
    const y = Lay.headY + Math.sin(ang) * rad;
    if (x < 8 || y < 8 || x > Lay.W - 8 || y > Lay.H - 8) continue;
    const ci = Math.floor((x - ox) / pitch);
    const cj = Math.floor((y - oy) / pitch);
    if (ci < 0 || cj < 0 || ci >= cols || cj >= rows) continue;
    if (D[cj * cols + ci] < 6) continue;
    if (out.some((l) => Math.hypot(l.x - x, l.y - y) < base * 4)) continue;
    out.push({
      x,
      y,
      ch: LETTERS[Math.floor(rnd() * LETTERS.length)],
      size: base * (0.8 + rnd() * 0.5),
      a: 0.55 + rnd() * 0.35,
    });
  }
  return out;
}

export type BuildOptions = {
  tone: Tone;
  framing: Framing;
  glyphs: string;
};

/** Dense luminance-driven dot grid with glyph cells and scattered edge dots. */
export function buildHalftone(img: CanvasImageSource, Lay: Layout, opts: BuildOptions): Field {
  const { tone, framing, glyphs } = opts;
  const pitch = Math.min(6, Math.max(2.2, Lay.dh / (framing === "face" ? 210 : 300)));
  const { cols, rows, ox, oy } = makeGrid(Lay, pitch);
  const S = sampleGrid(img, Lay, cols, rows, pitch, ox, oy);
  const n = cols * rows;
  const body = new Float32Array(n);
  for (let p = 0; p < n; p++) body[p] = S.A[p] > 0.35 ? 1 : 0;

  // local contrast: fine detail + mid-scale structure (eyes, brows, mouth)
  const b1 = blurMasked(S.L, body, cols, rows, 1);
  const b2 = blurMasked(S.L, body, cols, rows, Math.max(3, Math.round(cols / 40)));
  const E = new Float32Array(n);
  const vals: number[] = [];
  for (let p = 0; p < n; p++) {
    const e = S.L[p] + 1.2 * (S.L[p] - b1[p]) + 0.35 * (S.L[p] - b2[p]);
    E[p] = e;
    if (S.A[p] > 0.9) vals.push(e);
  }
  const lo = percentile(vals.slice(), 0.04);
  const hi = percentile(vals, 0.975);
  const D = distanceOutside(S.A, cols, rows);

  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const r = new Float32Array(n);
  const a = new Float32Array(n);
  const g = new Int16Array(n).fill(-1);
  const live: number[] = [];
  const maxR = pitch * 0.55;

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const p = j * cols + i;
      const cx = ox + (i + 0.5) * pitch;
      const cy = oy + (j + 0.5) * pitch;
      const h = hash01(i, j, 1);
      const h2 = hash01(i, j, 2);
      const al = S.A[p];
      if (al >= 0.06) {
        let t = Math.min(1, Math.max(0, (E[p] - lo) / (hi - lo || 1)));
        // firm S-curve on dark (reference punch); softer on light so highlights keep fine dots
        t = tone === "dark" ? t * 0.2 + smooth(0, 1, t) * 0.8 : t * 0.55 + smooth(0, 1, t) * 0.45;
        const ink = tone === "dark" ? t : 1 - t; // amount of "mark"
        // area-proportional dots (radius ~ sqrt of ink), slight gamma for punch
        const minR = pitch * (tone === "dark" ? 0.08 : 0.17);
        let rad = minR + (maxR - minR) * Math.pow(ink, tone === "dark" ? 0.78 : 0.7);
        let op = 1;
        // The photo is cropped at the shoulders (sides) and chest (bottom).
        // Instead of hard cuts, dissolve the body into scattered dots there,
        // like the reference frames.
        const u = (cx - Lay.dx) / Lay.dw;
        const v = (cy - Lay.dy) / Lay.dh;
        const keep = cropFade(u, v, framing);
        if (keep < 1) {
          if (h > Math.pow(keep, 0.9) * 1.05) continue;
          rad *= 0.45 + 0.55 * keep;
          op *= 0.4 + 0.6 * keep;
        }
        // No "mesh": near-empty cells (deep shadow on dark, bright paper on
        // light) get only a sparse sprinkle instead of a uniform grid of specks.
        if (ink < 0.1 && h > ink * 7) continue;
        if (al < 0.85) {
          // dissolve: hair wisps / soft edges become sparse
          if (h > al * 1.25) continue;
          rad *= 0.55 + 0.45 * al;
          op = 0.55 + 0.45 * al;
        }
        // slight jitter breaks the rigid grid (moiré on the plaid shirt)
        const jit = al < 0.85 || keep < 1 ? 0.5 : 0.14;
        x[p] = cx + (h2 - 0.5) * pitch * jit;
        y[p] = cy + (hash01(i, j, 3) - 0.5) * pitch * jit;
        r[p] = rad;
        a[p] = op;
        // small glyphs in mid tones (never inside the eyes/teeth extremes)
        // only in flat mid-tone areas so features (eyes, brows, teeth) stay intact
        if (ink > 0.3 && ink < 0.7 && al > 0.95 && Math.abs(S.L[p] - b2[p]) < 0.035 && Math.abs(S.L[p] - b1[p]) < 0.02 && (i + j) % 2 === 0 && hash01(i, j, 4) < 0.05) {
          g[p] = Math.floor(hash01(i, j, 5) * glyphs.length);
        }
        live.push(p);
      } else {
        // scattered dots dissolving away from the silhouette
        const d = D[p];
        if (d > 60) continue;
        const prob = 0.42 * Math.exp(-d / 3.2) + 0.05 * Math.exp(-d / 14) + 0.012;
        // same edge dissolve as the body, so the photo's crop line never shows
        const uu = (cx - Lay.dx) / Lay.dw;
        const vv = (cy - Lay.dy) / Lay.dh;
        const edge = cropFade(uu, vv, framing);
        if (h > prob * edge) continue;
        const near = Math.exp(-d / 6);
        x[p] = cx + (h2 - 0.5) * pitch * 0.8;
        y[p] = cy + (hash01(i, j, 3) - 0.5) * pitch * 0.8;
        r[p] = pitch * (0.12 + 0.22 * near * hash01(i, j, 6) + 0.06);
        a[p] = 0.35 + 0.6 * near;
        if (d > 3 && hash01(i, j, 4) < 0.035) {
          g[p] = Math.floor(hash01(i, j, 5) * glyphs.length);
          a[p] = 0.5 + 0.3 * near;
        }
        live.push(p);
      }
    }
  }

  return {
    cols,
    rows,
    pitch,
    ox,
    oy,
    x,
    y,
    r,
    a,
    g,
    live: Uint32Array.from(live),
    letters: placeLetters(Lay, framing, D, cols, rows, pitch, ox, oy, framing === "face" ? 9 : 14),
    glyphs,
    glyphScale: 1.75,
  };
}

/** Fine stippled halo + a few glyphs around the silhouette (cutout variant). */
export function buildHalo(img: CanvasImageSource, Lay: Layout, opts: BuildOptions): Field {
  const { framing, glyphs } = opts;
  const pitch = Math.min(4, Math.max(2.2, Lay.dh / 300));
  const { cols, rows, ox, oy } = makeGrid(Lay, pitch);
  const S = sampleGrid(img, Lay, cols, rows, pitch, ox, oy);
  const D = distanceOutside(S.A, cols, rows);
  const n = cols * rows;
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const r = new Float32Array(n);
  const a = new Float32Array(n);
  const g = new Int16Array(n).fill(-1);
  const live: number[] = [];
  const band = Math.max(3, 10 / pitch); // ~10px stippled outline band
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const p = j * cols + i;
      const d = D[p];
      if (d < 1.2 || d > band * 3.5) continue;
      const h = hash01(i, j, 11);
      const prob = d <= band ? 0.5 : 0.16 * Math.exp(-(d - band) / (band * 0.5));
      if (h > prob) continue;
      x[p] = ox + (i + 0.5) * pitch + (hash01(i, j, 12) - 0.5) * pitch * 0.7;
      y[p] = oy + (j + 0.5) * pitch + (hash01(i, j, 13) - 0.5) * pitch * 0.7;
      r[p] = pitch * (0.27 + 0.1 * hash01(i, j, 14)) * (d <= band ? 1 : 0.8);
      a[p] = d <= band ? 1 : 0.75;
      live.push(p);
    }
  }
  // a handful of small glyphs further out
  const rnd = mulberry32(framing === "face" ? 77 : 7);
  const letters: Field["letters"] = [];
  const size = Math.max(10, Math.min(15, Lay.dh / 55));
  let tries = 0;
  while (letters.length < 18 && tries++ < 4000) {
    const i = Math.floor(rnd() * cols);
    const j = Math.floor(rnd() * rows);
    const d = D[j * cols + i] * pitch;
    if (d < 16 || d > 70) continue;
    const lx = ox + (i + 0.5) * pitch;
    const ly = oy + (j + 0.5) * pitch;
    if (letters.some((l) => Math.hypot(l.x - lx, l.y - ly) < size * 5)) continue;
    letters.push({ x: lx, y: ly, ch: glyphs[Math.floor(rnd() * glyphs.length)], size, a: 0.85 });
  }
  return { cols, rows, pitch, ox, oy, x, y, r, a, g, live: Uint32Array.from(live), letters, glyphs, glyphScale: 1.75 };
}

/* ---------------------------------------------------------------- drawing */

export type Palette = { ink: string; red: string; cyan: string; bg: string };

export function palette(tone: Tone): Palette {
  return tone === "dark"
    ? { ink: "#f4efe6", red: "#ff3b2f", cyan: "#35c8e0", bg: "#050505" }
    : { ink: "#0b0b0c", red: "#e8402a", cyan: "#1fa9c4", bg: "#f7f2e9" };
}

export function glyphFont(size: number, family: string, italic = false) {
  return `${italic ? "italic " : ""}500 ${size.toFixed(1)}px ${family}`;
}

/** Renders the formed field (dots + glyphs + letters). */
export function drawField(ctx: CanvasRenderingContext2D, F: Field, color: string, family: string, withLetters = true, letterItalic = true) {
  ctx.fillStyle = color;
  // bucket by opacity to keep path count tiny
  const buckets = [1, 0.8, 0.6, 0.4];
  for (const ba of buckets) {
    ctx.globalAlpha = ba;
    ctx.beginPath();
    for (let q = 0; q < F.live.length; q++) {
      const p = F.live[q];
      if (F.g[p] >= 0) continue;
      const op = F.a[p];
      const bucket = op > 0.9 ? 1 : op > 0.7 ? 0.8 : op > 0.5 ? 0.6 : 0.4;
      if (bucket !== ba) continue;
      const rr = F.r[p];
      ctx.moveTo(F.x[p] + rr, F.y[p]);
      ctx.arc(F.x[p], F.y[p], rr, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = glyphFont(F.pitch * F.glyphScale, family);
  for (let q = 0; q < F.live.length; q++) {
    const p = F.live[q];
    if (F.g[p] < 0) continue;
    ctx.globalAlpha = F.a[p];
    ctx.fillText(F.glyphs[F.g[p]], F.x[p], F.y[p]);
  }
  if (withLetters) {
    for (const l of F.letters) {
      ctx.globalAlpha = l.a;
      ctx.font = glyphFont(l.size, family, letterItalic);
      ctx.fillText(l.ch, l.x, l.y);
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * Per-cell silhouette coverage of a built field: the same area sampling that
 * buildHalftone/buildHalo use (so `A < 0.06` are exactly the scattered dots
 * outside the body) plus the chamfer distance (cells) from the silhouette.
 */
export function fieldCoverage(img: CanvasImageSource, Lay: Layout, F: Field) {
  const S = sampleGrid(img, Lay, F.cols, F.rows, F.pitch, F.ox, F.oy);
  return { A: S.A, D: distanceOutside(S.A, F.cols, F.rows) };
}

/** canvas pixel ratio: ≤ 2, and ≤ 1.5 on phones (fill-rate / battery) */
export const dprCap = () =>
  Math.min(window.innerWidth <= 720 ? 1.5 : 2, window.devicePixelRatio || 1);
