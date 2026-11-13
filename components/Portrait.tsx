"use client";
import { useEffect, useLayoutEffect, useId, useRef } from "react";
import { portrait, portraitGeometry } from "@/content/media";
import { ParticleDynamics, particleFluid } from "@/lib/particle-fluid";
import {
  formationFor,
  type SceneMotion,
  type SceneRole,
} from "@/lib/scene-motion";
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
  rgb: [number, number, number];
};
export default function Portrait({
  light = false,
  decorative = false,
  still = false,
  motion,
  role = "static",
  onReady,
}: {
  light?: boolean;
  decorative?: boolean;
  still?: boolean;
  motion?: SceneMotion;
  role?: SceneRole;
  onReady?: (usable: boolean) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    particles = useRef<HTMLCanvasElement>(null);
  const readyCallback = useRef(onReady);
  readyCallback.current = onReady;
  const maskId = `portrait-${useId().replace(/:/g, "")}`;
  const { width, height, crop } = portraitGeometry;
  const palette = useRef(light),
    retint = useRef<(() => void) | null>(null);
  palette.current = light;
  useEffect(() => {
    const el = canvas.current,
      gpuCanvas = particles.current;
    if (!el || still) return;
    const ctx = el.getContext("2d");
    if (!ctx) {
      el.parentElement?.setAttribute("data-failed", "true");
      readyCallback.current?.(false);
      return;
    }
    const photo = new Image(),
      alpha = new Image();
    const source = document.createElement("canvas"),
      sourceCtx = source.getContext("2d", { willReadFrequently: true });
    const atlas = makeParticleAtlas(),
      reduced = matchMedia("(prefers-reduced-motion: reduce)"),
      coarse = matchMedia("(pointer: coarse)");
    let w = 0,
      h = 0,
      frame = 0,
      lastTime = 0,
      lastPaint = 0,
      visible = false,
      disposed = false,
      loaded = false,
      announced = false,
      hover = 0;
    let localPointer: [number, number, number] = [-9999, -9999, 0];
    let renderer: ParticleRenderer | null = null,
      dynamics: ParticleDynamics | null = null;
    let points = new Float32Array(0);
    const motes: Mote[] = [];
    const mobile = () => reduced.matches || coarse.matches;
    const formation = () => (reduced.matches ? 1 : formationFor(motion, role));
    const scatter = () => (role === "hero" ? (motion?.heroScatter ?? 0) : 0);
    function schedule() {
      if (
        !frame &&
        visible &&
        !document.hidden &&
        !disposed &&
        loaded &&
        !reduced.matches &&
        (!coarse.matches || formation() < 0.999) &&
        (!decorative || role !== "static")
      )
        frame = requestAnimationFrame(draw);
    }
    function size() {
      if (!ctx || !sourceCtx || !loaded || !visible || disposed) return;
      cancelAnimationFrame(frame);
      frame = 0;
      const rect = el!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (!w || !h) return;
      const dpr = Math.min(devicePixelRatio, 1.65);
      el!.width = Math.round(w * dpr);
      el!.height = Math.round(h * dpr);
      ctx.setTransform(el!.width / w, 0, 0, el!.height / h, 0, 0);
      ctx.textBaseline = "middle";
      for (const c of [source]) {
        c.width = crop.width;
        c.height = crop.height;
      }
      sourceCtx.drawImage(
        photo,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        source.width,
        source.height,
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
        source.width,
        source.height,
      );
      sourceCtx.globalCompositeOperation = "source-over";

      const pixels = sourceCtx.getImageData(
          0,
          0,
          source.width,
          source.height,
        ).data,
        values: number[] = [];
      motes.length = 0;
      if (!reduced.matches) {
        const grid = coarse.matches ? 110 : 180;
        for (let gy = 0; gy < grid; gy++)
          for (let gx = 0; gx < grid; gx++) {
            const nx = (gx + 0.5) / grid,
              ny = (gy + 0.5) / grid,
              x = nx * w,
              y = ny * h;
            const index =
              (Math.min(source.height - 1, Math.floor(ny * source.height)) *
                source.width +
                Math.min(source.width - 1, Math.floor(nx * source.width))) *
              4;
            const a = pixels[index + 3] / 255;
            if (a < 0.15) continue;
            const seed = noise(nx * crop.width, ny * crop.height),
              landmark = nx > 0.28 && nx < 0.76 && ny > 0.24 && ny < 0.56;
            if (seed < (landmark ? 0.1 : 0.28)) continue;
            const lum =
              (pixels[index] * 0.299 +
                pixels[index + 1] * 0.587 +
                pixels[index + 2] * 0.114) /
              255;
            const baseDetail = Math.pow(
              Math.max(0.025, Math.min(1, (lum - 0.035) / 0.88)),
              1.05,
            );
            const detail = Math.pow(
              Math.max(
                0.025,
                Math.min(1, ((palette.current ? 1 - lum : lum) - 0.035) / 0.88),
              ),
              palette.current ? 0.8 : 1.05,
            );
            const glyph =
              seed > (landmark ? 0.955 : 0.88) && baseDetail > 0.12
                ? (Math.floor(seed * 1000) % particleGlyphs.length) + 1
                : 0;
            const size = glyph
              ? (landmark ? 3.8 : 6.0) + baseDetail * 1.7
              : palette.current
                ? (w / grid) * 0.82
                : (0.18 + detail * 1.28) * 2;
            const opacity =
              a *
              (landmark ? 0.95 : 0.78) *
              (glyph ? 0.45 + baseDetail * 0.55 : 1);
            const rgb: [number, number, number] = [
              pixels[index],
              pixels[index + 1],
              pixels[index + 2],
            ];
            const p = { x, y, size, alpha: opacity, glyph, seed, rgb };
            motes.push(p);
            values.push(
              x,
              y,
              size,
              opacity,
              glyph,
              seed,
              ...rgb.map((channel) => channel / 255),
            );
          }
      }
      points = new Float32Array(values);
      if (dynamics && dynamics.homes.length === points.length)
        dynamics.homes.set(points);
      else dynamics = new ParticleDynamics(points, 9);
      if (!mobile() && gpuCanvas && (!decorative || role !== "static")) {
        if (!renderer)
          renderer = createParticleRenderer(gpuCanvas, atlas, palette.current);
        renderer?.upload(points, w, h, dpr, palette.current);
      }
      if (gpuCanvas)
        gpuCanvas.style.opacity = renderer && !mobile() ? "1" : "0";
      el!.parentElement?.setAttribute("data-ready", "true");
      el!.parentElement?.removeAttribute("data-failed");
      el!.parentElement?.setAttribute(
        "data-particle-engine",
        mobile() ? "still" : renderer ? "webgl" : "canvas",
      );
      lastTime = lastPaint = 0;
      draw(performance.now());
      if (!announced) {
        announced = true;
        readyCallback.current?.(true);
      }
    }
    function paintMote(p: Mote, index: number, time: number, formed: number) {
      if (!ctx || !dynamics) return;
      const t = formed * formed * (3 - 2 * formed);
      const startX = p.x + Math.cos(p.seed * 25) * (0.2 + p.seed) * w,
        startY = p.y + Math.sin(p.seed * 19) * h * 0.48 + h * 0.25;
      const amp =
        p.y / h > 0.24 && p.y / h < 0.58 ? 0.12 : p.glyph ? 3 + p.seed * 5 : 1;
      const x =
        Math.sin(time * 0.0005 + (p.y / h) * 5 + p.seed) * amp +
        startX +
        (p.x - startX) * t +
        Math.sin(p.seed * 9) * 80 * Math.sin(t * Math.PI) +
        dynamics.offsets[index * 2];
      const y =
        Math.cos(time * 0.00043 + (p.x / w) * 6 + p.seed) * amp +
        startY +
        (p.y - startY) * t -
        60 * Math.sin(t * Math.PI) +
        dynamics.offsets[index * 2 + 1];
      const distance = Math.hypot(x - localPointer[0], y - localPointer[1]);
      const edge = Math.max(0, Math.min(1, (distance - 18) / 107)),
        proximity = 1 - edge * edge * (3 - 2 * edge);
      const tint =
        Math.min(
          1,
          proximity * hover * 0.95 +
            Math.min(
              0.55,
              Math.hypot(
                dynamics.offsets[index * 2],
                dynamics.offsets[index * 2 + 1],
              ) / 100,
            ),
        ) * t;
      const ink = palette.current ? [20, 20, 18] : [248, 247, 239];
      const peak = Math.max(20, ...p.rgb);
      ctx.fillStyle = `rgb(${p.rgb.map((channel, i) => (palette.current ? channel : Math.round(ink[i] + ((channel / peak) * 240 - ink[i]) * tint))).join(",")})`;
      ctx.globalAlpha = p.alpha * (0.12 + 0.88 * t);
      if (p.glyph) {
        ctx.font = `${p.size}px monospace`;
        ctx.fillText(particleGlyphs[p.glyph - 1], x, y);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    function draw(time: number) {
      frame = 0;
      if (
        !ctx ||
        !dynamics ||
        !loaded ||
        !visible ||
        disposed ||
        !w ||
        document.hidden
      )
        return;
      const formed = formation(),
        isForming = formed < 0.999;
      const fps =
        isForming ||
        (dynamics?.energy ?? 0) > 0.1 ||
        time - particleFluid.pointer.time < 300
          ? renderer
            ? 60
            : 30
          : 30;
      if (lastPaint && time - lastPaint < 1000 / fps) {
        schedule();
        return;
      }
      const dt = lastTime ? Math.min(0.12, (time - lastTime) / 1000) : 1 / 30;
      lastPaint = lastTime = time;
      ctx.clearRect(0, 0, w, h);
      if (reduced.matches || (coarse.matches && !isForming)) {
        renderer?.clear();
        ctx.drawImage(source, 0, 0, w, h);
        return;
      }
      const rect = el!.getBoundingClientRect();
      const pointer = particleFluid.pointer,
        inside =
          pointer.time > 0 &&
          pointer.x >= rect.left &&
          pointer.x <= rect.right &&
          pointer.y >= rect.top &&
          pointer.y <= rect.bottom;
      hover += ((inside ? 1 : 0) - hover) * (1 - Math.exp(-dt * 9));
      localPointer = [
        ((pointer.x - rect.left) * w) / rect.width,
        ((pointer.y - rect.top) * h) / rect.height,
        hover,
      ];
      dynamics.step(
        dt,
        time,
        rect.left,
        rect.top,
        rect.width / w,
        rect.height / h,
      );
      if (renderer)
        renderer.paint({
          time,
          formation: formed,
          scatter: scatter(),
          offsets: dynamics.offsets,
          pointer: localPointer,
        });
      else {
        ctx.fillStyle = palette.current ? "#141412" : "#f8f7ef";
        const stride = coarse.matches ? 2 : 1;
        for (let i = 0; i < motes.length; i += stride)
          paintMote(motes[i], i, time, formed);
        ctx.globalAlpha = 1;
      }
      // Pointer interaction only transports particles. No photo mask or alpha hole.
      schedule();
    }

    const releaseFluid = particleFluid.acquire();
    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = lastPaint = 0;
      if (visible && !document.hidden && loaded) draw(performance.now());
    };
    const preference = () => {
      dynamics?.reset();
      renderer?.clear();
      size();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && loaded) size();
      else refresh();
    });
    observer.observe(el);
    const resize = new ResizeObserver(size);
    resize.observe(el);
    const unsubscribe = motion?.subscribe(() => {
      if (visible && loaded) {
        lastPaint = 0;
        if (decorative || mobile()) {
          cancelAnimationFrame(frame);
          frame = 0;
          draw(performance.now());
        } else schedule();
      }
    });
    retint.current = size;
    const lost = (e: Event) => {
      e.preventDefault();
      renderer?.dispose();
      renderer = null;
      if (gpuCanvas) gpuCanvas.style.opacity = "0";
      el.parentElement?.setAttribute("data-particle-engine", "canvas");
      refresh();
    };
    const restored = () => {
      renderer = null;
      size();
    };
    gpuCanvas?.addEventListener("webglcontextlost", lost);
    gpuCanvas?.addEventListener("webglcontextrestored", restored);

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
        if (!disposed) {
          el.style.opacity = "0";
          el.parentElement?.setAttribute("data-failed", "true");
          readyCallback.current?.(false);
        }
      });
    return () => {
      retint.current = null;
      disposed = true;
      cancelAnimationFrame(frame);
      renderer?.dispose();
      unsubscribe?.();
      observer.disconnect();
      resize.disconnect();
      el.parentElement?.removeAttribute("data-ready");
      el.parentElement?.removeAttribute("data-particle-engine");
      releaseFluid();
      reduced.removeEventListener("change", preference);
      coarse.removeEventListener("change", preference);
      document.removeEventListener("visibilitychange", refresh);
      gpuCanvas?.removeEventListener("webglcontextlost", lost);
      gpuCanvas?.removeEventListener("webglcontextrestored", restored);
    };
  }, [decorative, still, motion, role, width, height, crop]);
  useLayoutEffect(() => {
    retint.current?.();
  }, [light]);
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
            : "Jeffrey Hamilton, rendered in fine dots and letters. Move your pointer to stir the particles; they flow and settle back."
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
