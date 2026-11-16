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
  Sparkles,
  SquareTerminal,
} from "lucide-react";
import { certificates } from "@/content/portfolio";
import Words from "./Words";

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
  "claude-101": <Sparkles size={20} aria-hidden="true" />,
  "claude-code-101": <SquareTerminal size={20} aria-hidden="true" />,
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
      // small magnetic leans keep the tooltip; real drags/throws hide it
      el.classList.toggle("is-flung", s.drag || Math.hypot(s.x, s.y) > 12);
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
        // (target = the magnetic pull toward the cursor, 0 when it's away)
        const tx = mag.get(el)?.x ?? 0;
        const ty = mag.get(el)?.y ?? 0;
        s.vx += (-170 * (s.x - tx) - 11 * s.vx) * dt;
        s.vy += (-170 * (s.y - ty) - 11 * s.vy) * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (
          !tx &&
          !ty &&
          Math.hypot(s.x, s.y) < 0.3 &&
          Math.hypot(s.vx, s.vy) < 4
        ) {
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
    // Magnetic hover: icons lean toward a nearby cursor (fine pointers only).
    const mag = new Map<HTMLElement, { x: number; y: number }>();
    const RANGE = 150;
    const near = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || reduce) return;
      ul.querySelectorAll<HTMLElement>(".wk-cert").forEach((el) => {
        const r = el.getBoundingClientRect(); // the li never moves; its button does
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy);
        const pull = d < RANGE ? 0.32 * (1 - d / RANGE) ** 1.4 : 0;
        const prev = mag.get(el);
        if (!pull && !prev) return;
        if (pull) mag.set(el, { x: dx * pull, y: dy * pull });
        else mag.delete(el);
        if (!st.has(el))
          st.set(el, {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            drag: false,
            moved: false,
            px: 0,
            py: 0,
            t: performance.now(),
          });
      });
      kick();
    };
    const leave = () => {
      if (!mag.size) return;
      mag.clear();
      kick();
    };
    // A press only becomes a drag after the pointer moves a few px while
    // held. Until then nothing is captured, so a plain click reaches the
    // link and opens the certificate.
    let active: {
      el: HTMLElement;
      id: number;
      sx: number;
      sy: number;
      started: boolean;
    } | null = null;
    const down = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(".wk-cert");
      if (!el || e.button !== 0) return;
      active = {
        el,
        id: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        started: false,
      };
    };
    const move = (e: PointerEvent) => {
      if (!active || e.pointerId !== active.id) return;
      const { el } = active;
      if (!active.started) {
        if (Math.hypot(e.clientX - active.sx, e.clientY - active.sy) < 6)
          return;
        active.started = true;
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
        s.moved = true;
        s.px = active.sx - s.x;
        s.py = active.sy - s.y;
        s.t = performance.now();
        s.vx = s.vy = 0;
        st.set(el, s);
        try {
          el.setPointerCapture(e.pointerId);
        } catch {}
      }
      const s = st.get(el);
      if (!s?.drag) return;
      const nx = e.clientX - s.px;
      const ny = e.clientY - s.py;
      const now = performance.now();
      const dt = Math.max(0.008, (now - s.t) / 1000);
      s.vx = (nx - s.x) / dt;
      s.vy = (ny - s.y) / dt;
      s.x = nx;
      s.y = ny;
      s.t = now;
      apply(el, s);
    };
    const up = (e: PointerEvent) => {
      if (!active || e.pointerId !== active.id) return;
      const { el, started } = active;
      active = null;
      if (!started) return; // plain click: let the link open
      const s = st.get(el);
      if (!s) return;
      s.drag = false;
      s.t = performance.now();
      // swallow the click that follows a drag
      el.addEventListener("click", (ev) => ev.preventDefault(), {
        once: true,
        capture: true,
      });
      if (reduce) {
        s.x = s.y = 0;
        st.delete(el);
        apply(el, s);
        return;
      }
      kick();
    };
    window.addEventListener("pointermove", near, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    ul.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", near);
      document.documentElement.removeEventListener("pointerleave", leave);
      ul.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
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
  [49.3, 140],
  [53.0, 122],
  [56.9, 109],
  [60.8, 103],
  [64.8, 104],
  [68.6, 117],
  [72.4, 132],
  [76.2, 148],
  [79.9, 169],
  [83.4, 196],
];

/**
 * Eleven certificate links on a loose arc above the portrait.
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
          <span>
            <Words text="11 certificates" />
          </span>
        </span>
      ) : (
        <button
          type="button"
          className="wk-orbit-label"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
        >
          <span>
            <Words text="11 certificates" />
          </span>
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
              className={`wk-cert ${i >= 8 ? "wk-cert-end" : ""}`}
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
