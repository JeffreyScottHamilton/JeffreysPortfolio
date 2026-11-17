import type { CSSProperties } from "react";

/**
 * Position plus a slow, per-symbol drift loop for a `.wk-float` (styles/work.css
 * animates `translate`/`rotate` from these vars). Deterministic from the index,
 * so the hero and its end-of-page reprise drift in lockstep.
 */
export function floatStyle(x: number, y: number, i: number): CSSProperties {
  const h = (k: number) => ((i * 7919 + k * 104729) % 1000) / 1000;
  return {
    left: `${x}%`,
    top: `${y}%`,
    ["--fx" as string]: `${(h(1) * 2 - 1) * 16}px`,
    ["--fy" as string]: `${(h(2) * 2 - 1) * 20}px`,
    ["--fr" as string]: `${(h(3) * 2 - 1) * 14}deg`,
    ["--fd" as string]: `${7 + h(4) * 6}s`,
    animationDelay: `${-h(5) * 10}s`,
  };
}
