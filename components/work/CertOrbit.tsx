"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePortfolio } from "@/components/shared/context";
import {
  ArrowUpRight,
  Box,
  Bot,
  Code,
  Coffee,
  DraftingCompass,
  Film,
  Gamepad2,
  SquarePlay,
} from "lucide-react";
import { certificates } from "@/content/portfolio";

/** Small quadcopter glyph (lucide 0.468 has no drone icon). */
function DroneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="10" width="6" height="4.5" rx="1.4" />
      <path d="M9 11 6 8M15 11l3-3M9 13.5 6 16.5M15 13.5l3 3" />
      <path d="M3 7.5h6M15 7.5h6M3 17h6M15 17h6" />
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  "computer-programming-1": <Code size={20} aria-hidden="true" />,
  "computer-programming-2-java": <Coffee size={20} aria-hidden="true" />,
  "game-development-fundamentals": <Gamepad2 size={20} aria-hidden="true" />,
  "digital-media-1": <SquarePlay size={20} aria-hidden="true" />,
  "digital-media-2": <Film size={20} aria-hidden="true" />,
  "robotics-1": <Bot size={20} aria-hidden="true" />,
  "unmanned-aerial-systems": <DroneIcon />,
  "cad-architectural-design-1": <Box size={20} aria-hidden="true" />,
  "architectural-design-2": <DraftingCompass size={20} aria-hidden="true" />,
};

/**
 * Drag-and-fling for the certificate icons: grab one, throw it, and it
 * springs back to its place on the arc (under-damped, so it wobbles a
 * little). A drag never opens the link; a plain click still does.
 * Writes transforms directly — no React state per frame.
 */
function useFling(disabled: boolean) {
  const root = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const ul = root.current;
    if (!ul || disabled) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    type S = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      drag: boolean;
      moved: boolean;
      px: number;
      py: number;
      t: number;
    };
    const st = new Map<HTMLElement, S>();
    let raf = 0;
    const apply = (el: HTMLElement, s: S) => {
      const rot = Math.max(-18, Math.min(18, s.vx * 0.02));
      (el.firstElementChild as HTMLElement | null)?.style.setProperty(
        "transform",
        s.x || s.y ? `translate(${s.x}px, ${s.y}px) rotate(${rot}deg)` : "",
      );
      el.classList.toggle("is-flung", s.drag || Math.hypot(s.x, s.y) > 0.5);
    };
    const tick = (now: number) => {
      raf = 0;
      let live = false;
      st.forEach((s, el) => {
        if (s.drag) {
          live = true;
          return;
        }
        const dt = Math.min(0.033, (now - s.t) / 1000 || 0.016);
        s.t = now;
        // spring back to the arc: stiffness 170, damping 11 (a little wobble)
        s.vx += (-170 * s.x - 11 * s.vx) * dt;
        s.vy += (-170 * s.y - 11 * s.vy) * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (Math.hypot(s.x, s.y) < 0.3 && Math.hypot(s.vx, s.vy) < 4) {
          s.x = s.y = s.vx = s.vy = 0;
          st.delete(el);
        } else live = true;
        apply(el, s);
      });
      if (live) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const down = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(".wk-cert");
      if (!el || e.button !== 0) return;
      const s = st.get(el) ?? {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        drag: false,
        moved: false,
        px: 0,
        py: 0,
        t: 0,
      };
      s.drag = true;
      s.moved = false;
      s.px = e.clientX - s.x;
      s.py = e.clientY - s.y;
      s.t = performance.now();
      s.vx = s.vy = 0;
      st.set(el, s);
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(".wk-cert");
      const s = el && st.get(el);
      if (!el || !s?.drag) return;
      const nx = e.clientX - s.px;
      const ny = e.clientY - s.py;
      const now = performance.now();
      const dt = Math.max(0.008, (now - s.t) / 1000);
      s.vx = (nx - s.x) / dt;
      s.vy = (ny - s.y) / dt;
      s.x = nx;
      s.y = ny;
      s.t = now;
      if (Math.hypot(nx, ny) > 6) s.moved = true;
      apply(el, s);
    };
    const up = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(".wk-cert");
      const s = el && st.get(el);
      if (!el || !s) return;
      s.drag = false;
      s.t = performance.now();
      if (s.moved) {
        // swallow the click that follows a drag
        el.addEventListener("click", (ev) => ev.preventDefault(), {
          once: true,
          capture: true,
        });
      }
      if (reduce) {
        s.x = s.y = 0;
        st.delete(el);
        apply(el, s);
        return;
      }
      kick();
    };
    ul.addEventListener("pointerdown", down);
    ul.addEventListener("pointermove", move);
    ul.addEventListener("pointerup", up);
    ul.addEventListener("pointercancel", up);
    return () => {
      cancelAnimationFrame(raf);
      ul.removeEventListener("pointerdown", down);
      ul.removeEventListener("pointermove", move);
      ul.removeEventListener("pointerup", up);
      ul.removeEventListener("pointercancel", up);
      ul.querySelectorAll<HTMLElement>(".wk-cert").forEach(
        (el) => (el.style.transform = ""),
      );
    };
  }, [disabled]);
  return root;
}

