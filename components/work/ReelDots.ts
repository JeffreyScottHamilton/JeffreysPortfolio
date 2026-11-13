/**
 * Reel row entrance: the row slides in from the right while its preview strip
 * assembles from a quick halftone dot pass, then the real strip fades in.
 * The canvas exists only while the row is mid-entrance.
 */
import { hash01, palette } from "@/lib/halftone";
import {
  clamp01,
  coverPainter,
  easeInOut,
  easeOut,
  fillDots,
  loadImage,
  norm,
  parsePosition,
  pendingPainter,
  plannedPainter,
  sampleDots,
  type DotGrid,
  type Painter,
} from "./dots";

const INK = palette("dark").ink;
const RED = palette("dark").red;

export class ReelDots {
  private row: HTMLElement;
  private wrap: HTMLElement;
  private strip: HTMLElement;
  private canvas: HTMLCanvasElement | null = null;
  private grid: DotGrid | null = null;
  private loading = false;
  private p = 0;
  private dead = false;
  private X = new Float32Array(0);
  private Y = new Float32Array(0);
  private R = new Float32Array(0);
  private red: Uint8Array = new Uint8Array(0);

  constructor(
    row: HTMLElement,
    private slideVw: number,
  ) {
    this.row = row;
    this.wrap = row.querySelector<HTMLElement>(".wk-row-strip")!;
    this.strip = this.wrap.querySelector<HTMLElement>(".wk-strip")!;
  }

  private painter(): Promise<Painter> {
    const img = this.strip.querySelector("img");
    if (img) {
      const [fx, fy] = parsePosition(img.style.objectPosition);
      return loadImage(img.currentSrc || img.src).then((im) =>
        coverPainter(im, fx, fy),
      );
    }
    return Promise.resolve(
      this.strip.classList.contains("wk-strip-planned")
        ? plannedPainter
        : pendingPainter,
    );
  }

  /** Loads + samples the strip picture (call a little before it enters). */
  prepare() {
    if (this.grid || this.loading || this.dead) return;
    this.loading = true;
    this.painter()
      .then((paint) => {
        if (this.dead) return;
        const W = this.strip.offsetWidth;
        const H = this.strip.offsetHeight;
        if (W < 8 || H < 8) return;
        const pitch = Math.max(3.2, Math.sqrt((W * H) / 2600));
        this.grid = sampleDots(paint, W, H, pitch);
        const n = this.grid.n;
        this.X = new Float32Array(n);
        this.Y = new Float32Array(n);
        this.R = new Float32Array(n);
        this.red = this.grid.red;
        this.render(this.p);
      })
      .catch(() => undefined)
      .finally(() => {
        this.loading = false;
      });
  }

  private mount() {
    if (this.canvas) return this.canvas;
    const c = document.createElement("canvas");
    c.className = "wk-strip-dots";
    c.setAttribute("aria-hidden", "true");
    this.wrap.appendChild(c);
    this.canvas = c;
    return c;
  }

  private unmount() {
    this.canvas?.remove();
    this.canvas = null;
  }

  /** p: 0 = not entered, 1 = settled. */
  render(p: number) {
    if (this.dead) return;
    this.p = p;
    const settled = p >= 1;
    const slide = 1 - easeOut(norm(p, 0, 0.7));
    if (settled) this.row.style.removeProperty("transform");
    else
      this.row.style.transform = `translate3d(${(slide * this.slideVw).toFixed(3)}vw,0,0)`;
    const reveal = easeInOut(norm(p, 0.72, 0.96));
    if (settled || reveal >= 1) this.strip.style.removeProperty("opacity");
    else this.strip.style.opacity = this.grid ? reveal.toFixed(3) : "1";

    if (settled || p <= 0) {
      this.unmount();
      return;
    }
    this.prepare();
    const G = this.grid;
    if (!G) return;
    const c = this.mount();
    const W = this.strip.offsetWidth;
    const H = this.strip.offsetHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.style.left = `${this.strip.offsetLeft}px`;
    c.style.top = `${this.strip.offsetTop}px`;
    c.style.width = `${W}px`;
    c.style.height = `${H}px`;
    const bw = Math.round(W * dpr);
    const bh = Math.round(H * dpr);
    if (c.width !== bw) c.width = bw;
    if (c.height !== bh) c.height = bh;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bw, bh);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = norm(p, 0.05, 0.85);
    for (let i = 0; i < G.n; i++) {
      const h = hash01(i, 3, 41);
      const g = easeOut(clamp01((k - h * 0.4) / 0.6));
      const tx = G.u[i] * W;
      const ty = G.v[i] * H;
      const sx = tx + W * (0.35 + hash01(i, 4, 42) * 0.9);
      const sy = ty + (hash01(i, 5, 43) - 0.5) * H * 1.4;
      this.X[i] = sx + (tx - sx) * g;
      this.Y[i] = sy + (ty - sy) * g;
      this.R[i] = G.r[i] * (0.4 + 0.6 * g);
    }
    ctx.globalAlpha = Math.min(1, k * 4) * (1 - norm(p, 0.86, 1));
    ctx.fillStyle = INK;
    fillDots(ctx, this.X, this.Y, this.R, (i) => !this.red[i], G.n);
    ctx.fillStyle = RED;
    fillDots(ctx, this.X, this.Y, this.R, (i) => this.red[i] === 1, G.n);
    ctx.globalAlpha = 1;
  }

  destroy() {
    this.dead = true;
    this.unmount();
    this.row.style.removeProperty("transform");
    this.strip.style.removeProperty("opacity");
  }
}
