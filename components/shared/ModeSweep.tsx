"use client";
import { useEffect, useRef } from "react";
import { SWEEP_COVER_MS, SWEEP_MS } from "./context";

/**
 * ~1.1 s halftone dissolve between modes. A grid of dots in the new mode's
 * background (which is the old mode's ink) grows from nothing until it covers
 * the viewport, at which point onMidpoint fires and the shell swaps content
 * and jumps to the top. The dots then shrink and drift apart, revealing the
 * new opening through the gaps. onDone fires at the end. One rAF loop.
 */
export default function ModeSweep({
  run,
  onMidpoint,
  onReveal,
  onDone,
}: {
  run: number; // increment to trigger a sweep
  onMidpoint: () => void;
  /** the dots start clearing: the new opening may begin animating */
  onReveal: () => void;
  onDone: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const cb = useRef({ onMidpoint, onReveal, onDone });
  useEffect(() => {
    cb.current = { onMidpoint, onReveal, onDone };
  });
  useEffect(() => {
    if (!run) return;
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) {
      cb.current.onMidpoint();
      cb.current.onReveal();
      cb.current.onDone();
      return;
    }
    const w = innerWidth,
      h = innerHeight,
      dpr = Math.min(devicePixelRatio || 1, 1.5);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement);
    // both modes share the night palette
    const fill = css.getPropertyValue("--night").trim() || "#050505";

    const cell = 16;
    const cols = Math.ceil(w / cell) + 1,
      rows = Math.ceil(h / cell) + 1;
    const n = cols * rows;
    const seed = new Float32Array(n);
    const dist = new Float32Array(n);
    const cx = w / 2,
      cy = h * 0.42,
      far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
    for (let i = 0; i < n; i++) {
      const v = Math.sin(i * 12.9898 + run * 7.13) * 43758.5453;
      seed[i] = v - Math.floor(v);
      const x = (i % cols) * cell,
        y = Math.floor(i / cols) * cell;
      dist[i] = Math.hypot(x - cx, y - cy) / far;
    }
    const rMax = cell * 0.76; // a dot this size overlaps its neighbours
    const hold = 120; // ms of full cover while React commits the swap
    const outStart = SWEEP_COVER_MS + hold;
    const outLen = SWEEP_MS - outStart;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const clamp = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

    let swapped = false,
      revealed = false,
      raf = 0;
    // Virtual clock: a long frame (the new mode mounting under full cover)
    // pauses the animation instead of skipping most of the reveal.
    let t = 0,
      last = performance.now();
    const frame = (now: number) => {
      t += Math.min(Math.max(0, now - last), 34);
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = fill;
      if (t < SWEEP_COVER_MS) {
        // grow: random order, edges slightly ahead of the centre
        const p = t / SWEEP_COVER_MS;
        if (p > 0.97) ctx.fillRect(0, 0, w, h);
        else {
          ctx.globalAlpha = clamp(p * 4);
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            const delay = seed[i] * 0.45 + (1 - dist[i]) * 0.2;
            const k = ease(clamp((p - delay) / (0.97 - delay)));
            if (k <= 0) continue;
            const x = (i % cols) * cell,
              y = Math.floor(i / cols) * cell;
            const r = rMax * k;
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      } else if (t < outStart) {
        ctx.fillRect(0, 0, w, h);
      } else {
        // shrink + disperse: centre clears first, dots drift outward
        const p = clamp((t - outStart) / outLen);
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const delay = dist[i] * 0.35 + seed[i] * 0.25;
          const k = clamp((p - delay) / (1 - delay));
          if (k >= 1) continue;
          const e = ease(k);
          const gx = (i % cols) * cell,
            gy = Math.floor(i / cols) * cell;
          const dx = gx - cx,
            dy = gy - cy,
            len = Math.hypot(dx, dy) || 1;
          const push = e * (8 + seed[i] * 26);
          const x = gx + (dx / len) * push,
            y = gy + (dy / len) * push;
          const r = rMax * (1 - e);
          if (r < 0.3) continue;
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      if (!swapped && t >= SWEEP_COVER_MS) {
        swapped = true;
        cb.current.onMidpoint();
      }
      if (!revealed && t >= outStart) {
        revealed = true;
        cb.current.onReveal();
      }
      if (t < SWEEP_MS) raf = requestAnimationFrame(frame);
      else {
        ctx.clearRect(0, 0, w, h);
        cb.current.onDone();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, w, h);
    };
  }, [run]);
  return <canvas ref={canvas} className="mode-sweep" aria-hidden="true" />;
}
