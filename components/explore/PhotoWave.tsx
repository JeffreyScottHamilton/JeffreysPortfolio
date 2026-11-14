"use client";
import { useEffect, useRef, useState } from "react";
import { usePortfolio } from "@/components/shared/context";
import type { Media } from "@/content/media";

/**
 * The ONE Explore photo area (recent photos). Holds each photo, then the photo
 * dissolves into a halftone dot grid sampled from its luminance, the dots morph
 * in size to the NEXT photo's halftone along a soft diagonal sweep (with a
 * slight drift), and the real next photo resolves over its dots. Same effect
 * for every change; wraps around.
 *
 * Timing uses only setTimeout / performance.now / requestAnimationFrame.
 * The FIRST <img> inside [data-gallery] is always the current photo.
 */
const HOLD_MS = 6000;
const WAVE_MS = 900;
const REDUCED_HOLD_MS = 10000;
const TICK_MS = 200;

type Loaded = { index: number; img: HTMLImageElement };

function focalOf(m: Media) {
  const [x = "50%", y = "50%"] = m.focal.split(/\s+/);
  return { fx: parseFloat(x) / 100, fy: parseFloat(y) / 100 };
}

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

    // ---- canvas halftone morph
    const ctx = canvas.getContext("2d");
    const css = getComputedStyle(el);
    const ink = css.getPropertyValue("--ink").trim() || "#121212";
    const paper =
      css.getPropertyValue("--ivory").trim() ||
      css.getPropertyValue("--bg").trim() ||
      "#f7f2e9";

    const drawCover = (
      c: CanvasRenderingContext2D,
      im: HTMLImageElement,
      m: Media,
      w: number,
      h: number,
    ) => {
      const iw = im.naturalWidth || w;
      const ih = im.naturalHeight || h;
      const k = Math.max(w / iw, h / ih);
      const dw = iw * k;
      const dh = ih * k;
      const { fx, fy } = focalOf(m);
      c.drawImage(im, (w - dw) * fx, (h - dh) * fy, dw, dh);
    };

    // halftone grid for the frame's current layout size (not the tilted box)
    const gridFor = (w: number, h: number) => {
      const pitch = Math.min(6, Math.max(5, w / 110));
      const cols = Math.ceil(w / pitch);
      const rows = Math.ceil(h / pitch);
      return { pitch, cols, rows, key: `${cols}x${rows}` };
    };
    const tones = new Map<string, Float32Array>();
    const sampler = document.createElement("canvas");
    const sctx = sampler.getContext("2d", { willReadFrequently: true });

    /** dot radius per cell, sampled from the photo's luminance (dark = big) */
    const toneOf = (i: number, im: HTMLImageElement, w: number, h: number) => {
      const g = gridFor(w, h);
      const key = `${i}:${g.key}`;
      const hit = tones.get(key);
      if (hit) return hit;
      if (!sctx) return null;
      sampler.width = g.cols;
      sampler.height = g.rows;
      sctx.clearRect(0, 0, g.cols, g.rows);
      drawCover(sctx, im, photos[i], g.cols, g.rows);
      let d: Uint8ClampedArray;
      try {
        d = sctx.getImageData(0, 0, g.cols, g.rows).data;
      } catch {
        return null;
      }
      const maxR = g.pitch * 0.56;
      const r = new Float32Array(g.cols * g.rows);
      for (let p = 0; p < r.length; p++) {
        const L =
          (0.2126 * d[p * 4] + 0.7152 * d[p * 4 + 1] + 0.0722 * d[p * 4 + 2]) /
          255;
        const t = Math.min(1, Math.max(0, (0.97 - L) / 0.9));
        r[p] = maxR * Math.sqrt(t);
      }
      tones.set(key, r);
      return r;
    };
    const frameSize = () => ({
      w: Math.max(1, canvas.clientWidth),
      h: Math.max(1, canvas.clientHeight),
    });
    // precompute the next photo's halftone as soon as it has decoded
    precompute = (n: Loaded) => {
      const { w, h } = frameSize();
      if (canvas.clientWidth > 0) toneOf(n.index, n.img, w, h);
    };

    const runWave = (n: Loaded) => {
      const oldImg = s.currentImg ?? imgEl;
      const { w, h } = frameSize();
      const from = ctx ? toneOf(s.index, oldImg, w, h) : null;
      const to = ctx ? toneOf(n.index, n.img, w, h) : null;
      if (!ctx || !from || !to) {
        runFade(n);
        return;
      }
      s.busy = true;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const oldMeta = photos[s.index];
      const newMeta = photos[n.index];
      const { pitch, cols, rows } = gridFor(w, h);

      // per-cell diagonal position (soft, slightly wavy) + a drift direction
      const N = cols * rows;
      const diag = new Float32Array(N);
      const dx = new Float32Array(N);
      const dy = new Float32Array(N);
      let seed = (n.index + 1) * 7919;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const q = j * cols + i;
          const u = i / cols;
          const v = j / rows;
          diag[q] = Math.min(
            1,
            Math.max(0, u * 0.6 + v * 0.4 + Math.sin(v * 5 + u * 1.4) * 0.04 + (rnd() - 0.5) * 0.06),
          );
          const ang = rnd() * Math.PI * 2;
          dx[q] = Math.cos(ang) * pitch * 0.2 + pitch * 0.3;
          dy[q] = Math.sin(ang) * pitch * 0.2 - pitch * 0.14;
        }

      const sm = (v: number) => {
        const c = v < 0 ? 0 : v > 1 ? 1 : v;
        return c * c * (3 - 2 * c);
      };
      const start = performance.now();
      canvas.style.opacity = "1";

      const frame = (now: number) => {
        if (!alive) return;
        const p = Math.min(1, (now - start) / WAVE_MS);

        ctx.globalAlpha = 1;
        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, w, h);

        // dots: old halftone → new halftone, swept diagonally with a drift
        ctx.fillStyle = ink;
        ctx.beginPath();
        for (let j = 0; j < rows; j++) {
          const cy = (j + 0.5) * pitch;
          for (let i = 0; i < cols; i++) {
            const q = j * cols + i;
            const m = sm((p - 0.14 - diag[q] * 0.34) / 0.3);
            const r = from[q] + (to[q] - from[q]) * m;
            if (r < 0.35) continue;
            const lift = Math.sin(Math.PI * m);
            const x = (i + 0.5) * pitch + dx[q] * lift;
            const y = cy + dy[q] * lift;
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, Math.PI * 2);
          }
        }
        ctx.fill();

        // the photos dissolve into / resolve out of their dots along the sweep
        const out = 1 - sm(p / 0.2);
        if (out > 0.002) {
          ctx.globalAlpha = out;
          drawCover(ctx, oldImg, oldMeta, w, h);
        }
        const inn = sm((p - 0.72) / 0.28);
        if (inn > 0.002) {
          ctx.globalAlpha = inn;
          drawCover(ctx, n.img, newMeta, w, h);
        }
        ctx.globalAlpha = 1;

        if (p >= 0.4 && s.next === n) {
          // swap the real <img> while the canvas fully covers it
          commit(n);
        }
        if (p < 1) {
          raf = requestAnimationFrame(frame);
        } else {
          canvas.style.opacity = "0";
          ctx.clearRect(0, 0, w, h);
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
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.opacity = "0";
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
          <canvas
            ref={canvasRef}
            className="photo-wave-canvas"
            aria-hidden="true"
          />
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
