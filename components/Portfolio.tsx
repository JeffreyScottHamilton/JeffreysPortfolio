"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Header from "./shared/Header";
import ModeSweep from "./shared/ModeSweep";
import { INTRO, PortfolioContext, type Mode } from "./shared/context";
import WorkMode from "./work/WorkMode";
import ExploreMode from "./explore/ExploreMode";

const MODE_KEY = "jh-mode";
const INTRO_KEY = "jh-intro-seen";

/**
 * Shell: shared header, mode state (persisted for the visit), the one-time
 * intro, and the Work/Explore particle sweep with context mapping.
 * Each mode renders sections tagged data-map="hero" | "middle" | "contact".
 */
export default function Portfolio() {
  const [mode, setMode] = useState<Mode>("work");
  const [hydrated, setHydrated] = useState(false);
  const [introPlaying, setIntroPlaying] = useState(false);
  const [introStart, setIntroStart] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [sweep, setSweep] = useState({ run: 0, toLight: false });
  const pending = useRef<{ mode: Mode; map: string; ratio: number } | null>(
    null,
  );
  const introTimer = useRef<number[]>([]);
  const root = useRef<HTMLDivElement>(null);

  // Hydrate: restore mode, decide on intro, watch reduced motion.
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    let saved: string | null = null,
      seen = false;
    try {
      saved = sessionStorage.getItem(MODE_KEY);
      seen = sessionStorage.getItem(INTRO_KEY) === "1";
    } catch {}
    if (saved === "explore" || saved === "work") setMode(saved);
    if (!seen && !mq.matches) {
      const start = performance.now();
      setIntroStart(start);
      setIntroPlaying(true);
      try {
        sessionStorage.setItem(INTRO_KEY, "1");
      } catch {}
    }
    setHydrated(true);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Intro stage clock → data-intro-stage on the root (CSS does the rest).
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (!introPlaying) {
      el.dataset.introStage = "done";
      return;
    }
    const stages: [keyof typeof INTRO, number][] = [
      ["field", INTRO.field],
      ["title", INTRO.title],
      ["portrait", INTRO.portrait],
      ["support", INTRO.support],
    ];
    el.dataset.introStage = "field";
    introTimer.current = stages.map(([name, t]) =>
      window.setTimeout(() => (el.dataset.introStage = name), t),
    );
    introTimer.current.push(
      window.setTimeout(() => setIntroPlaying(false), INTRO.done),
    );
    return () => introTimer.current.forEach(clearTimeout);
  }, [introPlaying]);

  const skipIntro = useCallback(() => {
    introTimer.current.forEach(clearTimeout);
    setIntroPlaying(false);
  }, []);

  useEffect(() => {
    // Only persist after the saved mode has been restored, or the initial
    // "work" render would overwrite it.
    if (!hydrated) return;
    try {
      sessionStorage.setItem(MODE_KEY, mode);
    } catch {}
    document.documentElement.dataset.mode = mode;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", mode === "work" ? "#050505" : "#f7f2e9");
  }, [mode, hydrated]);

  /** Which mapped section is in view, and how far through it we are. */
  const currentContext = () => {
    const mid = innerHeight * 0.4;
    const sections = [
      ...document.querySelectorAll<HTMLElement>("main [data-map]"),
    ];
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid)
        return {
          map: s.dataset.map ?? "hero",
          ratio: Math.min(1, Math.max(0, (mid - r.top) / r.height)),
        };
    }
    return { map: "hero", ratio: 0 };
  };

  const changeMode = (next: Mode) => {
    if (next === mode || pending.current) return;
    if (introPlaying) skipIntro();
    const ctx = currentContext();
    pending.current = { mode: next, ...ctx };
    if (reducedMotion) {
      applySwap();
      pending.current = null;
      return;
    }
    setSweep((s) => ({ run: s.run + 1, toLight: next === "explore" }));
  };

  const applySwap = () => {
    const p = pending.current;
    if (!p) return;
    setMode(p.mode);
    // After React commits the new mode, restore equivalent context.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        const target =
          document.querySelector<HTMLElement>(`main [data-map="${p.map}"]`) ??
          document.getElementById("top");
        if (!target) return;
        const y =
          p.map === "hero"
            ? 0
            : target.getBoundingClientRect().top +
              scrollY +
              (p.map === "middle" ? p.ratio * target.offsetHeight * 0.5 : 0);
        window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
      }),
    );
  };

  const home = () => {
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    document.getElementById("hero-title")?.focus({ preventScroll: true });
  };

  return (
    <PortfolioContext.Provider
      value={{ mode, introPlaying, introStart, reducedMotion, hydrated }}
    >
      <div
        ref={root}
        className={`portfolio mode-${mode}`}
        data-intro-stage={introPlaying ? "field" : "done"}
      >
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header
          mode={mode}
          onMode={changeMode}
          onHome={home}
          disabled={!hydrated}
        />
        {introPlaying && (
          <button type="button" className="skip-intro" onClick={skipIntro}>
            Skip intro
          </button>
        )}
        <main id="main" key={mode}>
          {mode === "work" ? <WorkMode /> : <ExploreMode />}
        </main>
        <ModeSweep
          run={sweep.run}
          toLight={sweep.toLight}
          onMidpoint={applySwap}
          onDone={() => {
            pending.current = null;
          }}
        />
      </div>
    </PortfolioContext.Provider>
  );
}
