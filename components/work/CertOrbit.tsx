"use client";
import { useId, useState, type ReactNode } from "react";
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
