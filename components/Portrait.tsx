"use client";
import { useEffect, useId, useRef } from "react";
import { portrait, portraitGeometry } from "@/content/media";
import {
  createParticleRenderer,
  makeParticleAtlas,
  particleGlyphs,
  type ParticleRenderer,
} from "@/lib/portrait-particles";
const noise = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
type Mote = {
  x: number;
  y: number;
  size: number;
  alpha: number;
  glyph: number;
  seed: number;
};
/** The original photograph never moves; the particle field moves around it. */
export default function Portrait({
  light = false,
  decorative = false,
  still = false,
}: {
  light?: boolean;
  decorative?: boolean;
  still?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    particles = useRef<HTMLCanvasElement>(null);
  const maskId = `portrait-${useId().replace(/:/g, "")}`;
  const { width, height, crop } = portraitGeometry;
  useEffect(() => {
    const el = canvas.current,
      gpuCanvas = particles.current;
    if (!el || still) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const photo = new Image(),
      alpha = new Image();
    const source = document.createElement("canvas"),
      sourceCtx = source.getContext("2d", { willReadFrequently: true });
    const field = document.createElement("canvas"),
      fieldCtx = field.getContext("2d");
    const reveal = document.createElement("canvas"),
      revealCtx = reveal.getContext("2d");
    const mask = document.createElement("canvas"),
      maskCtx = mask.getContext("2d");
    const atlas = makeParticleAtlas();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)"),
      coarse = matchMedia("(pointer: coarse)");
    let w = 0,
      h = 0,
      frame = 0,
      lastTime = 0,
      lastPaint = 0,
      lastInteraction = 0,
      visible = false,
      disposed = false,
      loaded = false,
      renderer: ParticleRenderer | null = null;
    let points = new Float32Array(0);
    const living: Mote[] = [];
    const pointer = {
      x: -1000,
      y: -1000,
      tx: -1000,
      ty: -1000,
      vx: 0,
      vy: 0,
      strength: 0,
      target: 0,
    };
    const wake: { x: number; y: number; t: number }[] = [];
    const trails = new Float32Array(24);
    const mobile = () => reduced.matches || coarse.matches;
    function schedule() {
      if (
        !frame &&
        visible &&
        !document.hidden &&
        !disposed &&
        loaded &&
        !mobile() &&
        !decorative
      )
        frame = requestAnimationFrame(draw);
    }
    function size() {
      if (
        !ctx ||
        !sourceCtx ||
        !fieldCtx ||
        !el ||
        !loaded ||
        !visible ||
        disposed
      )
        return;
      cancelAnimationFrame(frame);
      frame = 0;
      const rect = el.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (!w || !h) return;
      const dpr = Math.min(devicePixelRatio, 1.75);
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      ctx.setTransform(el.width / w, 0, 0, el.height / h, 0, 0);
      for (const c of [source, field, reveal, mask]) {
        c.width = Math.round(w);
        c.height = Math.round(h);
      }
      sourceCtx.drawImage(
        photo,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        w,
        h,
      );
      sourceCtx.globalCompositeOperation = "destination-in";
      sourceCtx.drawImage(
        alpha,
        (crop.x * alpha.width) / width,
        (crop.y * alpha.height) / height,
        (crop.width * alpha.width) / width,
        (crop.height * alpha.height) / height,
        0,
        0,
        w,
        h,
      );
      sourceCtx.globalCompositeOperation = "source-over";
      const data = sourceCtx.getImageData(
        0,
        0,
        source.width,
        source.height,
      ).data;
      const samples: number[] = [];
      living.length = 0;
      fieldCtx.clearRect(0, 0, w, h);
      fieldCtx.textBaseline = "middle";
      const step = w < 380 ? 2.35 : 2.75;
      // Keep a cached 2D fallback and upload immutable original sample coordinates
      // once. WebGL moves the points; it never stretches or shifts the photograph.
      if (!mobile())
        for (let y = 0; y < h; y += step)
          for (let x = 0; x < w; x += step) {
            const p =
                (Math.min(source.height - 1, Math.floor(y)) * source.width +
                  Math.min(source.width - 1, Math.floor(x))) *
                4,
              a = data[p + 3] / 255;
            if (a < 0.12) continue;
            const lum =
              (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114) /
              255;
            const detail = Math.pow(
              Math.max(
                0.035,
                Math.min(1, ((light ? 1 - lum : lum) - 0.035) / 0.88),
              ),
              light ? 0.65 : 0.75,
            );
            const seed = noise(x, y),
              glyph =
                seed > 0.88 && detail > 0.15
                  ? (Math.floor(seed * 1000) % particleGlyphs.length) + 1
                  : 0;
            const size = glyph
              ? 3.2 + detail * 1.8
              : (0.14 + detail * 1.35) * 2;
            const opacity = a * 0.95 * (glyph ? 0.35 + detail * 0.65 : 1);
            samples.push(x, y, size, opacity, glyph, seed);
            if (seed > 0.985 && living.length < 500) {
              living.push({ x, y, size, alpha: opacity, glyph, seed });
              continue;
            }
            fieldCtx.fillStyle = light
              ? `rgba(20,20,18,${opacity})`
              : `rgba(248,247,239,${opacity})`;
            if (glyph) {
              fieldCtx.font = `${size}px monospace`;
              fieldCtx.fillText(particleGlyphs[glyph - 1], x, y);
            } else {
              fieldCtx.beginPath();
              fieldCtx.arc(x, y, size / 2, 0, Math.PI * 2);
              fieldCtx.fill();
            }
          }
      points = new Float32Array(samples);
      if (!mobile() && !decorative && gpuCanvas) {
        if (!renderer)
          renderer = createParticleRenderer(gpuCanvas, atlas, light);
        renderer?.upload(points, w, h, dpr);
      }
      if (gpuCanvas)
        gpuCanvas.style.opacity = renderer && !mobile() ? "1" : "0";
      el.parentElement?.setAttribute("data-ready", "true");
      el.parentElement?.setAttribute(
        "data-particle-engine",
        mobile() ? "still" : renderer ? "webgl" : "canvas",
      );
      lastTime = lastPaint = 0;
      draw(performance.now());
    }
    function brush(time: number) {
      if (!maskCtx) return;
      maskCtx.clearRect(0, 0, w, h);
      const radius = w * 0.125,
        speed = Math.min(1, Math.hypot(pointer.vx, pointer.vy) / 700),
        angle = Math.atan2(pointer.vy, pointer.vx);
      // Overlapping feathered strokes form a drifting, directional wake. There is
      // no closed circular outline and no independently transformed photo patch.
      const marks = [
        ...wake.filter((p, i) => time - p.t < 760 && i % 3 === 0),
        { x: pointer.x, y: pointer.y, t: time },
      ];
      for (const p of marks) {
        const age = time - p.t,
          fade = Math.pow(Math.max(0, 1 - age / 760), 1.8) * pointer.strength;
        if (fade < 0.006) continue;
        const r = radius * (0.55 + fade * 0.45);
        maskCtx.save();
        maskCtx.translate(p.x, p.y);
        maskCtx.rotate(angle);
        maskCtx.scale(
          1 + speed * 0.55,
          0.82 + Math.sin(time * 0.001 + p.x * 0.01) * 0.07,
        );
        const gradient = maskCtx.createRadialGradient(0, 0, 0, 0, 0, r);
        gradient.addColorStop(0, `rgba(0,0,0,${fade})`);
        gradient.addColorStop(0.5, `rgba(0,0,0,${fade})`);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        maskCtx.fillStyle = gradient;
        maskCtx.fillRect(-r, -r, r * 2, r * 2);
        maskCtx.restore();
      }
    }
    function draw(time: number) {
      frame = 0;
      if (
        !ctx ||
        !revealCtx ||
        !loaded ||
        !visible ||
        disposed ||
        !w ||
        document.hidden
      )
        return;
      // Idle drift is quiet and inexpensive; active pointer movement can use
      // the full refresh rate, with time-based physics in both cases.
      const active =
        time - lastInteraction < 1000 &&
        (pointer.target || pointer.strength > 0.005);
      const fps = active ? (renderer ? 60 : 30) : 24;
      if (lastPaint && time - lastPaint < 1000 / fps) {
        schedule();
        return;
      }
      const elapsed = lastTime
        ? Math.min(0.25, (time - lastTime) / 1000)
        : 1 / 24;
      lastTime = lastPaint = time;
      ctx.clearRect(0, 0, w, h);
      if (mobile()) {
        renderer?.clear();
        ctx.drawImage(source, 0, 0, w, h);
        return;
      }
      if (pointer.x > -999) {
        const steps = Math.ceil(elapsed * 120),
          dt = elapsed / steps;
        for (let i = 0; i < steps; i++) {
          pointer.vx += ((pointer.tx - pointer.x) * 85 - pointer.vx * 17) * dt;
          pointer.vy += ((pointer.ty - pointer.y) * 85 - pointer.vy * 17) * dt;
          pointer.x += pointer.vx * dt;
          pointer.y += pointer.vy * dt;
        }
      }
      pointer.strength +=
        (pointer.target - pointer.strength) * (1 - Math.exp(-elapsed * 8));
      if (pointer.strength < 0.001) pointer.strength = 0;
      if (pointer.strength > 0.005) {
        wake.push({ x: pointer.x, y: pointer.y, t: time });
        if (wake.length > 20) wake.shift();
      }
      for (let i = 0; i < 8; i++) {
        const p = wake[Math.max(0, wake.length - 1 - i * 2)];
        trails[i * 3] = p?.x ?? -1000;
        trails[i * 3 + 1] = p?.y ?? -1000;
        trails[i * 3 + 2] = p
          ? Math.max(0, 1 - (time - p.t) / 760) * pointer.strength * 0.5
          : 0;
      }
      if (renderer)
        renderer.paint({
          time,
          x: pointer.x,
          y: pointer.y,
          vx: pointer.vx,
          vy: pointer.vy,
          strength: pointer.strength,
          radius: w * 0.125,
          trails,
        });
      else {
        ctx.drawImage(field, 0, 0, w, h);
        ctx.fillStyle = light ? "#141412" : "#f8f7ef";
        for (const p of living) {
          const dx = p.x - pointer.x,
            dy = p.y - pointer.y,
            d = Math.hypot(dx, dy) || 1,
            force = Math.max(0, 1 - d / (w * 0.25)) * pointer.strength;
          const x =
              p.x +
              Math.sin(time * 0.00046 + p.seed * 19) * 2.4 +
              (dx / d) * force * w * 0.04,
            y =
              p.y +
              Math.cos(time * 0.00038 + p.seed * 31) * 2.4 +
              (dy / d) * force * w * 0.04;
          ctx.globalAlpha = p.alpha;
          // Tint the white atlas with source-in on the cached fallback is unnecessary:
          // regular glyph text and circles preserve the correct mode ink directly.
          if (p.glyph) {
            ctx.font = `${p.size}px monospace`;
            ctx.fillText(particleGlyphs[p.glyph - 1], x, y);
          } else {
            ctx.beginPath();
            ctx.arc(x, y, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }
      if (pointer.strength > 0.002) {
        brush(time);
        revealCtx.clearRect(0, 0, w, h);
        revealCtx.save();
        revealCtx.drawImage(source, 0, 0, w, h);
        revealCtx.globalCompositeOperation = "destination-in";
        revealCtx.filter = "blur(10px)";
        revealCtx.drawImage(mask, 0, 0, w, h);
        revealCtx.restore();
        ctx.drawImage(reveal, 0, 0, w, h);
      }
      schedule();
    }
    const move = (e: PointerEvent) => {
      if (mobile() || decorative) return;
      const rect = el.getBoundingClientRect();
      lastInteraction = performance.now();
      pointer.tx = e.clientX - rect.left;
      pointer.ty = e.clientY - rect.top;
      if (pointer.x < -999) {
        pointer.x = pointer.tx;
        pointer.y = pointer.ty;
      }
      pointer.target = 1;
      schedule();
    };
    const leave = () => {
      lastInteraction = performance.now();
      pointer.target = 0;
      schedule();
    };
    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = lastPaint = 0;
      if (visible && !document.hidden && loaded) draw(performance.now());
    };
    const preference = () => {
      pointer.target = pointer.strength = 0;
      wake.length = 0;
      renderer?.clear();
      size();
    };
    const observer = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && loaded) size();
      else refresh();
    });
    observer.observe(el);
    const resize = new ResizeObserver(size);
    resize.observe(el);
    const contextLost = (e: Event) => {
      e.preventDefault();
      renderer?.dispose();
      renderer = null;
      if (gpuCanvas) gpuCanvas.style.opacity = "0";
      el.parentElement?.setAttribute("data-particle-engine", "canvas");
      refresh();
    };
    const contextRestored = () => {
      renderer = null;
      size();
    };
    gpuCanvas?.addEventListener("webglcontextlost", contextLost);
    gpuCanvas?.addEventListener("webglcontextrestored", contextRestored);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    reduced.addEventListener("change", preference);
    coarse.addEventListener("change", preference);
    document.addEventListener("visibilitychange", refresh);
    Promise.all([
      new Promise<void>((resolve, reject) => {
        photo.onload = () => resolve();
        photo.onerror = reject;
        photo.src = portrait.src!;
      }),
      new Promise<void>((resolve, reject) => {
        alpha.onload = () => resolve();
        alpha.onerror = reject;
        alpha.src = portrait.maskSrc!;
      }),
    ])
      .then(() => {
        if (!disposed) {
          loaded = true;
          size();
        }
      })
      .catch(() => {
        if (!disposed) el.style.opacity = "0";
      });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      renderer?.dispose();
      observer.disconnect();
      resize.disconnect();
      el.parentElement?.removeAttribute("data-ready");
      el.parentElement?.removeAttribute("data-particle-engine");
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      reduced.removeEventListener("change", preference);
      coarse.removeEventListener("change", preference);
      document.removeEventListener("visibilitychange", refresh);
      gpuCanvas?.removeEventListener("webglcontextlost", contextLost);
      gpuCanvas?.removeEventListener("webglcontextrestored", contextRestored);
    };
  }, [light, decorative, still, width, height, crop]);
  return (
    <div
      className={`portrait ${still ? "portrait-still" : ""}`}
      style={{ aspectRatio: `${crop.width} / ${crop.height}` }}
      role={decorative ? undefined : "img"}
      aria-label={
        decorative
          ? undefined
          : still
            ? "Jeffrey Hamilton"
            : "Jeffrey Hamilton, rendered in fine dots and letters. Move your pointer to reveal the photograph."
      }
      aria-hidden={decorative || undefined}
    >
      <svg
        className="portrait-fallback"
        viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`}
        aria-hidden="true"
      >
        <defs>
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={width}
            height={height}
            style={{ maskType: "alpha" }}
          >
            <image href={portrait.maskSrc} width={width} height={height} />
          </mask>
        </defs>
        <image
          href={portrait.src}
          width={width}
          height={height}
          mask={`url(#${maskId})`}
        />
      </svg>
      {!still && (
        <>
          <canvas ref={canvas} className="portrait-photo" aria-hidden="true" />
          <canvas
            ref={particles}
            className="portrait-particles"
            aria-hidden="true"
          />
        </>
      )}
    </div>
  );
}
