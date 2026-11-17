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
 * First-visit intro cue times in ms ("compile"). Beats: a red caret types
 * `new Developer("…")` where the name will be (field); on the semicolon the
 * code breaks into dots that form the title while the caret glides down to
 * become the accent rule (title); the portrait assembles and the floating
 * code symbols spray out of the line (portrait: Portrait starts at
 * introStart + portrait); the supporting copy forms from dots; done.
 */
export const INTRO = {
  field: 0,
  /** typing runs from TYPE_AT until shortly before the title cue */
  title: 1150,
  portrait: 1500,
  support: 1700,
  done: 2900,
} as const;

/** The line the intro types; its dots become the title. */
export const INTRO_CODE: [string, "kw" | "type" | "p" | "str"][] = [
  ["new ", "kw"],
  ["Developer", "type"],
  ["(", "p"],
  ['"Jeffrey Hamilton"', "str"],
  [");", "p"],
];
/** When typing starts / ms per character (≈ the line is done by ~950 ms). */
export const TYPE_AT = 160;
export const TYPE_MS = 22;

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

/** Random glyph pool for particle material: code symbols (one UTF-16 unit each). */
export const GLYPHS = "{}<>/;=()[]#$&*+|!?:~%01_\\";
