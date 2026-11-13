"use client";
import { useEffect, useRef, useState } from "react";
import { gallery } from "@/content/media";
export default function Gallery() {
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [focused, setFocused] = useState(false),
    [failed, setFailed] = useState(false);
  const wrap = useRef<HTMLElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef(0);
  useEffect(() => {
    const el = wrap.current,
      c = canvas.current;
    if (!el || !c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let visible = false,
      timer: ReturnType<typeof setTimeout> | undefined,
      frame = 0,
      dead = false;
    const held = paused || focused;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    function clear() {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      ctx!.clearRect(0, 0, c!.width, c!.height);
    }
    function schedule() {
      clearTimeout(timer);
      if (visible && !document.hidden && !held && !motion.matches && !dead)
        timer = setTimeout(transition, 6000);
    }
    function transition() {
      if (!visible || document.hidden || held) return;
      const next = (current.current + 1) % gallery.length;
      const nextImage = new Image();
      nextImage.src = gallery[next].src!;
      let switched = false;
      let start = 0;
      const rect = c!.getBoundingClientRect(),
        dpr = Math.min(devicePixelRatio, 1.5);
      c!.width = rect.width * dpr;
      c!.height = rect.height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const animate = (time: number) => {
        if (dead) return;
        const p = Math.min((time - start) / 900, 1),
          w = rect.width,
          h = rect.height;
        ctx!.clearRect(0, 0, w, h);
        const center = -w * 1.5 + p * w * 4;
        for (let y = 0; y < h; y += 12)
          for (let x = 0; x < w; x += 9) {
            const edge =
              Math.sin(y * 0.017 + p * 4) * w * 0.08 +
              Math.sin(y * 0.037 - p * 5) * w * 0.025;
            const d = Math.abs(x - center - edge);
            if (d < w * 1.05) {
              const a = Math.min(1, (w * 1.05 - d) / (w * 0.16));
              ctx!.fillStyle = `rgba(250,247,240,${a})`;
              ctx!.fillRect(x, y, 10, 13);
              ctx!.fillStyle = `rgba(30,29,26,${a * 0.8})`;
              const seed =
                Math.abs(Math.sin(x * 12.9 + y * 78.2) * 43758.5) % 1;
              const drift =
                Math.sin(p * Math.PI * 2 + y * 0.018) *
                15 *
                Math.sin(p * Math.PI);
              ctx!.font = `${7 + seed * 4}px monospace`;
              ctx!.fillText(
                "AqKz74%#?01+:"[(x * 7 + y * 3 + Math.floor(p * 5)) % 13],
                x + drift,
                y + 10 + Math.sin(x * 0.04 + p * 6) * 3,
              );
            }
          }
        if (p >= 0.5 && !switched) {
          switched = true;
          current.current = next;
          setIndex(next);
          setFailed(false);
        }
        if (p < 1) frame = requestAnimationFrame(animate);
        else {
          ctx!.clearRect(0, 0, w, h);
          const preload = new Image();
          preload.src = gallery[(current.current + 1) % gallery.length].src!;
          schedule();
        }
      };
      const begin = () => {
        if (!dead && visible && !document.hidden && !held && !motion.matches) {
          start = performance.now();
          frame = requestAnimationFrame(animate);
        }
      };
      if (nextImage.complete && nextImage.naturalWidth) begin();
      else {
        nextImage.onload = begin;
        nextImage.onerror = () => {
          if (dead) return;
          current.current = next;
          setIndex(next);
          setFailed(true);
          schedule();
        };
      }
    }
    const change = () => {
      clear();
      schedule();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        change();
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    document.addEventListener("visibilitychange", change);
    motion.addEventListener("change", change);
    const preload = new Image();
    preload.src = gallery[(current.current + 1) % gallery.length].src!;
    return () => {
      dead = true;
      clear();
      observer.disconnect();
      document.removeEventListener("visibilitychange", change);
      motion.removeEventListener("change", change);
    };
  }, [paused, focused]);
  return (
    <figure
      className="gallery"
      ref={wrap}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
      data-index={index}
    >
      <div className="gallery-image">
        {failed ? (
          <div className="photo-fallback">A moment to come back to.</div>
        ) : (
          <img
            src={gallery[index].src}
            alt={gallery[index].alt}
            style={{ objectPosition: gallery[index].focal }}
            onError={() => setFailed(true)}
          />
        )}
        <canvas ref={canvas} aria-hidden="true" />
        <button
          className="focus-pause"
          onClick={() => setPaused((v) => !v)}
          aria-pressed={paused}
        >
          {paused ? "Resume photo changes" : "Pause photo changes"}
        </button>
      </div>
      <figcaption>
        <span>Life, lately & along the way.</span>
        <span aria-hidden="true">↗</span>
      </figcaption>
    </figure>
  );
}
