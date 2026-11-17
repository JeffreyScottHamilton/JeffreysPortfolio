"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Header from "./shared/Header";
import ModeSweep from "./shared/ModeSweep";
import {
  INTRO,
  INTRO_CODE,
  TYPE_AT,
  TYPE_MS,
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
    // "Compile": a red caret types `new Developer("…")` where the name will
    // be; on the semicolon the line breaks into dots that form the name, the
    // caret glides down to become the accent rule, and the code symbols that
    // float beside the portrait spray out of the line.
    const main = el.querySelector<HTMLElement>("main");
    const seed = el.querySelector<HTMLElement>(".intro-seed");
    const code = el.querySelector<HTMLElement>(".intro-code");
    const title = main?.querySelector<HTMLElement>('[data-intro="title"]');
    const tr = title?.getBoundingClientRect();
    const c =
      tr && tr.width
        ? { x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 }
        : { x: innerWidth / 2, y: innerHeight / 2 };
    if (code) {
      code.style.left = `${tr && tr.width ? tr.left : 24}px`;
      code.style.top = `${c.y}px`;
    }
    const typed: HTMLSpanElement[] = [];
    if (code)
      for (const [, kind] of INTRO_CODE) {
        const t = document.createElement("span");
        t.className = `ic-${kind}`;
        code.append(t);
        typed.push(t);
      }
    const total = INTRO_CODE.reduce((n, [t]) => n + t.length, 0);
    const caretAt = () => {
      if (!seed || !code) return;
      const r = code.getBoundingClientRect();
      const h = r.height * 0.78;
      Object.assign(seed.style, {
        left: `${r.right + 3}px`,
        top: `${r.top + (r.height - h) / 2}px`,
        width: `${Math.max(3, r.height * 0.09)}px`,
        height: `${h}px`,
      });
    };
    // type the line, character by character (slightly uneven, like a person)
    const typeTo = (n: number) => {
      let left = n;
      INTRO_CODE.forEach(([t], i) => {
        const k = Math.max(0, Math.min(t.length, left));
        typed[i].textContent = t.slice(0, k);
        left -= t.length;
      });
      caretAt();
    };
    typeTo(0);
    seed?.classList.add("is-caret");
    let at = TYPE_AT;
    for (let i = 1; i <= total; i++) {
      at += TYPE_MS * (0.6 + 0.8 * (((i * 37) % 11) / 10));
      if (i === 5 || i === 15) at += 70; // tiny thinking pauses
      introTimer.current.push(
        window.setTimeout(() => typeTo(i), at),
      );
    }
    const typedAt = at;
    if (seed) {
      introTimer.current.push(
        window.setTimeout(() => {
          // the caret stops blinking and glides down into the accent rule
          seed.classList.remove("is-caret");
          const rule = main?.querySelector<HTMLElement>('[data-intro="rule"]');
          const r = rule?.getBoundingClientRect();
          const s0 = seed.getBoundingClientRect();
          if (!r || !r.width) {
            seed.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: "forwards" });
            return;
          }
          seed.animate(
            [
              { left: `${s0.left}px`, top: `${s0.top}px`, width: `${s0.width}px`, height: `${s0.height}px` },
              { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` },
            ],
            { duration: INTRO.portrait - INTRO.title, easing: "cubic-bezier(.6,0,.2,1)", fill: "forwards" },
          );
        }, INTRO.title),
      );
    }
    // the floating code symbols spray out of the line to where they live, as
    // the page tone lifts (the line's rect is taken before it dissolves)
    let cr: DOMRect | undefined;
    introTimer.current.push(
      window.setTimeout(() => (cr = code?.getBoundingClientRect()), INTRO.title - 20),
      window.setTimeout(() => {
        const floats = [...(main?.querySelectorAll<HTMLElement>(".wk-float") ?? [])].filter(
          (f) => f.offsetParent,
        );
        const o = cr && cr.width ? { x: cr.left + cr.width * 0.6, y: cr.top + cr.height / 2 } : c;
        floats.forEach((f, i) => {
          const r = f.getBoundingClientRect();
          const dx = o.x - (r.left + r.width / 2);
          const dy = o.y - (r.top + r.height / 2);
          f.animate(
            [
              { transform: `translate(${dx}px, ${dy}px) scale(0.4)`, opacity: 0 },
              { opacity: 1, offset: 0.25 },
              { transform: "none", opacity: 1 },
            ],
            { duration: 900 + i * 45, easing: "cubic-bezier(.15,.7,.2,1)", fill: "backwards" },
          );
        });
      }, INTRO.portrait - 60),
    );
    const dots = new IntroDots();
    if (main)
      dots.form(
        main,
        {
          // measured once the line is fully typed (it is the dots' source)
          title: { at: INTRO.title, dur: 1000, buildAt: typedAt + 30 },
          support: { at: INTRO.support, dur: INTRO.done - INTRO.support - 60 },
        },
        // the typed line itself breaks into the dots that form the name
        () => (code ? { text: [code], hide: true } : { points: () => [c], jitter: 1.5 }),
        () => {
          // the copy falls out of the name's baseline
          const r = title?.getBoundingClientRect();
          if (!r || !r.width) return { points: () => [c], jitter: 3 };
          return {
            points: () =>
              Array.from({ length: 14 }, (_, i) => ({
                x: r.left + (r.width * (i + 0.5)) / 14,
                y: r.bottom - r.height * 0.15,
              })),
            jitter: 4,
          };
        },
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
  // as one continuous loop (once the reprise has settled: data-loop-hold).
  // Disabled during the mode sweep.
  useEffect(() => {
    if (!hydrated) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      if (pending.current) return;
      const max = document.documentElement.scrollHeight - innerHeight;
      const end = document.querySelector<HTMLElement>("main [data-loop-end]");
      if (!end || max < innerHeight || scrollY < max - 1) return;
      // the reprise is still gliding into its end frame: jump once it lands
      if (end.hasAttribute("data-loop-hold")) {
        raf = requestAnimationFrame(check);
        return;
      }
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
          <>
            <div className="intro-field" aria-hidden="true" />
            <p className="intro-code" aria-hidden="true" />
            <span className="intro-seed" aria-hidden="true" />
          </>
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
