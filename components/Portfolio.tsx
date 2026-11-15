"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Header from "./shared/Header";
import ModeSweep from "./shared/ModeSweep";
import {
  INTRO,
  PortfolioContext,
  SWEEP_COVER_MS,
  SWITCH_INTRO,
  type Mode,
} from "./shared/context";
import { IntroDots } from "./shared/introDots";
import WorkMode from "./work/WorkMode";
import ExploreMode from "./explore/ExploreMode";

const MODE_KEY = "jh-mode";
const INTRO_KEY = "jh-intro-seen";

/** Drifting dots for the intro's opening beat: [left %, top %, size px, delay s]. */
const FIELD_DOTS: [number, number, number, number][] = [
  [12, 22, 3, 0], [27, 64, 2, 0.1], [38, 31, 4, 0.05], [46, 78, 2, 0.2],
  [55, 18, 3, 0.15], [63, 52, 5, 0], [71, 36, 2, 0.12], [80, 70, 3, 0.04],
  [88, 26, 2, 0.18], [21, 86, 3, 0.08], [50, 46, 2, 0.22], [7, 54, 2, 0.14],
  [33, 12, 2, 0.02], [92, 58, 3, 0.1],
];

/**
 * Shell: shared header, mode state (persisted for the visit), the one-time
 * intro, and the Work/Explore halftone dissolve. A mode switch always lands
 * at the top of the new mode and replays a short version of the intro there.
 */
