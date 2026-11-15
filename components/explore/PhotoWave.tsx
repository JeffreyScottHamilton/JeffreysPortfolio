"use client";
import { useEffect, useRef, useState } from "react";
import { GLYPHS, usePortfolio } from "@/components/shared/context";
import type { Media } from "@/content/media";

/**
 * The ONE Explore photo area (recent photos). Holds each photo, then the photo
 * breaks into its halftone dots, which lift off and stream away along a
 * curved dotted ribbon (out of the frame, toward the orbit); at the same time
 * the next photo's dots stream in along the ribbon from the other side and
 * settle (with a slight overshoot) into its halftone, and the real next photo
 * resolves over them. The arc is seeded per transition so it never repeats
 * identically. Wraps around. Reduced motion: a plain fade.
 *
 * Timing uses only setTimeout / performance.now / requestAnimationFrame.
 * The FIRST <img> inside [data-gallery] is always the current photo.
 */
const HOLD_MS = 6000;
const WAVE_MS = 1100;
/** hold time already "spent" when a transition ends (its tail shows the new photo) */
const AFTER_WAVE_ELAPSED = 0;
const REDUCED_HOLD_MS = 10000;
const TICK_MS = 200;
/** dots per photo; two photos are in flight at once (≈3k particles) */
const MAX_DOTS = 1450;
const RED = "#e2402b";
const CYAN = "#20a7b8";

type Loaded = { index: number; img: HTMLImageElement };
type Dots = { x: Float32Array; y: Float32Array; r: Float32Array; pitch: number };
type RibbonPoint = { x: number; y: number; tx: number; ty: number; nx: number; ny: number };

function focalOf(m: Media) {
  const [x = "50%", y = "50%"] = m.focal.split(/\s+/);
  return { fx: parseFloat(x) / 100, fy: parseFloat(y) / 100 };
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sm = (v: number) => {
  const c = clamp01(v);
  return c * c * (3 - 2 * c);
};
const backOut = (p: number, k = 1.5) => {
  const q = p - 1;
  return 1 + (k + 1) * q * q * q + k * q * q;
};

/**
 * One seeded ribbon through the photo: enters from the lower right (s = 0),
 * passes through the frame (s ≈ 0.5) and sweeps out toward the upper left
 * (s = 1), i.e. toward the year's orbit. Two quadratic arcs joined smoothly at
 * the frame; positions past either end extend along the end tangents.
 */
function makeRibbon(rnd: () => number, vx: number, vy: number, vw: number, vh: number) {
  const cx = vx + vw * (0.4 + rnd() * 0.2);
  const cy = vy + vh * (0.38 + rnd() * 0.24);
  const sx = vx + vw * (1.12 + rnd() * 0.18);
  const sy = vy + vh * (0.75 + rnd() * 0.55);
  const ex = vx - vw * (0.78 + rnd() * 0.3);
  const ey = vy + vh * (-0.55 + rnd() * 0.75);
  // tangent through the frame, swung a little each time
  let tx = ex - sx;
  let ty = ey - sy;
  const tl = Math.hypot(tx, ty) || 1;
  const sw = (rnd() - 0.5) * 1.3;
  const c = Math.cos(sw);
  const s = Math.sin(sw);
  [tx, ty] = [(tx * c - ty * s) / tl, (tx * s + ty * c) / tl];
  const la = Math.hypot(cx - sx, cy - sy) * (0.45 + rnd() * 0.25);
  const lb = Math.hypot(ex - cx, ey - cy) * (0.45 + rnd() * 0.3);
  const ax = cx - tx * la;
  const ay = cy - ty * la;
  const bx = cx + tx * lb;
  const by = cy + ty * lb;
  const SEG = 96;
  const X = new Float32Array(SEG + 1);
  const Y = new Float32Array(SEG + 1);
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    if (t <= 0.5) {
      const u = t / 0.5;
      const v = 1 - u;
      X[i] = v * v * sx + 2 * v * u * ax + u * u * cx;
      Y[i] = v * v * sy + 2 * v * u * ay + u * u * cy;
    } else {
      const u = (t - 0.5) / 0.5;
      const v = 1 - u;
      X[i] = v * v * cx + 2 * v * u * bx + u * u * ex;
      Y[i] = v * v * cy + 2 * v * u * by + u * u * ey;
    }
  }
  const at = (sv: number, o: RibbonPoint) => {
    const f = Math.min(SEG - 1e-4, Math.max(0, sv * SEG));
    const i = Math.floor(f);
    const dx = X[i + 1] - X[i];
    const dy = Y[i + 1] - Y[i];
    const l = Math.hypot(dx, dy) || 1;
    o.tx = dx / l;
    o.ty = dy / l;
    o.nx = -o.ty;
    o.ny = o.tx;
    // beyond either end: continue along the end tangent
    const ext = (sv * SEG - f) * l;
    const k = f - i;
    o.x = X[i] + dx * k + o.tx * ext;
    o.y = Y[i] + dy * k + o.ty * ext;
  };
  const nearest = (x: number, y: number) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i <= SEG; i += 2) {
      const d = (X[i] - x) ** 2 + (Y[i] - y) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best / SEG;
  };
  return {
    at,
    nearest,
    width: vh * (0.16 + rnd() * 0.12),
    strands: 4 + Math.floor(rnd() * 3),
    twist: 0.8 + rnd() * 1.2,
    phase: rnd(),
    dot: Math.max(1.4, Math.min(vw, vh) * 0.006),
  };
}

