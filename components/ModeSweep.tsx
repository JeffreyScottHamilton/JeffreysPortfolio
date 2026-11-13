"use client";
import { useEffect, useRef } from "react";
export default function ModeSweep({
  active,
  light,
}: {
  active: boolean;
  light: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (
      !el ||
      !active ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const w = innerWidth,
      h = innerHeight,
      dpr = Math.min(devicePixelRatio, 1.5);
    el.width = w * dpr;
    el.height = h * dpr;
    ctx.scale(dpr, dpr);
    const start = performance.now();
    let frame = 0;
    const draw = (time: number) => {
      const p = Math.min((time - start) / 700, 1);
      ctx.clearRect(0, 0, w, h);
      const center = -w * 0.4 + p * w * 1.8;
      ctx.font = "8px monospace";
      for (let y = 0; y < h; y += 12)
        for (let x = 0; x < w; x += 11) {
          const edge = Math.sin(y * 0.007 + p * 4) * 70;
          const dist = Math.abs(x - center - edge);
          const a = Math.max(0, 1 - dist / (w * 0.24)) * Math.sin(p * Math.PI);
          if (a < 0.015) continue;
          ctx.fillStyle = light
            ? `rgba(250,247,240,${a * 0.9})`
            : `rgba(6,7,7,${a * 0.9})`;
          ctx.fillRect(x, y, 12, 13);
          ctx.fillStyle = light
            ? `rgba(22,23,20,${a})`
            : `rgba(242,240,229,${a})`;
          ctx.fillText(
            "AqKz74%#?01+:"[(x * 7 + y * 3) % 13],
            x + Math.sin(y * 0.03 + p * 8) * 8,
            y + 9,
          );
        }
      if (p < 1) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      ctx.clearRect(0, 0, w, h);
    };
  }, [active, light]);
  return <canvas ref={canvas} className="mode-sweep" aria-hidden="true" />;
}