export default function Portfolio() {
  const [mode, setMode] = useState<Mode>("work");
  const [hydrated, setHydrated] = useState(false);
  const [introPlaying, setIntroPlaying] = useState(false);
  const [introStart, setIntroStart] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [sweep, setSweep] = useState({ run: 0, toLight: false });
  const pending = useRef<Mode | null>(null);
  const introTimer = useRef<number[]>([]);
  const switchTimer = useRef<number[]>([]);
  /** set when a swap is committed; the next mode effect scrolls to the top */
  const swapped = useRef<"intro" | "plain" | null>(null);
  const root = useRef<HTMLDivElement>(null);
  /** text ⇄ dots of the mode switch (outgoing dissolve, then the new opening) */
  const switchDots = useRef<IntroDots | null>(null);

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
    // the drifting field dots stream into the title, then the support copy
    const dots = new IntroDots();
    const main = el.querySelector<HTMLElement>("main");
    if (main)
      dots.form(
        main,
        {
          title: { at: INTRO.title, dur: 1150 },
          support: { at: INTRO.support, dur: INTRO.done - INTRO.support - 60 },
        },
        () => ({
          points: () =>
            [...el.querySelectorAll<HTMLElement>(".intro-field span")].map((d) => {
              const r = d.getBoundingClientRect();
              return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            }),
          jitter: 3,
        }),
      );
    introTimer.current.push(
      window.setTimeout(() => {
        // keep keyboard focus from falling to <body> when the skip button unmounts
        if (document.activeElement?.classList.contains("skip-intro"))
          document.getElementById("hero-title")?.focus({ preventScroll: true });
        setIntroPlaying(false);
      }, INTRO.done),
    );
    return () => {
      introTimer.current.forEach(clearTimeout);
      dots.cancel();
    };
  }, [introPlaying]);

  // Infinite loop: each mode ends with a reprise whose final frame is
  // pixel-identical to the opening at scrollY = 0 (marked data-loop-end).
  // Reaching the very bottom jumps to the top instantly, so the page reads
  // as one continuous loop. Disabled during the mode sweep.
  useEffect(() => {
    if (!hydrated) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      if (pending.current) return;
      const max = document.documentElement.scrollHeight - innerHeight;
      const end = document.querySelector<HTMLElement>("main [data-loop-end]");
      if (!end || max < innerHeight || scrollY < max - 1) return;
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      ScrollTrigger.update();
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [hydrated, mode]);

  const skipIntro = useCallback((moveFocus = true) => {
    introTimer.current.forEach(clearTimeout);
    setIntroPlaying(false);
    if (moveFocus)
      document.getElementById("hero-title")?.focus({ preventScroll: true });
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

  const changeMode = (next: Mode) => {
    if (next === mode || pending.current) return;
    if (introPlaying) skipIntro(false);
    pending.current = next;
    if (reducedMotion) {
      applySwap();
      pending.current = null;
      return;
    }
    // the page tone eases toward the new background under the dots, and
    // the text on screen dissolves into dots as the cover forms
    root.current?.setAttribute("data-switching", next);
    switchDots.current?.cancel();
    const main = root.current?.querySelector<HTMLElement>("main");
    if (main) {
      switchDots.current = new IntroDots();
      switchDots.current.dissolve(main, SWEEP_COVER_MS);
    }
    setSweep((s) => ({ run: s.run + 1, toLight: next === "explore" }));
  };

  /** Called at full cover: swap content and arm the top-of-page replay. */
  const applySwap = () => {
    const next = pending.current;
    const el = root.current;
    if (!next) return;
    switchTimer.current.forEach(clearTimeout);
    // (full cover: the old page goes away under it)
    switchDots.current?.cancel();
    switchDots.current = null;
    if (el && !reducedMotion) {
      // new content mounts already scattered/hidden; beats start on reveal
      el.dataset.introKind = "switch";
      el.dataset.introStage = "field";
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    swapped.current = reducedMotion ? "plain" : "intro";
    setMode(next);
  };

  // After a swap commits: make sure we are at the top of the new mode.
  useEffect(() => {
    const kind = swapped.current;
    const el = root.current;
    if (!kind || !el) return;
    swapped.current = null;
    el.removeAttribute("data-switching");
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    });
  }, [mode]);

  /** Short replay of the intro beats once the dots start clearing. */
  const runSwitchIntro = () => {
    const el = root.current;
    if (!el || el.dataset.introKind !== "switch") return;
    switchTimer.current.forEach(clearTimeout);
    const stages: [string, number][] = [
      ["title", SWITCH_INTRO.title],
      ["portrait", SWITCH_INTRO.portrait],
      ["support", SWITCH_INTRO.support],
    ];
    switchTimer.current = stages.map(([name, t]) =>
      window.setTimeout(() => (el.dataset.introStage = name), t),
    );
    // the new opening's text forms from dots as the cover clears
    switchDots.current?.cancel();
    const main = el.querySelector<HTMLElement>("main");
    if (main) {
      switchDots.current = new IntroDots();
      switchDots.current.form(
        main,
        {
          title: { at: SWITCH_INTRO.title, dur: 700 },
          support: { at: SWITCH_INTRO.support, dur: SWITCH_INTRO.done - SWITCH_INTRO.support - 30 },
        },
        () => ({ scatter: 170 }),
      );
    }
    switchTimer.current.push(
      window.setTimeout(() => {
        el.dataset.introStage = "done";
        delete el.dataset.introKind;
        switchDots.current?.cancel();
        switchDots.current = null;
      }, SWITCH_INTRO.done),
    );
  };

  useEffect(
    () => () => {
      switchTimer.current.forEach(clearTimeout);
      switchDots.current?.cancel();
    },
    [],
  );

  return (
    <PortfolioContext.Provider
      value={{ mode, introPlaying, introStart, reducedMotion, hydrated }}
    >
      <div
        ref={root}
        className={`portfolio mode-${mode}${hydrated ? " hydrated" : ""}`}
        data-intro-stage={introPlaying ? "field" : "done"}
      >
        {introPlaying && (
          <div className="intro-field" aria-hidden="true">
            {FIELD_DOTS.map(([x, y, size, d], i) => (
              <span
                key={i}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: size,
                  height: size,
                  animationDelay: `${d}s`,
                }}
              />
            ))}
          </div>
        )}
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header
          mode={mode}
          onMode={changeMode}
          disabled={!hydrated}
        />
        {introPlaying && (
          <button
            type="button"
            className="skip-intro"
            onClick={() => skipIntro()}
          >
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
          onReveal={runSwitchIntro}
          onDone={() => {
            pending.current = null;
          }}
        />
      </div>
    </PortfolioContext.Provider>
  );
}