export default function PhotoWave({
  photos,
  className = "",
}: {
  photos: Media[];
  className?: string;
}) {
  const { reducedMotion } = usePortfolio();
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

    let precompute: (n: Loaded) => void = () => {};

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
          precompute(s.next);
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
      s.next = null;
      preload(n.index + 1);
    };

    // ---- ribbon transition: dots lift off along a dotted ribbon, the next
    // photo's dots stream in along it and settle. The fx canvas lives inside
    // the tilted box (same transform) but is larger than the photo, so dots
    // can travel out of the frame.
    const ctx = canvas.getContext("2d");
    const view = imgEl.parentElement as HTMLElement;
    const ink = getComputedStyle(el).getPropertyValue("--ink").trim() || "#121212";

    const drawCover = (
      c: CanvasRenderingContext2D,
      im: HTMLImageElement,
      m: Media,
      x: number,
      y: number,
      w: number,
      h: number,
    ) => {
      const iw = im.naturalWidth || w;
      const ih = im.naturalHeight || h;
      const k = Math.max(w / iw, h / ih);
      const dw = iw * k;
      const dh = ih * k;
      const { fx, fy } = focalOf(m);
      c.drawImage(im, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh);
    };

    const dotCache = new Map<string, Dots>();
    const sampler = document.createElement("canvas");
    const sctx = sampler.getContext("2d", { willReadFrequently: true });

    /** coarse halftone of a photo (view-local px), capped at MAX_DOTS */
    const dotsOf = (i: number, im: HTMLImageElement, w: number, h: number): Dots | null => {
      const key = `${i}:${Math.round(w)}x${Math.round(h)}`;
      const hit = dotCache.get(key);
      if (hit) return hit;
      if (!sctx) return null;
      const pitch = Math.max(6, Math.sqrt((w * h) / MAX_DOTS));
      const cols = Math.max(1, Math.floor(w / pitch));
      const rows = Math.max(1, Math.floor(h / pitch));
      const px = w / cols;
      const py = h / rows;
      sampler.width = cols;
      sampler.height = rows;
      sctx.clearRect(0, 0, cols, rows);
      drawCover(sctx, im, photos[i], 0, 0, cols, rows);
      let d: Uint8ClampedArray;
      try {
        d = sctx.getImageData(0, 0, cols, rows).data;
      } catch {
        return null;
      }
      const maxR = Math.min(px, py) * 0.5;
      const xs: number[] = [];
      const ys: number[] = [];
      const rs: number[] = [];
      const rnd = rng(i * 131 + 17);
      for (let j = 0; j < rows; j++)
        for (let c = 0; c < cols; c++) {
          const q = (j * cols + c) * 4;
          const L = (0.2126 * d[q] + 0.7152 * d[q + 1] + 0.0722 * d[q + 2]) / 255;
          const t = Math.min(1, Math.max(0, (0.97 - L) / 0.9));
          const r = maxR * Math.sqrt(t);
          const jx = (rnd() - 0.5) * px * 0.16;
          const jy = (rnd() - 0.5) * py * 0.16;
          if (r < maxR * 0.14) continue;
          xs.push((c + 0.5) * px + jx);
          ys.push((j + 0.5) * py + jy);
          rs.push(r);
        }
      const out: Dots = {
        x: Float32Array.from(xs),
        y: Float32Array.from(ys),
        r: Float32Array.from(rs),
        pitch: Math.min(px, py),
      };
      dotCache.set(key, out);
      return out;
    };
    const frameSize = () => ({
      w: Math.max(1, view.clientWidth),
      h: Math.max(1, view.clientHeight),
    });
    // precompute the next photo's dots as soon as it has decoded
    precompute = (n: Loaded) => {
      const { w, h } = frameSize();
      if (view.clientWidth > 0) dotsOf(n.index, n.img, w, h);
    };

    let waves = 0;
    const runWave = (n: Loaded) => {
      const oldImg = s.currentImg ?? imgEl;
      const { w: vw, h: vh } = frameSize();
      const from = ctx ? dotsOf(s.index, oldImg, vw, vh) : null;
      const to = ctx ? dotsOf(n.index, n.img, vw, vh) : null;
      if (!ctx || !from || !to) {
        runFade(n);
        return;
      }
      s.busy = true;
      canvas.style.display = "block";
      const cw = Math.max(1, canvas.clientWidth);
      const ch = Math.max(1, canvas.clientHeight);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      // view origin in canvas space (both laid out inside the tilt box)
      const vx = view.offsetLeft - canvas.offsetLeft;
      const vy = view.offsetTop - canvas.offsetTop;
      const bg = getComputedStyle(view).backgroundColor || "#efe8db";
      const oldMeta = photos[s.index];
      const newMeta = photos[n.index];
      const rnd = rng((++waves) * 7919 + n.index * 31);
      const R = makeRibbon(rnd, vx, vy, vw, vh);

      const prep = (D: Dots, out: boolean) => {
        const m = D.x.length;
        const s0 = new Float32Array(m);
        const lane = new Float32Array(m);
        const del = new Float32Array(m);
        const flag = new Uint8Array(m); // 1 leader (fringe), 2 glyph
        const gl = new Array<string>(m);
        let lo = Infinity;
        let hi = -Infinity;
        for (let k = 0; k < m; k++) {
          s0[k] = R.nearest(vx + D.x[k], vy + D.y[k]);
          lo = Math.min(lo, s0[k]);
          hi = Math.max(hi, s0[k]);
        }
        const span = hi - lo || 1;
        for (let k = 0; k < m; k++) {
          const u = (s0[k] - lo) / span;
          // outgoing: dots nearest the exit leave first; incoming: nearest the entry settle first
          del[k] = 0.62 * (out ? 1 - u : u) + 0.38 * rnd();
          const strand = Math.floor(rnd() * R.strands);
          lane[k] = (strand - (R.strands - 1) / 2) / ((R.strands - 1) / 2 || 1) + (rnd() - 0.5) * 0.22;
          const f = rnd();
          flag[k] = f < 0.03 ? 2 : del[k] < 0.26 ? 1 : 0;
          gl[k] = GLYPHS[Math.floor(rnd() * GLYPHS.length)];
        }
        return { s0, lane, del, flag, gl };
      };
      const A = prep(from, true);
      const B = prep(to, false);
      const family = getComputedStyle(el).fontFamily || "sans-serif";
      const start = performance.now();
      const pt = { x: 0, y: 0, tx: 1, ty: 0, nx: 0, ny: 1 };

      const frame = () => {
        if (!alive) return;
        const p = Math.min(1, (performance.now() - start) / WAVE_MS);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // the photo window: covers the <img> for the whole transition
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(vx, vy, vw, vh, 16);
        else ctx.rect(vx, vy, vw, vh);
        ctx.clip();
        ctx.fillStyle = bg;
        ctx.fillRect(vx, vy, vw, vh);
        const out = 1 - sm(p / 0.13);
        if (out > 0.002) {
          ctx.globalAlpha = out;
          drawCover(ctx, oldImg, oldMeta, vx, vy, vw, vh);
          ctx.globalAlpha = 1;
        }
        ctx.restore();

        const ink0 = new Path2D();
        const ink1 = new Path2D(); // faded tails
        const red = new Path2D();
        const cyan = new Path2D();
        const glyphs: [number, number, number, string, number][] = [];
        const put = (x: number, y: number, r: number, a: number, fl: number, g: string, moving: boolean) => {
          if (r < 0.3 || a < 0.03) return;
          if (moving && fl === 2) {
            glyphs.push([x, y, r, g, a]);
            return;
          }
          if (moving && fl === 1) {
            const f = Math.max(1.2, r * 0.55);
            red.moveTo(x - pt.tx * f + r * 0.85, y - pt.ty * f);
            red.arc(x - pt.tx * f, y - pt.ty * f, r * 0.85, 0, Math.PI * 2);
            cyan.moveTo(x + pt.tx * f + r * 0.85, y + pt.ty * f);
            cyan.arc(x + pt.tx * f, y + pt.ty * f, r * 0.85, 0, Math.PI * 2);
          }
          const path = a > 0.6 ? ink0 : ink1;
          path.moveTo(x + r, y);
          path.arc(x, y, r, 0, Math.PI * 2);
        };

        // outgoing: lift off, join the ribbon, stream away
        for (let k = 0; k < from.x.length; k++) {
          const q = clamp01((p - 0.04 - A.del[k] * 0.32) / 0.42);
          const x0 = vx + from.x[k];
          const y0 = vy + from.y[k];
          const r0 = from.r[k];
          if (q <= 0) {
            put(x0, y0, r0, 1, 0, "", false);
            continue;
          }
          const w = sm(q / 0.36);
          const sv = A.s0[k] + Math.pow(q, 1.35) * (1.14 - A.s0[k]);
          R.at(sv, pt);
          const off = A.lane[k] * R.width * (0.55 + 0.45 * Math.cos(Math.PI * 2 * (sv * R.twist + R.phase)));
          const rx = pt.x + pt.nx * off;
          const ry = pt.y + pt.ny * off;
          const x = x0 + (rx - x0) * w;
          const y = y0 + (ry - y0) * w;
          const lift = 1 + 0.35 * Math.sin(Math.PI * Math.min(1, q / 0.36));
          const rr = (r0 + (R.dot - r0) * w) * lift;
          const a = 1 - sm((sv - 0.9) / 0.24);
          put(x, y, rr, a, A.flag[k], A.gl[k], q < 1);
        }
        // incoming: stream in along the ribbon from the other side, settle
        for (let k = 0; k < to.x.length; k++) {
          const q = clamp01((p - 0.24 - B.del[k] * 0.3) / 0.44);
          if (q <= 0) continue;
          const x1 = vx + to.x[k];
          const y1 = vy + to.y[k];
          const r1 = to.r[k];
          const tq = Math.min(1, q / 0.72);
          const sv = -0.14 + (B.s0[k] + 0.14) * (1 - (1 - tq) * (1 - tq));
          R.at(sv, pt);
          const off = B.lane[k] * R.width * (0.55 + 0.45 * Math.cos(Math.PI * 2 * (sv * R.twist + R.phase)));
          const rx = pt.x + pt.nx * off;
          const ry = pt.y + pt.ny * off;
          const w = backOut(clamp01((q - 0.42) / 0.58), 1.7);
          const x = rx + (x1 - rx) * w;
          const y = ry + (y1 - ry) * w;
          const rr = R.dot + (r1 - R.dot) * clamp01(w);
          const a = sm((sv + 0.14) / 0.2);
          put(x, y, rr, a, B.flag[k], B.gl[k], q < 0.85);
        }

        ctx.fillStyle = RED;
        ctx.fill(red);
        ctx.fillStyle = CYAN;
        ctx.fill(cyan);
        ctx.fillStyle = ink;
        ctx.fill(ink0);
        ctx.globalAlpha = 0.45;
        ctx.fill(ink1);
        if (glyphs.length) {
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          for (const [x, y, r, g, a] of glyphs) {
            ctx.globalAlpha = a;
            ctx.font = `italic 500 ${Math.max(10, r * 3.2).toFixed(1)}px ${family}`;
            ctx.fillText(g, x, y);
          }
        }
        ctx.globalAlpha = 1;

        // the real next photo resolves over its settled dots
        const inn = sm((p - 0.8) / 0.2);
        if (inn > 0.002) {
          ctx.save();
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(vx, vy, vw, vh, 16);
          else ctx.rect(vx, vy, vw, vh);
          ctx.clip();
          ctx.globalAlpha = inn;
          drawCover(ctx, n.img, newMeta, vx, vy, vw, vh);
          ctx.restore();
          ctx.globalAlpha = 1;
        }

        if (p >= 0.4 && s.next === n) {
          // swap the real <img> while the canvas fully covers it
          commit(n);
        }
        if (p < 1) {
          raf = requestAnimationFrame(frame);
        } else {
          canvas.style.display = "none";
          canvas.width = canvas.height = 0;
          s.busy = false;
          // the transition's tail counts toward the next hold
          s.elapsed = AFTER_WAVE_ELAPSED;
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
      imgEl.style.objectPosition = photos[i].focal;
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
      canvas.style.display = "none";
      canvas.width = canvas.height = 0;
      imgEl.style.opacity = "1";
      io.disconnect();
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
      imgEl.removeEventListener("error", onError);
      s.busy = false;
    };
  }, [photos, reducedMotion]);

  const first = photos[0];
  if (!first) return null;

  return (
    <figure
      ref={root}
      className={`photo-wave ${className}`}
      data-gallery=""
    >
      <figcaption className="photo-wave-label">
        Lately — the last couple of years
      </figcaption>
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
        </div>
        <canvas ref={canvasRef} className="photo-wave-fx" aria-hidden="true" />
      </div>
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
