/**
 * Shared helpers for the Work set pieces: sample any picture (screenshot or a
 * synthetic placeholder) into a halftone dot grid in the same style as the
 * portrait (light dots on night, radius ~ luminance).
 */

export type DotGrid = {
  n: number;
  /** cell centre, normalised 0..1 inside the target rect */
  u: Float32Array;
  v: Float32Array;
  /** radius in CSS px */
  r: Float32Array;
  /** 1 = vermilion dot (strongly red source pixel) */
  red: Uint8Array;
  pitch: number;
};

export type Painter = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
) => void;

const imgCache = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = imgCache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => {
        imgCache.delete(src);
        reject(new Error(`image failed: ${src}`));
      };
      img.src = src;
    });
    imgCache.set(src, p);
  }
  return p;
}

/** object-fit: cover with object-position (fractions 0..1). */
export function coverPainter(img: HTMLImageElement, fx = 0, fy = 0): Painter {
  return (ctx, W, H) => {
    const k = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const dw = img.naturalWidth * k;
    const dh = img.naturalHeight * k;
    ctx.drawImage(img, (W - dw) * fx, (H - dh) * fy, dw, dh);
  };
}

/** "50% 42%" → [0.5, 0.42] (falls back to centre). */
export function parsePosition(pos: string | undefined): [number, number] {
  if (!pos) return [0.5, 0.5];
  const parts = pos
    .trim()
    .split(/\s+/)
    .map((s) => {
      if (s === "left" || s === "top") return 0;
      if (s === "right" || s === "bottom") return 1;
      if (s === "center") return 0.5;
      const v = parseFloat(s);
      return Number.isFinite(v)
        ? s.endsWith("%")
          ? v / 100
          : v === 0
            ? 0
            : 0.5
        : 0.5;
    });
  return [parts[0] ?? 0.5, parts[1] ?? parts[0] ?? 0.5];
}

/** Samples a painted W×H picture onto a dot grid with the given pitch. */
export function sampleDots(
  paint: Painter,
  W: number,
  H: number,
  pitch: number,
): DotGrid {
  const cols = Math.max(1, Math.floor(W / pitch));
  const rows = Math.max(1, Math.floor(H / pitch));
  const ss = 2;
  const c = document.createElement("canvas");
  c.width = cols * ss;
  c.height = rows * ss;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const n = cols * rows;
  const u = new Float32Array(n);
  const v = new Float32Array(n);
  const r = new Float32Array(n);
  const red = new Uint8Array(n);
  if (!ctx) return { n: 0, u, v, r, red, pitch };
  ctx.fillStyle = "#0c0c0d";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
  ctx.imageSmoothingQuality = "high";
  paint(ctx, W, H);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const maxR = pitch * 0.46;
  const minR = pitch * 0.08;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let R = 0;
      let G = 0;
      let B = 0;
      for (let y = 0; y < ss; y++)
        for (let x = 0; x < ss; x++) {
          const p = ((j * ss + y) * c.width + i * ss + x) * 4;
          R += d[p];
          G += d[p + 1];
          B += d[p + 2];
        }
      R /= ss * ss;
      G /= ss * ss;
      B /= ss * ss;
      const lum = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
      const k = j * cols + i;
      u[k] = (i + 0.5) / cols;
      v[k] = (j + 0.5) / rows;
      r[k] = minR + (maxR - minR) * Math.pow(lum, 0.8);
      red[k] = R - Math.max(G, B) > 70 ? 1 : 0;
    }
  }
  return { n, u, v, r, red, pitch };
}

/** Bedulo's ruled journal card (matches .wk-journal in work.css). */
export const journalPainter: Painter = (ctx, W, H) => {
  ctx.fillStyle = "#0c0c0d";
  ctx.fillRect(0, 0, W, H);
  const pad = 14;
  // paper a touch darker than the real card so the dot field keeps texture
  ctx.fillStyle = "#c9c3b8";
  ctx.beginPath();
  ctx.roundRect(pad, pad, W - pad * 2, H - pad * 2, 10);
  ctx.fill();
  ctx.fillStyle = "rgba(5,5,5,0.8)";
  for (let y = pad + 58 + 41; y < H - pad; y += 42)
    ctx.fillRect(pad, y - 2, W - pad * 2, 5);
  ctx.fillStyle = "#ff3b2f";
  ctx.fillRect(pad + (W - pad * 2) * 0.07 - 3, pad, 7, H - pad * 2);
};

/** "Preview pending" strip (ivory gradient + chip). */
export const pendingPainter: Painter = (ctx, W, H) => {
  const g = ctx.createLinearGradient(0, 0, W, H * 0.3);
  g.addColorStop(0, "#f7f2e9");
  g.addColorStop(0.55, "#efe8db");
  g.addColorStop(1, "#6e6a64");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(5,5,5,0.3)";
  ctx.beginPath();
  ctx.roundRect(W * 0.07, H / 2 - 30, 80, 60, 14);
  ctx.fill();
};

/** "[ Not built yet ]" strip. */
export const plannedPainter: Painter = (ctx, W, H) => {
  ctx.fillStyle = "#141416";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(244,239,230,0.55)";
  ctx.fillRect(W * 0.3, H * 0.46, W * 0.4, H * 0.08);
};

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const norm = (x: number, a: number, b: number) =>
  clamp01((x - a) / (b - a));
export const easeInOut = (t: number) => t * t * (3 - 2 * t);
export const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
export const easeIn = (t: number) => t * t;

/** Draws dots (x,y,r arrays in CSS px) as one path per colour. */
export function fillDots(
  ctx: CanvasRenderingContext2D,
  xs: Float32Array,
  ys: Float32Array,
  rs: Float32Array,
  pick: (i: number) => boolean,
  count: number,
) {
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    if (!pick(i)) continue;
    const r = rs[i];
    if (r <= 0.05) continue;
    if (r < 0.75) {
      ctx.rect(xs[i] - r, ys[i] - r, r * 2, r * 2);
    } else {
      ctx.moveTo(xs[i] + r, ys[i]);
      ctx.arc(xs[i], ys[i], r, 0, Math.PI * 2);
    }
  }
  ctx.fill();
}
