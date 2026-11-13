"use client";
/**
 * Halftone / cutout portrait. Props API is the shared contract (docs/CONTRACT.md).
 * All drawing lives in lib/portrait-engine.ts; this component only wires it up.
 * SSR markup is deterministic: a cutout <img> fallback + an empty canvas.
 */
import { useEffect, useRef } from "react";
import { portrait } from "@/content/media";
import { GLYPHS, INTRO, usePortfolio } from "@/components/shared/context";
import { CUTOUT_SRC } from "@/lib/halftone";
import { PortraitEngine } from "@/lib/portrait-engine";

export type PortraitProps = {
  tone: "dark" | "light";
  variant?: "halftone" | "cutout";
  framing?: "bust" | "face";
  interactive?: boolean;
  assemble?: boolean;
  decorative?: boolean;
  className?: string;
};

export default function Portrait({
  tone,
  variant = "halftone",
  framing = "bust",
  interactive,
  assemble = false,
  decorative = false,
  className = "",
}: PortraitProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PortraitEngine | null>(null);
  const { introPlaying, introStart, reducedMotion } = usePortfolio();
  const live = variant === "halftone" && !decorative && (interactive ?? true);

  // intro timing is read through a ref so it never rebuilds the engine
  const introRef = useRef({ introPlaying, introStart, assemble });
  useEffect(() => {
    introRef.current = { introPlaying, introStart, assemble };
  });

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    root.dataset.js = "1";
    let engine: PortraitEngine;
    try {
      engine = new PortraitEngine(root, canvas, {
        variant,
        tone,
        framing,
        interactive: live,
        reducedMotion,
        glyphs: GLYPHS,
      });
    } catch {
      root.dataset.fallback = "1";
      return;
    }
    engineRef.current = engine;
    const i = introRef.current;
    engine.setAssemble(
      i.assemble && i.introPlaying ? (i.introStart ?? performance.now()) + INTRO.portrait : null,
    );
    engine.start().catch(() => {
      root.dataset.fallback = "1";
    });
    return () => {
      engine.destroy();
      engineRef.current = null;
      delete root.dataset.ready;
    };
  }, [variant, tone, framing, live, reducedMotion]);

  // skipping / finishing the intro snaps the dots into place
  useEffect(() => {
    if (!introPlaying) engineRef.current?.setAssemble(null);
  }, [introPlaying]);

  return (
    <div
      ref={rootRef}
      className={`portrait portrait-${variant} portrait-${tone} portrait-${framing}${live ? " portrait-live" : ""} ${className}`}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : portrait.alt}
      aria-hidden={decorative || undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="portrait__img" src={CUTOUT_SRC} alt="" draggable={false} />
      <canvas ref={canvasRef} className="portrait__canvas" aria-hidden="true" />
    </div>
  );
}
