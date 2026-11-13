"use client";
import { useEffect, useRef } from "react";
import type { SceneMotion } from "@/lib/scene-motion";
/** The existing curtain renderer follows the scene clock; glyph rasterization is cached. */
export default function ModeSweep({
  active,
  light,
  motion,
}: {
  active: boolean;
  light: boolean;
  motion: SceneMotion;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c || !active || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = innerWidth,
      h = innerHeight,
      dpr = Math.min(devicePixelRatio, 1.25);
    c.width = w * dpr;
    c.height = h * dpr;
    ctx.scale(dpr, dpr);
    const texture = document.createElement("canvas");
    texture.width = w;
    texture.height = h;
    const ink = texture.getContext("2d")!;
    ink.fillStyle = light ? "#faf7f0" : "#060707";
    ink.fillRect(0, 0, w, h);
    ink.fillStyle = light ? "#171915" : "#f4f3ec";
    ink.font = "10px monospace";
    for (let y = 0; y < h; y += 16)
      for (let x = 0; x < w; x += 14) {
        const seed = Math.abs(Math.sin(x * 12.9 + y * 78.2) * 43758.5) % 1;
        ink.globalAlpha = 0.35 + seed * 0.5;
        ink.fillText("AqKz74%#?01+:"[Math.floor(seed * 13)], x, y + 11);
      }
    const draw = () => {
      const p = motion.modeProgress;
      ctx.clearRect(0, 0, w, h);
      if (p <= 0 || p >= 1) return;
      const center = -w * 1.5 + p * w * 4,
        edge = (y: number) => Math.sin(y * 0.007 + p * 4) * 70;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(center - w * 1.03 + edge(0), 0);
      for (let y = 0; y <= h + 24; y += 24)
        ctx.lineTo(center - w * 1.03 + edge(y), y);
      for (let y = h + 24; y >= 0; y -= 24)
        ctx.lineTo(center + w * 1.03 + edge(y), y);
      ctx.closePath();
      ctx.clip();
      // Reuse the raster through flowing horizontal strips instead of thousands of fillText calls per frame.
      ctx.fillStyle = light ? "#faf7f0" : "#060707";
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 32) {
        const shift = Math.sin(y * 0.017 + p * 8) * 7;
        ctx.drawImage(
          texture,
          0,
          y,
          w,
          Math.min(32, h - y),
          shift,
          y,
          w,
          Math.min(32, h - y),
        );
      }
      ctx.restore();
      ctx.fillStyle = light ? "#171915" : "#f4f3ec";
      ctx.font = "9px monospace";
      for (let y = 9; y < h; y += 20) {
        for (const side of [-1, 1]) {
          const x = center + side * w * 1.04 + edge(y);
          if (x < 0 || x > w) continue;
          ctx.globalAlpha = 0.4;
          ctx.fillText("Aq7%01+:"[Math.floor(y / 20) % 8], x, y);
        }
      }
      ctx.globalAlpha = 1;
    };
    const unsubscribe = motion.subscribe(draw);
    draw();
    return () => {
      unsubscribe();
      ctx.clearRect(0, 0, w, h);
    };
  }, [active, light, motion]);
  return <canvas ref={canvas} className="mode-sweep" aria-hidden="true" />;
}
