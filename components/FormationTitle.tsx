"use client";
import { useEffect, useRef } from "react";
import type { SceneMotion } from "@/lib/scene-motion";
/** Samples the actual typeset title; GSAP supplies time, this component owns no RAF. */
export default function FormationTitle({
  motion,
  returning = false,
  onReady,
}: {
  motion: SceneMotion;
  returning?: boolean;
  onReady?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    ready = useRef(onReady);
  ready.current = onReady;
  useEffect(() => {
    const c = ref.current!,
      host = c.parentElement!,
      text = host.querySelector<HTMLElement>(returning ? "p" : "h1")!,
      ctx = c.getContext("2d");
    if (!ctx) {
      ready.current?.();
      return;
    }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let dead = false,
      visible = false;
    let points: { x: number; y: number; s: number }[] = [];
    let w = 0,
      h = 0;
    const draw = () => {
      const p = reduced.matches
        ? 1
        : returning
          ? motion.returnFormation
          : motion.title;
      text.style.opacity = String(Math.max(0, (p - 0.86) / 0.14));
      if (!visible) return;
      ctx.clearRect(0, 0, w, h);
      if (p >= 1) return;
      ctx.fillStyle = getComputedStyle(text).color;
      ctx.font = "7px monospace";
      const t = p * p * (3 - 2 * p);
      for (const a of points) {
        const x = a.x + Math.cos(a.s * 25) * (1 - t) * w * 0.8,
          y = a.y + Math.sin(a.s * 19) * (1 - t) * h * 0.9;
        ctx.globalAlpha =
          (0.14 + 0.86 * t) * (1 - Math.max(0, (p - 0.86) / 0.14));
        if (a.s > 0.83)
          ctx.fillText("Aq74%#01+:"[Math.floor(a.s * 100) % 10], x, y);
        else ctx.fillRect(x, y, 1.4, 1.4);
      }
      ctx.globalAlpha = 1;
    };
    const size = () => {
      if (dead) return;
      const box = text.getBoundingClientRect(),
        parent = host.getBoundingClientRect(),
        style = getComputedStyle(text);
      w = box.width;
      h = box.height;
      c.style.left = `${box.left - parent.left}px`;
      c.style.top = `${box.top - parent.top}px`;
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      const d = Math.min(devicePixelRatio, 1.5);
      c.width = w * d;
      c.height = h * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      const raster = document.createElement("canvas");
      raster.width = w;
      raster.height = h;
      const r = raster.getContext("2d")!;
      r.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      r.textBaseline = "top";
      r.fillStyle = "white";
      r.letterSpacing = style.letterSpacing;
      const lines = text.innerText.split("\n");
      const lh = parseFloat(style.lineHeight) || parseFloat(style.fontSize);
      lines.forEach((line, i) => r.fillText(line, 0, i * lh));
      const data = r.getImageData(0, 0, w, h).data;
      points = [];
      for (let y = 0; y < h; y += 3.7)
        for (let x = 0; x < w; x += 3.7)
          if (data[(Math.floor(y) * raster.width + Math.floor(x)) * 4 + 3] > 80)
            points.push({
              x,
              y,
              s: Math.abs(Math.sin(x * 12.3 + y * 7.9) * 4317) % 1,
            });
      draw();
      ready.current?.();
    };
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) draw();
    });
    visibility.observe(text);
    const ro = new ResizeObserver(size);
    ro.observe(text);
    document.fonts.ready.then(size);
    const unsub = motion.subscribe(draw);
    reduced.addEventListener("change", draw);
    return () => {
      dead = true;
      ro.disconnect();
      visibility.disconnect();
      unsub();
      reduced.removeEventListener("change", draw);
      text.style.opacity = "";
    };
  }, [motion, returning]);
  return <canvas ref={ref} className="formation-title" aria-hidden="true" />;
}