/** Loose arc above the head: x in % of the hero width, y in px. */
const ARC: [number, number][] = [
  [45.6, 162],
  [50.6, 132],
  [55.4, 112],
  [60.2, 103],
  [65, 104],
  [69.8, 122],
  [74.6, 140],
  [79.2, 164],
  [83.4, 196],
];

/**
 * Nine certificate links on a loose arc above the portrait.
 * `still` renders a non-interactive copy (used by the reprise).
 */
export default function CertOrbit({ still = false }: { still?: boolean }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const { hydrated } = usePortfolio();
  const fling = useFling(still || !hydrated);
  const points = ARC.map(([x, y]) => `${x * 14.4},${y}`).join(" ");
  return (
    <div className="wk-orbit" data-intro={still ? undefined : "support"}>
      <svg
        className="wk-orbit-line"
        viewBox="0 0 1440 260"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline
          points={`${ARC[0][0] * 14.4 - 60},${ARC[0][1] - 52} ${points}`}
        />
      </svg>
      {still ? (
        <span className="wk-orbit-label" aria-hidden="true">
          09 certificates
        </span>
      ) : (
        <button
          type="button"
          className="wk-orbit-label"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
        >
          09 certificates
        </button>
      )}
      <ul
        ref={fling}
        className="wk-orbit-icons"
        aria-label={still ? undefined : "Certificates"}
      >
        {certificates.map((c, i) => {
          const [x, y] = ARC[i];
          const style = {
            left: `calc(${x}% * var(--arc-k, 1) + var(--arc-d, 0%))`,
            top: `${y}px`,
          };
          const tip = (
            <span className="wk-cert-tip" aria-hidden="true">
              <span className="wk-cert-tip-title">
                {c.title} <ArrowUpRight size={14} aria-hidden="true" />
              </span>
              <span className="wk-cert-tip-date">{c.date}</span>
            </span>
          );
          return (
            <li
              key={c.id}
              className={`wk-cert ${i >= 6 ? "wk-cert-end" : ""}`}
              style={style}
            >
              {still ? (
                <span className="wk-cert-btn">{ICONS[c.id]}</span>
              ) : (
                <a
                  className="wk-cert-btn"
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${c.title} certificate, ${c.date}`}
                >
                  {ICONS[c.id]}
                  {tip}
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {!still && (
        <div id={listId} className="wk-cert-list" hidden={!open}>
          <ul>
            {certificates.map((c) => (
              <li key={c.id}>
                <a href={c.href} target="_blank" rel="noopener noreferrer">
                  <span>
                    {c.title} <ArrowUpRight size={14} aria-hidden="true" />
                  </span>
                  <span className="wk-cert-list-date">{c.date}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
