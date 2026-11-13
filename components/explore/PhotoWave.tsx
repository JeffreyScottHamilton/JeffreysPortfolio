"use client";
import { useEffect, useRef, useState } from "react";
import { GLYPHS, usePortfolio } from "@/components/shared/context";
import type { Media } from "@/content/media";

/**
 * The ONE Explore photo area. Holds each photo, then a diagonal wave of random
 * glyphs sweeps across it, the next photo is swapped in under the wave, and the
 * characters disperse to reveal it. Same effect for every change; wraps around.
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
  const [index, setIndex] = useState(0);
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
      setIndex(n.index);
      s.next = null;
      preload(n.index + 1);
    };

    // ---- canvas wave
    const ctx = canvas.getContext("2d");
    const ink =
      getComputedStyle(el).getPropertyValue("--ink").trim() || "#121212";
    const paper =
      getComputedStyle(el).getPropertyValue("--bg").trim() || "#f7f2e9";
    const font =
      getComputedStyle(el).getPropertyValue("--font").trim() || "sans-serif";

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

    const runWave = (n: Loaded) => {
      if (!ctx) {
        commit(n);
        return;
      }
      s.busy = true;
      // layout size (not the tilted bounding box)
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const oldImg = s.currentImg ?? imgEl;
      const oldMeta = photos[s.index];
      const newMeta = photos[n.index];

      // seeded glyph cells for this transition
      let seed = (n.index + 1) * 7919;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const cell = Math.max(12, Math.round(w / 34));
      const cols = Math.ceil(w / cell) + 1;
      const rows = Math.ceil(h / cell) + 1;
      const cells: {
        x: number;
        y: number;
        d: number;
        g: string;
        g2: string;
        s: number;
        vx: number;
        vy: number;
        r: number;
      }[] = [];
      for (let yi = 0; yi < rows; yi++)
        for (let xi = 0; xi < cols; xi++) {
          const x = xi * cell + (rnd() - 0.5) * cell * 0.6;
          const y = yi * cell + (rnd() - 0.5) * cell * 0.6;
          // diagonal coordinate with a flowing sine bend
          const d =
            (x / w) * 0.62 +
            (y / h) * 0.38 +
            Math.sin((y / h) * 5.2 + (x / w) * 1.3) * 0.06;
          cells.push({
            x,
            y,
            d,
            g: GLYPHS[Math.floor(rnd() * GLYPHS.length)],
            g2: GLYPHS[Math.floor(rnd() * GLYPHS.length)],
            s: 0.6 + rnd() * 0.8,
            vx: (rnd() - 0.3) * 38,
            vy: (rnd() - 0.6) * 30,
            r: (rnd() - 0.5) * 0.8,
          });
        }

      const band = 0.3;
      const start = performance.now();
      canvas.style.opacity = "1";

      const frame = (now: number) => {
        if (!alive) return;
        const p = Math.min(1, (now - start) / WAVE_MS);
        const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const front = -band * 1.6 + ease * (1 + band * 3.2);
        const peak = Math.sin(Math.PI * p); // density peaks mid-wave
        const wob = Math.sin(now / 140) * 0.012;

        ctx.clearRect(0, 0, w, h);
        // old photo ahead of the front, new photo behind it
        drawCover(ctx, oldImg, oldMeta, w, h);
        ctx.save();
        ctx.beginPath();
        const steps = 24;
        // region where d < front: polygon traced along the wavy front line
        for (let i = 0; i <= steps; i++) {
          const y = (i / steps) * h;
          const xFront =
            ((front - (y / h) * 0.38 - Math.sin((y / h) * 5.2) * 0.06 + wob) /
              0.62) *
            w;
          if (i === 0) ctx.moveTo(-2, y);
          ctx.lineTo(Math.min(w + 2, xFront), y);
        }
        ctx.lineTo(-2, h + 2);
        ctx.closePath();
        ctx.clip();
        drawCover(ctx, n.img, newMeta, w, h);
        ctx.restore();

        // paper wash + glyphs along the band
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const c of cells) {
          const t = (c.d - front) / band; // <0 behind (dispersing), >0 ahead
          if (t > 1.2 || t < -2.4) continue;
          const behind = t < 0;
          const a = behind
            ? Math.max(0, 1 + t / 2.4)
            : Math.max(0, 1 - Math.abs(t) / 1.2);
          const cover = Math.pow(a, 1.2) * (0.7 + 0.3 * peak);
          ctx.globalAlpha = Math.min(0.96, cover);
          ctx.fillStyle = paper;
          ctx.fillRect(c.x - cell * 0.55, c.y - cell * 0.55, cell * 1.1, cell * 1.1);
          if (a <= 0.02) continue;
          const drift = behind ? -t : 0;
          const gx = c.x + c.vx * drift;
          const gy = c.y + c.vy * drift;
          ctx.globalAlpha = Math.min(1, a * (0.75 + 0.25 * peak) * 1.15);
          ctx.fillStyle = ink;
          const size = cell * c.s * (0.8 + 0.35 * peak);
          ctx.font = `italic 500 ${size.toFixed(1)}px ${font}`;
          ctx.save();
          ctx.translate(gx, gy);
          ctx.rotate(c.r * drift);
          ctx.fillText(Math.abs(t) < 0.35 ? c.g2 : c.g, 0, 0);
          ctx.restore();
        }
        ctx.globalAlpha = 1;

        if (p >= 0.5 && s.next === n) {
          // swap the real <img> under the wave at its peak
          commit(n);
        }
        if (p < 1) {
          raf = requestAnimationFrame(frame);
        } else {
          ctx.clearRect(0, 0, w, h);
          canvas.style.opacity = "0";
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
      setIndex(i);
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
  const current = photos[index] ?? first;
  if (!first) return null;

  return (
    <figure
      ref={root}
      className={`photo-wave ${className}`}
      data-gallery=""
    >
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
      <figcaption className="photo-wave-caption" aria-hidden="true">
        {current.alt}
      </figcaption>
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
