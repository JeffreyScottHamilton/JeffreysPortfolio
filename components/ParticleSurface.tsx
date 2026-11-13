"use client";
import { useEffect, useRef } from "react";
import type { SceneMotion } from "@/lib/scene-motion";
import { ParticleDynamics, particleFluid } from "@/lib/particle-fluid";
const hash = (i: number) => {
  const n = Math.sin(i * 127.1) * 43758.5453;
  return n - Math.floor(n);
};
const curve =
  "M90 570C40 405 505 568 724 354S1455 224 1250 126 383 153 576 296 1313 323 1485 198";
const longCurve =
  "M1000 0C1400 250 100 350 300 600S1400 900 1000 1200 100 1450 400 1800 1500 2050 1050 2400 100 2700 400 3000 1400 3350 1000 3600";
/** Ambient and ribbon dots use the very same flow and spring physics as the face. */
export default function ParticleSurface({
  className = "",
  ribbon = false,
  continuous = false,
  motion,
}: {
  className?: string;
  ribbon?: boolean;
  continuous?: boolean;
  motion?: SceneMotion;
}) {
  const ref = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current!,
      c = canvas.current!,
      ctx = c.getContext("2d");
    if (!ctx) return;
    const release = particleFluid.acquire(),
      reduced = matchMedia("(prefers-reduced-motion: reduce)"),
      coarse = matchMedia("(pointer: coarse)");
    let w = 0,
      h = 0,
      visible = false,
      raf = 0,
      last = 0,
      paint = 0,
      dead = false,
      dynamics: ParticleDynamics | null = null;
    let homes = new Float32Array(0);
    let frames: { x: number; y: number; w: number; h: number }[] = [];
    let tones: number[] = [];
    let samples = new Float32Array(0),
      perBand = 0;
    const build = () => {
      const rect = el.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (!w || !h) return;
      const dpr = Math.min(devicePixelRatio, 1.4);
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const values: number[] = [];
      tones = [];
      const pair = el.closest<HTMLElement>(".opening-pair");
      frames = pair
        ? Array.from(pair.querySelectorAll<HTMLElement>(".preview")).map(
            (preview) => {
              let x = 0,
                y = 0,
                node: HTMLElement | null = preview;
              while (node && node !== pair) {
                x += node.offsetLeft;
                y += node.offsetTop;
                node = node.offsetParent as HTMLElement | null;
              }
              return {
                x: x - el.offsetLeft,
                y: y - el.offsetTop,
                w: preview.offsetWidth,
                h: preview.offsetHeight,
              };
            },
          )
        : [];
      if (ribbon) {
        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        path.setAttribute("d", continuous ? longCurve : curve);
        const length = path.getTotalLength(),
          count = continuous ? 850 : 450;
        samples = new Float32Array(1025 * 2);
        perBand = count;
        for (let j = 0; j <= 1024; j++) {
          const p = path.getPointAtLength((j / 1024) * length);
          samples[j * 2] = (p.x / 1440) * w;
          samples[j * 2 + 1] = (p.y / (continuous ? 3600 : 600)) * h;
        }
        for (let band = 0; band < 9; band++)
          for (let i = 0; i < count; i++) {
            const s = hash(i + band * count),
              p = path.getPointAtLength(((i + s * 0.7) / count) * length);
            values.push(
              (p.x / 1440) * w,
              ((p.y + (band - 4) * 5) / (continuous ? 3600 : 600)) * h,
              0.55 + s * 0.55,
              0.25 + s * 0.5,
              hash(i + band * count + 888) > 0.985 ? 1 : 0,
              s,
            );
            tones.push(band === 2 ? 1 : band === 6 ? 2 : 0);
          }
      } else {
        for (let i = 0; i < 700; i++) {
          const s = hash(i + 1);
          values.push(
            hash(i + 11) * w,
            hash(i + 201) * h,
            0.35 + hash(i + 411) * 0.65,
            0.14 + s * 0.5,
            i % 22 === 0 ? 1 : 0,
            s,
          );
        }
      }
      homes = new Float32Array(values);
      dynamics = new ParticleDynamics(homes);
      last = 0;
      draw(performance.now());
    };
    const schedule = () => {
      if (!raf && !dead && visible && !document.hidden && !reduced.matches)
        raf = requestAnimationFrame(draw);
    };
    function draw(time: number) {
      raf = 0;
      if (!visible || dead || !dynamics || document.hidden) return;
      if (paint && time - paint < 1000 / (dynamics.energy > 0.3 ? 45 : 24)) {
        schedule();
        return;
      }
      const dt = last ? Math.min(0.12, (time - last) / 1000) : 1 / 60;
      last = paint = time;
      const rect = el.getBoundingClientRect();
      if (ribbon && !reduced.matches) {
        for (let i = 0, k = 0; i < homes.length; i += 6, k++) {
          const band = Math.floor(k / perBand),
            phase = ((k % perBand) / perBand + time * 0.000006) % 1,
            at = phase * 1024,
            j = Math.floor(at),
            t = at - j;
          homes[i] = samples[j * 2] * (1 - t) + samples[(j + 1) * 2] * t;
          homes[i + 1] =
            samples[j * 2 + 1] * (1 - t) +
            samples[(j + 1) * 2 + 1] * t +
            (((band - 4) * 5) / (continuous ? 3600 : 600)) * h;
          const morph = motion?.workLine ?? 0;
          if (morph > 0) {
            let tx = phase * w,
              ty = h * 0.55 + (band - 4) * 2;
            if (frames.length) {
              const f =
                  frames[
                    Math.min(
                      frames.length - 1,
                      Math.floor(phase * frames.length),
                    )
                  ],
                padding = 5 + band * 0.8,
                fw = f.w + padding * 2,
                fh = f.h + padding * 2,
                perimeter = 2 * (fw + fh),
                at = ((phase * frames.length) % 1) * perimeter;
              const x = f.x - padding,
                y = f.y - padding;
              if (at < fw) {
                tx = x + at;
                ty = y;
              } else if (at < fw + fh) {
                tx = x + fw;
                ty = y + at - fw;
              } else if (at < fw * 2 + fh) {
                tx = x + fw - (at - fw - fh);
                ty = y + fh;
              } else {
                tx = x;
                ty = y + fh - (at - fw * 2 - fh);
              }
            }
            homes[i] += (tx - homes[i]) * morph;
            homes[i + 1] += (ty - homes[i + 1]) * morph;
          }
        }
      }
      if (!reduced.matches && !coarse.matches)
        dynamics.step(dt, time, rect.left, rect.top);
      ctx!.clearRect(0, 0, w, h);
      el.dataset.morph = String(motion?.workLine ?? 0);
      const light = !!el.closest(".explore");
      ctx!.font = "9px monospace";
      for (let i = 0, j = 0; i < homes.length; i += 6, j += 2) {
        const x =
            homes[i] +
            dynamics.offsets[j] +
            (reduced.matches
              ? 0
              : Math.sin(time * 0.00035 + homes[i + 5] * 6) * 2),
          y =
            homes[i + 1] +
            dynamics.offsets[j + 1] +
            (reduced.matches
              ? 0
              : Math.cos(time * 0.0003 + homes[i + 5] * 6) * 2);
        if (y + rect.top < -20 || y + rect.top > innerHeight + 20) continue;
        ctx!.globalAlpha = homes[i + 3];
        ctx!.fillStyle =
          ribbon && tones[i / 6]
            ? tones[i / 6] === 1
              ? "#c34a37"
              : "#68adba"
            : light
              ? "#26251f"
              : "#eeede4";
        if (homes[i + 4])
          ctx!.fillText("AqKz74%#?01+:"[Math.floor(homes[i + 5] * 13)], x, y);
        else ctx!.fillRect(x, y, homes[i + 2] * 1.3, homes[i + 2] * 1.3);
      }
      ctx!.globalAlpha = 1;
      el.dataset.energy = dynamics.energy.toFixed(2);
      schedule();
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      el.dataset.moving = String(visible && !reduced.matches);
      cancelAnimationFrame(raf);
      raf = 0;
      if (visible) {
        if (!dynamics) build();
        else {
          last = 0;
          draw(performance.now());
        }
      }
    });
    observer.observe(el);
    const resize = new ResizeObserver(() => {
      if (visible) build();
    });
    resize.observe(el);
    const preference = () => {
      el.dataset.moving = String(
        visible && !document.hidden && !reduced.matches,
      );
      dynamics?.reset();
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      if (visible) draw(performance.now());
    };
    reduced.addEventListener("change", preference);
    document.addEventListener("visibilitychange", preference);
    return () => {
      dead = true;
      release();
      cancelAnimationFrame(raf);
      observer.disconnect();
      resize.disconnect();
      reduced.removeEventListener("change", preference);
      document.removeEventListener("visibilitychange", preference);
    };
  }, [ribbon, continuous, motion]);
  return (
    <div ref={ref} className={className} aria-hidden="true">
      <canvas ref={canvas} />
    </div>
  );
}
