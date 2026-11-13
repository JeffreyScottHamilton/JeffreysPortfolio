"use client";
import { useEffect, useId, useRef } from "react";
import { portrait, portraitGeometry } from "@/content/media";

const glyphs = "AqKz74%#?01+:x";
const noise = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/** Both the photograph and its particles use this exact source rectangle. */
export default function Portrait({
  light = false,
  decorative = false,
  still = false,
}: {
  light?: boolean;
  decorative?: boolean;
  still?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const maskId = `portrait-${useId().replace(/:/g, "")}`;
  const { width, height, crop } = portraitGeometry;
  useEffect(() => {
    const el = canvas.current;
    if (!el || still) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const photo = new Image(),
      alpha = new Image();
    const source = document.createElement("canvas");
    const sourceCtx = source.getContext("2d", { willReadFrequently: true });
    const field = document.createElement("canvas");
    const fieldCtx = field.getContext("2d");
    const reveal = document.createElement("canvas");
    const revealCtx = reveal.getContext("2d");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = matchMedia("(pointer: coarse)");
    let w = 0,
      h = 0,
      frame = 0,
      lastMove = 0,
      visible = false,
      disposed = false,
      loaded = false;
    const pointer = {
      x: -1000,
      y: -1000,
      tx: -1000,
      ty: -1000,
      strength: 0,
      target: 0,
    };
    const wake: { x: number; y: number; t: number }[] = [];
    function size() {
      if (
        !el ||
        !ctx ||
        !sourceCtx ||
        !fieldCtx ||
        !loaded ||
        !visible ||
        disposed
      )
        return;
      cancelAnimationFrame(frame);
      const rect = el.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (!w || !h) return;
      const dpr = Math.min(devicePixelRatio, 1.75);
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      ctx.setTransform(el.width / w, 0, 0, el.height / h, 0, 0);
      for (const c of [source, field, reveal]) {
        c.width = Math.round(w);
        c.height = Math.round(h);
      }
      // RGB pixels always come from the unchanged original. The separate asset
      // contributes only its alpha, so no generated facial pixels can appear.
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
      fieldCtx.clearRect(0, 0, w, h);
      fieldCtx.textBaseline = "middle";
      // Rasterize the detailed field once. Pointer frames only composite these
      // cached layers and a small moving mask, rather than redrawing every dot.
      const step = w < 380 ? 2.35 : 2.75;
      for (let y = 0; y < h; y += step)
        for (let x = 0; x < w; x += step) {
          const p =
            (Math.min(source.height - 1, Math.floor(y)) * source.width +
              Math.min(source.width - 1, Math.floor(x))) *
            4;
          const a = data[p + 3] / 255;
          if (a < 0.12) continue;
          const luminance =
            (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114) / 255;
          const tone = light ? 1 - luminance : luminance;
          const detail = Math.pow(
            Math.max(0.035, Math.min(1, (tone - 0.035) / 0.88)),
            light ? 0.65 : 0.75,
          );
          const n = noise(x, y);
          fieldCtx.fillStyle = light
            ? `rgba(20,20,18,${a * 0.95})`
            : `rgba(248,247,239,${a * 0.94})`;
          if (n > 0.88 && detail > 0.15) {
            fieldCtx.globalAlpha = 0.35 + detail * 0.65;
            fieldCtx.font = `${3.2 + detail * 1.8}px monospace`;
            fieldCtx.fillText(
              glyphs[Math.floor(n * 1000) % glyphs.length],
              x,
              y,
            );
            fieldCtx.globalAlpha = 1;
          } else {
            fieldCtx.beginPath();
            fieldCtx.arc(x, y, 0.14 + detail * 1.35, 0, Math.PI * 2);
            fieldCtx.fill();
          }
        }
      el.parentElement?.setAttribute("data-ready", "true");
      draw(performance.now());
    }
    function draw(time: number) {
      if (!ctx || !revealCtx || !loaded || !visible || disposed || !w) return;
      ctx.clearRect(0, 0, w, h);

      if (reduced.matches || coarse.matches) {
        ctx.drawImage(source, 0, 0, w, h);
        return;
      }
      ctx.drawImage(field, 0, 0, w, h);
      pointer.x += (pointer.tx - pointer.x) * 0.19;
      pointer.y += (pointer.ty - pointer.y) * 0.19;
      pointer.strength += (pointer.target - pointer.strength) * 0.15;
      const radius = w * 0.16 * pointer.strength;
      if (pointer.strength > 0.005) {
        revealCtx.clearRect(0, 0, w, h);
        revealCtx.save();
        revealCtx.drawImage(source, 0, 0, w, h);
        revealCtx.globalCompositeOperation = "destination-in";
        revealCtx.filter = "blur(6px)";
        revealCtx.beginPath();
        const dx = (pointer.tx - pointer.x) * 0.25,
          dy = (pointer.ty - pointer.y) * 0.25;
        for (let i = 0; i <= 64; i++) {
          const angle = (i / 64) * Math.PI * 2;
          const organic =
            1 +
            0.07 * Math.sin(angle * 3 + time * 0.001) +
            0.045 * Math.cos(angle * 5 - time * 0.0012);
          const x = pointer.x + Math.cos(angle) * radius * organic + dx;
          const y = pointer.y + Math.sin(angle) * radius * organic + dy;
          if (!i) revealCtx.moveTo(x, y);
          else revealCtx.lineTo(x, y);
        }
        revealCtx.closePath();
        for (const p of wake) {
          const age = time - p.t;
          if (age < 240) {
            const r = radius * 0.55 * (1 - age / 240);
            revealCtx.moveTo(p.x + r, p.y);
            revealCtx.arc(p.x, p.y, r, 0, Math.PI * 2);
          }
        }
        revealCtx.fill();
        revealCtx.restore();
        // Clear the matching particles through the same soft mask before laying
        // down the photo. This avoids an opaque patch or a second shifted face.
        ctx.drawImage(reveal, 0, 0, w, h);
        const speed = Math.min(1, Math.hypot(dx, dy) / 10);
        if (speed > 0.05) {
          ctx.font = "5px monospace";
          for (let i = 0; i < 48; i++) {
            const a = (i / 48) * Math.PI * 2;
            const x = pointer.x + Math.cos(a) * (radius + 5 + noise(i, 4) * 10),
              y = pointer.y + Math.sin(a) * (radius + 5);
            ctx.fillStyle =
              i % 2
                ? `rgba(206,69,46,${speed * 0.6})`
                : `rgba(61,169,183,${speed * 0.5})`;
            ctx.fillText(glyphs[i % glyphs.length], x, y);
          }
        }
      }
      if (
        visible &&
        !document.hidden &&
        ((pointer.target && time - lastMove < 700) ||
          (!pointer.target && pointer.strength > 0.01))
      )
        frame = requestAnimationFrame(draw);
    }
    const move = (e: PointerEvent) => {
      if (coarse.matches || reduced.matches) return;
      const rect = el.getBoundingClientRect();
      lastMove = performance.now();
      pointer.tx = e.clientX - rect.left;
      pointer.ty = e.clientY - rect.top;
      if (pointer.x < 0) {
        pointer.x = pointer.tx;
        pointer.y = pointer.ty;
      }
      wake.push({ x: pointer.tx, y: pointer.ty, t: lastMove });
      if (wake.length > 8) wake.shift();
      pointer.target = 1;
      cancelAnimationFrame(frame);
      draw(lastMove);
    };
    const leave = () => {
      pointer.target = 0;
      cancelAnimationFrame(frame);
      draw(performance.now());
    };
    const refresh = () => {
      cancelAnimationFrame(frame);
      if (visible && !document.hidden && loaded) draw(performance.now());
    };
    const observer = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && loaded) size();
      else refresh();
    });
    observer.observe(el);
    const resize = new ResizeObserver(size);
    resize.observe(el);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    reduced.addEventListener("change", refresh);
    coarse.addEventListener("change", refresh);
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
      el.parentElement?.removeAttribute("data-ready");
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      reduced.removeEventListener("change", refresh);
      coarse.removeEventListener("change", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [light, still, width, height, crop]);
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
      {!still && <canvas ref={canvas} aria-hidden="true" />}
    </div>
  );
}
