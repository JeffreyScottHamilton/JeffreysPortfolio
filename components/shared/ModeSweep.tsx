"use client";
import { useEffect, useRef } from "react";
import { GLYPHS, SWEEP_MS } from "./context";

/**
 * 700 ms particle sweep between modes. A diagonal band of random glyphs and
 * fine dots travels left→right; behind it the page has already become the
 * new tone. Calls onMidpoint once the band covers the viewport centre (the
 * shell swaps content then) and onDone at the end. Self-timed, one rAF loop.
 */
export default function ModeSweep({
  run,
  toLight,
  onMidpoint,
  onDone,
}: {
  run: number; // increment to trigger a sweep
  toLight: boolean;
  onMidpoint: () => void;
  onDone: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const cb = useRef({ onMidpoint, onDone });
  cb.current = { onMidpoint, onDone };
  useEffect(() => {
    if (!run) return;
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) {
      cb.current.onMidpoint();
      cb.current.onDone();
      return;
    }
    const w = innerWidth,
      h = innerHeight,
      dpr = Math.min(devicePixelRatio || 1, 1.5);
    c.width = w * dpr;
    c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement);
    const ivory = css.getPropertyValue("--ivory").trim() || "#f7f2e9";
    const night = css.getPropertyValue("--night").trim() || "#050505";
    const newBg = toLight ? ivory : night;
    const newInk = toLight ? "#111" : "#f2efe8";
    const oldBg = toLight ? night : ivory;
    const oldInk = toLight ? "#f2efe8" : "#111";
    const cols = Math.ceil(w / 9),
      rows = Math.ceil(h / 9);
    const seeds = new Float32Array(cols * rows).map((_, i) => {
      const n = Math.sin(i * 12.9898) * 43758.5453;
      return n - Math.floor(n);
    });
    let swapped = false,
      raf = 0;
    const t0 = performance.now();
    const skew = h * 0.35;
    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / SWEEP_MS);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const front = -skew - 160 + e * (w + skew + 320);
      ctx.clearRect(0, 0, w, h);
      // Before the swap: paint the NEW tone behind the front over the old page.
      // After the swap: the page is already new, so paint the OLD tone ahead.
      ctx.fillStyle = swapped ? oldBg : newBg;
      ctx.beginPath();
      if (!swapped) {
        ctx.moveTo(-10, 0);
        ctx.lineTo(front + skew, 0);
        ctx.lineTo(front, h);
        ctx.lineTo(-10, h);
      } else {
        ctx.moveTo(front + skew, 0);
        ctx.lineTo(w + 10, 0);
        ctx.lineTo(w + 10, h);
        ctx.lineTo(front, h);
      }
      ctx.fill();
      // particle band
      ctx.font = "9px ui-monospace, monospace";
      for (let r = 0; r < rows; r++) {
        const y = r * 9 + 7;
        const fx = front + skew * (1 - y / h);
        for (let k = -18; k < 22; k++) {
          const x = fx + k * 9;
          const col = Math.floor(x / 9);
          if (col < 0 || col >= cols) continue;
          const s = seeds[r * cols + col];
          const d = k / 22; // -0.8..1 : behind..ahead
          if (s > 0.92 - Math.abs(d) * 0.4) continue;
          const behind = d < 0;
          ctx.globalAlpha = 0.25 + (1 - Math.abs(d)) * 0.7;
          const jitter = Math.sin(now * 0.01 + s * 40) * 2;
          if (Math.abs(d) < 0.12)
            ctx.fillStyle = s < 0.5 ? "#e8402a" : "#2fc4d6";
          else ctx.fillStyle = behind ? newInk : oldInk;
          if (s > 0.55)
            ctx.fillText(GLYPHS[Math.floor(s * GLYPHS.length * 7) % GLYPHS.length], x + jitter, y);
          else ctx.fillRect(x + jitter, y - 3, 1.6, 1.6);
        }
      }
      ctx.globalAlpha = 1;
      if (!swapped && p >= 0.5) {
        swapped = true;
        cb.current.onMidpoint();
      }
      if (p < 1) raf = requestAnimationFrame(frame);
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
  }, [run, toLight]);
  return <canvas ref={canvas} className="mode-sweep" aria-hidden="true" />;
}
