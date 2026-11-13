"use client";
import { createContext, useContext } from "react";

export type Mode = "work" | "explore";

/**
 * Shared, low-frequency portfolio state. Never put per-frame values here:
 * pointer/scroll values belong in refs or the animation library.
 */
export type PortfolioState = {
  mode: Mode;
  /** true while the ~1.85 s first-visit intro is running */
  introPlaying: boolean;
  /** ms timestamp (performance.now()) when the intro started, or null if skipped/not played */
  introStart: number | null;
  /** prefers-reduced-motion */
  reducedMotion: boolean;
  /** true after hydration; use to gate client-only rendering */
  hydrated: boolean;
};

export const PortfolioContext = createContext<PortfolioState>({
  mode: "work",
  introPlaying: false,
  introStart: null,
  reducedMotion: false,
  hydrated: false,
});

export const usePortfolio = () => useContext(PortfolioContext);

/** Intro cue times in ms (BUILD-PROMPT §7). */
export const INTRO = {
  field: 0,
  title: 350,
  portrait: 850,
  support: 1350,
  done: 1850,
} as const;

/** Mode sweep duration in ms (BUILD-PROMPT §7). */
export const SWEEP_MS = 700;

/** Random glyph pool for particle material — not restricted to the name. */
export const GLYPHS = "AqKz74%#?jmHaeftr0x3+:sWk8&b";
