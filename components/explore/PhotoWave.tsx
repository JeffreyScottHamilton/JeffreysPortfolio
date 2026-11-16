"use client";
import { useEffect, useRef, useState } from "react";
import { usePortfolio } from "@/components/shared/context";
import type { Media } from "@/content/media";
import { dprCap } from "@/components/shared/dotText";

/**
 * The ONE Explore photo area (recent photos). Holds each photo, then a calm
 * "sand / rain" change: the photo turns into its halftone dots in place, the
 * dots fall away with gravity (column by column, left to right, draining out
 * of the bottom of the frame) while the next photo's dots rain in from the
 * top edge and land with a tiny bounce, stacking up from the bottom into the
 * new picture; then the real next photo resolves over its dots. Everything
 * stays inside the frame. Wraps around. Reduced motion: a plain fade.
 *
 * Timing uses only setTimeout / performance.now / requestAnimationFrame.
 * The FIRST <img> inside [data-gallery] is always the current photo.
 */
const HOLD_MS = 5800;
const WAVE_MS = 1300;
const REDUCED_HOLD_MS = 10000;
const TICK_MS = 200;
/** dots per photo (two photos are drawn at once) */
const MAX_DOTS = 6500;
const MIN_PITCH = 4.2;
const RED = "#e2402b";
const CYAN = "#20a7b8";

/* transition timeline, in ms */
const T_DOTS = 150; // photo → its halftone
const OUT_0 = 120; // first column starts to drain
const SWEEP = 620; // last column starts this much later
const OUT_COL = 70; // bottom → top release within a column
const FALL = 250; // time to fall the full frame height
const IN_0 = 250; // first column's bottom dot lands
const IN_COL = 170; // a column stacks up bottom → top over this long
const BOUNCE = 110;
const XFADE = 190; // real next photo over its dots
const GRAIN = 1.05; // radius of a dot in flight

type Loaded = { index: number; img: HTMLImageElement };
type Dots = { x: Float32Array; y: Float32Array; r: Float32Array; pitch: number };

