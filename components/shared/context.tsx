"use client";
import { createContext, useContext } from "react";

export type Mode = "work" | "explore";

/**
 * Shared, low-frequency portfolio state. Never put per-frame values here:
 * pointer/scroll values belong in refs or the animation library.
 */
export type PortfolioState = {
  mode: Mode;
  /** true while the ~2.3 s first-visit intro is running */
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

/**
 * First-visit intro cue times in ms. Beats: a red seed dot pulses in, the
 * title bursts out of it (the seed becomes the accent rule), portrait assembles (Portrait starts at introStart +
 * portrait), the supporting copy forms from dots, done.
 */
export const INTRO = {
  field: 0,
  title: 420,
  portrait: 860,
  support: 1050,
  done: 2350,
} as const;

/** Shortened intro clock replayed for the new mode's opening after a switch,
 * measured from the moment the sweep dots start clearing. */
export const SWITCH_INTRO = {
  title: 60,
  portrait: 160,
  support: 280,
  done: 960,
} as const;

/** Mode switch duration in ms: dots grow to cover, content swaps, dots clear. */
export const SWEEP_MS = 1100;
/** Point at which the sweep fully covers the viewport and the swap happens. */
export const SWEEP_COVER_MS = 450;

/** Random glyph pool for particle material — not restricted to the name. */
export const GLYPHS = "AqKz74%#?jmHaeftr0x3+:sWk8&b";