function focalOf(m: Media) {
  const [x = "50%", y = "50%"] = m.focal.split(/\s+/);
  return { fx: parseFloat(x) / 100, fy: parseFloat(y) / 100 };
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sm = (v: number) => {
  const c = clamp01(v);
  return c * c * (3 - 2 * c);
};

export default function PhotoWave({
  photos,
  className = "",
}: {
  photos: Media[];
  className?: string;
}) {
  const { reducedMotion } = usePortfolio();
  const [userPaused, setUserPaused] = useState(false);
  const root = useRef<HTMLElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({
    index: 0,
    elapsed: 0,
    inView: false,
    focused: false,
    userPaused: false,
    busy: false,
    next: null as Loaded | null,
    currentImg: null as HTMLImageElement | null,
    loading: false,
    failed: new Set<number>(),
  });

  useEffect(() => {
    state.current.userPaused = userPaused;
  }, [userPaused]);

  useEffect(() => {
    const s = state.current;
    const el = root.current;
    const imgEl = imgRef.current;
    const canvas = canvasRef.current;
    if (!el || !imgEl || !canvas || photos.length < 2) return;
    let alive = true;
    const fast = new URLSearchParams(location.search).has("fast");
    const hold = reducedMotion ? REDUCED_HOLD_MS : fast ? 1500 : HOLD_MS;
    const timers = new Set<number>();
    let raf = 0;

    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
    };

    let precompute: (n: Loaded) => void = () => {};

    // ---- preload the next decodable photo (skip failures, never an empty box)
    const preload = (from: number, tries = 0) => {
      if (!alive || tries >= photos.length) return;
      const i = from % photos.length;
      if (i === s.index || s.failed.has(i)) {
        if (tries < photos.length - 1) preload(i + 1, tries + 1);
        return;
      }
      s.loading = true;
      const im = new Image();
      im.decoding = "async";
      im.src = photos[i].src!;
      im.decode()
        .then(() => {
          if (!alive) return;
          s.loading = false;
          s.next = { index: i, img: im };
          precompute(s.next);
        })
        .catch(() => {
          if (!alive) return;
          s.loading = false;
          s.failed.add(i);
          preload(i + 1, tries + 1);
        });
    };

    const commit = (n: Loaded) => {
      s.index = n.index;
      s.currentImg = n.img;
      imgEl.src = photos[n.index].src!;
      imgEl.alt = photos[n.index].alt;
      imgEl.style.objectPosition = photos[n.index].focal;
      s.next = null;
      preload(n.index + 1);
    };

    // ---- sand / rain transition, drawn on a canvas inside the photo window
    // (the window's rounded clip keeps every dot inside the frame)
    const ctx = canvas.getContext("2d");
    const view = imgEl.parentElement as HTMLElement;
    const ink = getComputedStyle(el).getPropertyValue("--ink").trim() || "#121212";

    const drawCover = (
      c: CanvasRenderingContext2D,
      im: HTMLImageElement,
      m: Media,
      x: number,
      y: number,
      w: number,
      h: number,
    ) => {
      const iw = im.naturalWidth || w;
      const ih = im.naturalHeight || h;
      const k = Math.max(w / iw, h / ih);
      const dw = iw * k;
      const dh = ih * k;
      const { fx, fy } = focalOf(m);
      c.drawImage(im, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh);
    };

    const dotCache = new Map<string, Dots>();
    const sampler = document.createElement("canvas");
    const sctx = sampler.getContext("2d", { willReadFrequently: true });

    /** halftone of a photo on a staggered grid (view-local px) */
    const dotsOf = (i: number, im: HTMLImageElement, w: number, h: number): Dots | null => {
      const key = `${i}:${Math.round(w)}x${Math.round(h)}`;
      const hit = dotCache.get(key);
      if (hit) return hit;
      if (!sctx) return null;
      const P = Math.max(MIN_PITCH, Math.sqrt((w * h) / (MAX_DOTS * 0.866)));
      const dyRow = P * 0.866;
      const cols = Math.max(1, Math.round(w / P));
      const rows = Math.max(1, Math.round(h / dyRow));
      const px = w / cols;
      const py = h / rows;
      // 2×2 samples per cell
      sampler.width = cols * 2;
      sampler.height = rows * 2;
      sctx.imageSmoothingEnabled = true;
      sctx.imageSmoothingQuality = "high";
      sctx.clearRect(0, 0, cols * 2, rows * 2);
      drawCover(sctx, im, photos[i], 0, 0, cols * 2, rows * 2);
      let d: Uint8ClampedArray;
      try {
        d = sctx.getImageData(0, 0, cols * 2, rows * 2).data;
      } catch {
        return null;
      }
      const W2 = cols * 2;
      const lum = (x: number, y: number) => {
        const q = (y * W2 + x) * 4;
        return (0.2126 * d[q] + 0.7152 * d[q + 1] + 0.0722 * d[q + 2]) / 255;
      };
      const maxR = Math.min(px, py) * 0.56;
      const xs: number[] = [];
      const ys: number[] = [];
      const rs: number[] = [];
      for (let j = 0; j < rows; j++) {
        const shift = j % 2 ? 0.5 : 0;
        for (let c = 0; c < cols; c++) {
          const sx = Math.min(W2 - 2, Math.round((c + shift) * 2));
          const sy = j * 2;
          const L = (lum(sx, sy) + lum(sx + 1, sy) + lum(sx, sy + 1) + lum(sx + 1, sy + 1)) / 4;
          const t = clamp01((0.94 - L) / 0.82);
          const r = maxR * Math.sqrt(t);
          if (r < 0.45) continue;
          xs.push((c + 0.5 + shift) * px);
          ys.push((j + 0.5) * py);
          rs.push(r);
        }
      }
      const out: Dots = {
        x: Float32Array.from(xs),
        y: Float32Array.from(ys),
        r: Float32Array.from(rs),
        pitch: Math.min(px, py),
      };
      dotCache.set(key, out);
      return out;
    };
    const frameSize = () => ({
      w: Math.max(1, view.clientWidth),
      h: Math.max(1, view.clientHeight),
    });
    // precompute the next photo's dots as soon as it has decoded
    precompute = (n: Loaded) => {
      const { w, h } = frameSize();
      if (view.clientWidth > 0) dotsOf(n.index, n.img, w, h);
    };

    let waves = 0;
    const runWave = (n: Loaded) => {
      const oldImg = s.currentImg ?? imgEl;
      const { w: vw, h: vh } = frameSize();
      const from = ctx ? dotsOf(s.index, oldImg, vw, vh) : null;
      const to = ctx ? dotsOf(n.index, n.img, vw, vh) : null;
      if (!ctx || !from || !to) {
        runFade(n);
        return;
      }
      s.busy = true;
      canvas.style.display = "block";
      const dpr = dprCap();
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      const bg = getComputedStyle(view).backgroundColor || "#efe8db";
      const oldMeta = photos[s.index];
      const newMeta = photos[n.index];
      const rnd = rng(++waves * 7919 + n.index * 31);
      const gOut = (2 * vh) / (FALL * FALL); // px / ms²

      // outgoing: release time (bottom of a column first), sideways drift
      const A = from.x.length;
      const aRel = new Float32Array(A);
      const aVx = new Float32Array(A);
      const aFr = new Uint8Array(A);
      for (let k = 0; k < A; k++) {
        const u = from.x[k] / vw;
        const v = from.y[k] / vh;
        aRel[k] = OUT_0 + SWEEP * (u + (rnd() - 0.5) * 0.05) + OUT_COL * (1 - v) * (0.75 + 0.5 * rnd());
        aVx[k] = (rnd() - 0.35) * 0.03; // px / ms, a little toward the sweep
        aFr[k] = rnd() < 0.09 ? 1 : 0;
      }
      // incoming: landing time (stacks up bottom → top), fall height
      const B = to.x.length;
      const bLand = new Float32Array(B);
      const bV0 = new Float32Array(B);
      const bVx = new Float32Array(B);
      const bFr = new Uint8Array(B);
      for (let k = 0; k < B; k++) {
        const u = to.x[k] / vw;
        const v = to.y[k] / vh;
        bLand[k] = IN_0 + SWEEP * (u + (rnd() - 0.5) * 0.05) + IN_COL * (1 - v) * (0.85 + 0.3 * rnd());
        bV0[k] = 0.25 + 0.2 * rnd(); // px / ms already falling as it enters
        bVx[k] = (rnd() - 0.5) * 0.012;
        bFr[k] = rnd() < 0.09 ? 1 : 0;
      }
      const end = WAVE_MS;
      const inStart = end - XFADE;
      const start = performance.now();
      const TAU = Math.PI * 2;

      const frame = () => {
        if (!alive) return;
        const ms = Math.min(end, performance.now() - start);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, vw, vh);

        const dots = new Path2D();
        const grains = new Path2D(); // dots in flight
        const red = new Path2D();
        const cyan = new Path2D();
        const dot = (x: number, y: number, r: number, vy: number, fr: number) => {
          if (y < -r * 3 || y > vh + r * 3) return;
          // fast dots stretch a little along the fall
          const st = Math.min(0.7, vy * 0.5);
          const path = vy > 0.05 ? grains : dots;
          path.moveTo(x + r, y);
          if (st > 0.08) path.ellipse(x, y, r, r * (1 + st), 0, 0, TAU);
          else path.arc(x, y, r, 0, TAU);
          if (fr && vy > 0.45) {
            const o = Math.min(2.2, r * 0.7);
            const rr = r * 0.8;
            red.moveTo(x + rr, y - o);
            red.ellipse(x, y - o, rr, rr * (1 + st), 0, 0, TAU);
            cyan.moveTo(x + rr, y + o);
            cyan.ellipse(x, y + o, rr, rr * (1 + st), 0, 0, TAU);
          }
        };

        // outgoing sand: in place, then falls and drains out of the bottom
        for (let k = 0; k < A; k++) {
          const tau = ms - aRel[k];
          const x0 = from.x[k];
          const y0 = from.y[k];
          if (tau <= 0) {
            dot(x0, y0, from.r[k], 0, 0);
            continue;
          }
          const y = y0 + 0.5 * gOut * tau * tau;
          if (y > vh + 12) continue;
          // grains thin out as they speed up
          const r0 = from.r[k];
          const rf = r0 + (Math.min(r0, GRAIN) - r0) * sm(tau / (FALL * 0.45));
          dot(x0 + aVx[k] * tau, y, rf, gOut * tau, aFr[k]);
        }
        // incoming rain: falls in from the top edge, lands, tiny bounce
        for (let k = 0; k < B; k++) {
          const tau = bLand[k] - ms; // time until landing
          const x1 = to.x[k];
          const y1 = to.y[k];
          const r1 = to.r[k];
          if (tau > 0) {
            const y = y1 - bV0[k] * tau - 0.5 * gOut * tau * tau;
            if (y < -r1 * 3) continue;
            dot(x1 - bVx[k] * tau, y, Math.min(r1, GRAIN), bV0[k] + gOut * tau, bFr[k]);
          } else {
            // lands, grows into its halftone dot with a tiny hop
            const q = -tau / BOUNCE;
            const hop = q < 1 ? Math.sin(Math.PI * q) * Math.min(2.2, to.pitch * 0.4) * (1 - q) : 0;
            const rg = Math.min(r1, GRAIN) + (r1 - Math.min(r1, GRAIN)) * sm(q * 1.4);
            dot(x1, y1 - hop, rg, 0, 0);
          }
        }

        ctx.fillStyle = RED;
        ctx.fill(red);
        ctx.fillStyle = CYAN;
        ctx.fill(cyan);
        ctx.fillStyle = ink;
        ctx.fill(dots);
        ctx.globalAlpha = 0.72;
        ctx.fill(grains);
        ctx.globalAlpha = 1;

        // the old photo dissolves into its dots; the real next photo resolves over its own
        const out = 1 - sm(ms / T_DOTS);
        if (out > 0.002) {
          ctx.globalAlpha = out;
          drawCover(ctx, oldImg, oldMeta, 0, 0, vw, vh);
        }
        const inn = sm((ms - inStart) / XFADE);
        if (inn > 0.002) {
          ctx.globalAlpha = inn;
          drawCover(ctx, n.img, newMeta, 0, 0, vw, vh);
        }
        ctx.globalAlpha = 1;

        if (ms >= T_DOTS && s.next === n) {
          // swap the real <img> while the canvas fully covers it
          commit(n);
        }
        if (ms < end) {
          raf = requestAnimationFrame(frame);
        } else {
          canvas.style.display = "none";
          canvas.width = canvas.height = 0;
          s.busy = false;
          s.elapsed = 0;
        }
      };
      raf = requestAnimationFrame(frame);
    };

    const runFade = (n: Loaded) => {
      s.busy = true;
      imgEl.style.opacity = "0";
      later(() => {
        commit(n);
        imgEl.style.opacity = "1";
        later(() => {
          s.busy = false;
          s.elapsed = 0;
        }, 500);
      }, 500);
    };

    const playable = () =>
      s.inView && !document.hidden && !s.focused && !s.userPaused;

    const tick = () => {
      if (!alive) return;
      if (!s.busy && playable()) {
        s.elapsed += TICK_MS;
        if (s.elapsed >= hold) {
          if (s.next) {
            const n = s.next;
            if (reducedMotion) runFade(n);
            else runWave(n);
          } else if (!s.loading) {
            preload(s.index + 1);
          }
        }
      }
      later(tick, TICK_MS);
    };

    const io = new IntersectionObserver(
      ([e]) => {
        s.inView = e.isIntersecting;
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    const onFocusIn = () => (s.focused = true);
    const onFocusOut = (e: FocusEvent) => {
      if (!el.contains(e.relatedTarget as Node | null)) s.focused = false;
    };
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);

    // initial image failed? skip to the next one so the box is never empty
    const onError = () => {
      s.failed.add(s.index);
      const i = (s.index + 1) % photos.length;
      if (s.failed.size >= photos.length) return;
      s.index = i;
      imgEl.src = photos[i].src!;
      imgEl.alt = photos[i].alt;
      imgEl.style.objectPosition = photos[i].focal;
    };
    imgEl.addEventListener("error", onError);

    // decoded copy of the current photo, so the canvas can keep drawing it
    // after the <img> src has been swapped mid-wave
    const snap = new Image();
    snap.src = photos[s.index].src!;
    snap.decode().then(
      () => {
        if (alive && !s.currentImg) s.currentImg = snap;
      },
      () => {},
    );

    preload(s.index + 1);
    later(tick, TICK_MS);

    return () => {
      alive = false;
      timers.forEach((t) => clearTimeout(t));
      cancelAnimationFrame(raf);
      // never leave a half-drawn wave frame over the photo
      canvas.style.display = "none";
      canvas.width = canvas.height = 0;
      imgEl.style.opacity = "1";
      io.disconnect();
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
      imgEl.removeEventListener("error", onError);
      s.busy = false;
    };
  }, [photos, reducedMotion]);

  const first = photos[0];
  if (!first) return null;

  return (
    <figure
      ref={root}
      className={`photo-wave ${className}`}
      data-gallery=""
    >
      <figcaption className="photo-wave-label">
        Lately — the last couple of years
      </figcaption>
      <div className="photo-wave-tilt">
        <div className="photo-wave-view">
          {/* src/alt are driven imperatively after mount (current photo) */}
          <img
            ref={imgRef}
            className="photo-wave-img"
            src={first.src}
            alt={first.alt}
            style={{ objectPosition: first.focal }}
            decoding="async"
            draggable={false}
          />
          <canvas ref={canvasRef} className="photo-wave-fx" aria-hidden="true" />
        </div>
      </div>
      <button
        type="button"
        className="photo-wave-toggle"
        aria-pressed={userPaused}
        onClick={() => setUserPaused((v) => !v)}
      >
        {userPaused ? "Resume photo changes" : "Pause photo changes"}
      </button>
    </figure>
  );
}
