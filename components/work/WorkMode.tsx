"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { usePortfolio } from "@/components/shared/context";
import HeroScene from "./HeroScene";
import Projects from "./Projects";
import Contact from "./Contact";
import { HalftoneMorph, snapProgress } from "./HalftoneMorph";
import { Absorb, headOf, norm } from "./absorb";
import { Finale } from "./Finale";

/** Hero pieces that are absorbed into the face when the set piece starts. */
const HERO_PIECES = [
  ".wk-title .gather-ch",
  ".wk-sub .wk-w",
  ":scope > .wk-hero-copy > .wk-rule",
  ".wk-statement .wk-w",
  ".wk-kinds .wk-w",
  ".wk-selected .wk-w",
  ".wk-selected > svg",
  ".wk-orbit-label .wk-w",
  ".wk-cert",
  ".wk-experience .wk-w",
  ".wk-slash",
  ".wk-sep-dot",
  ".wk-hero-field .wk-float",
].join(", ");

/**
 * Work mode: one pinned stage (hero + certificate orbit → set piece → project
 * board built in place) → contact, pinned, which re-forms into the opening in
 * place (the loop end).
 */
export default function WorkMode() {
  const root = useRef<HTMLDivElement>(null);
  const { reducedMotion, hydrated, introPlaying } = usePortfolio();

  // Contact → opening, in place: pin the contact and rearrange it into the
  // hero frame; the pin ends at the document bottom (data-loop-end).
  useEffect(() => {
    const el = root.current;
    const fin = el?.querySelector<HTMLElement>(".wk-finale");
    const inner = fin?.querySelector<HTMLElement>(":scope > .wk-finale-in");
    if (!el || !fin || !inner || !hydrated || reducedMotion) return;
    gsap.registerPlugin(ScrollTrigger);
    fin.classList.add("is-live");
    const finale = new Finale(inner);
    const pin = ScrollTrigger.create({
      trigger: inner,
      start: "bottom bottom",
      end: () => `+=${Math.round(innerHeight * 0.7)}`,
      pin: true,
      pinSpacing: true,
      invalidateOnRefresh: true,
      onUpdate: (s) => finale.update(s.progress),
      onRefresh: (s) => {
        finale.measure();
        finale.update(s.progress);
      },
    });
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
    finale.measure();
    finale.update(pin.progress);
    return () => {
      pin.kill();
      finale.destroy();
      fin.classList.remove("is-live");
    };
  }, [hydrated, reducedMotion]);

  // The loop end must be pixel-identical to scrollY 0, and scroll positions
  // are integers: keep the finale on whole pixels (a sub-pixel pad above it,
  // and one under the contact so the reprise below / over it is too).
  useEffect(() => {
    const el = root.current;
    const fin = el?.querySelector<HTMLElement>(".wk-finale");
    const contact = fin?.querySelector<HTMLElement>(".wk-contact");
    if (!el || !fin || !contact || !hydrated) return;
    let raf = 0;
    const frac = (v: number) => Math.ceil(v - 0.001) - v;
    const fix = () => {
      raf = 0;
      const st = fin.style;
      const top0 = parseFloat(st.getPropertyValue("--fin-top")) || 0;
      const bot0 = parseFloat(st.getPropertyValue("--fin-bot")) || 0;
      const top = frac(fin.getBoundingClientRect().top + scrollY);
      const bot = frac(contact.getBoundingClientRect().height);
      if (Math.abs(top - top0) <= 0.002 && Math.abs(bot - bot0) <= 0.002) return;
      st.setProperty("--fin-top", `${top.toFixed(3)}px`);
      st.setProperty("--fin-bot", `${bot.toFixed(3)}px`);
      if (fin.classList.contains("is-live")) ScrollTrigger.refresh();
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(fix);
    };
    const ro = new ResizeObserver(queue);
    ro.observe(el);
    ro.observe(contact);
    ScrollTrigger.addEventListener("refresh", queue);
    queue();
    return () => {
      ro.disconnect();
      ScrollTrigger.removeEventListener("refresh", queue);
      cancelAnimationFrame(raf);
      fin.style.removeProperty("--fin-top");
      fin.style.removeProperty("--fin-bot");
    };
  }, [hydrated]);

  // Set piece: the portrait's dot grid stays put and every dot resizes until
  // the face has become halftones of Plainkit and Bedulo; the real pictures
  // resolve, the pair glides into the board and the other nine rows pop in
  // (one pin, scrubbed, reversible).
  useEffect(() => {
    const el = root.current;
    if (!el || !hydrated || reducedMotion || introPlaying) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1025px)", () => {
      const stage = el.querySelector<HTMLElement>(".wk-stage");
      const hero = stage?.querySelector<HTMLElement>(":scope > .wk-hero");
      const portraitWrap = hero?.querySelector<HTMLElement>(
        ":scope > .wk-hero-portrait",
      );
      const portrait = portraitWrap?.querySelector<HTMLElement>(".portrait");
      const board = stage?.querySelector<HTMLElement>(":scope > .wk-board");
      if (!stage || !hero || !portraitWrap || !portrait || !board) return;
      stage.classList.add("is-live");
      const morph = new HalftoneMorph({
        stage,
        portraitWrap,
        portrait,
        ribbons: [
          ...hero.querySelectorAll<SVGSVGElement>(".wk-hero-field svg.ribbon"),
        ],
        board,
      });
      // copy, certificates and experience are pulled into the face's dots
      const absorb = new Absorb(
        [...hero.querySelectorAll<HTMLElement>(HERO_PIECES)],
        () => headOf(portrait),
        { from: 0, to: 0.15, dur: 0.085, salt: 1 },
      );
      const orbitLine = hero.querySelector<SVGElement>(".wk-orbit-line");
      const band = hero.querySelector<HTMLElement>(":scope > .wk-experience");
      const sync = (raw: number) => {
        const p = snapProgress(raw);
        morph.update(p);
        absorb.update(p);
        if (p <= 0) {
          orbitLine?.style.removeProperty("opacity");
          band?.style.removeProperty("--band");
        } else {
          orbitLine?.style.setProperty("opacity", (1 - norm(p, 0, 0.08)).toFixed(3));
          band?.style.setProperty("--band", (1 - norm(p, 0.02, 0.12)).toFixed(3));
        }
      };
      const pin = ScrollTrigger.create({
        trigger: stage,
        start: "top top",
        end: () => `+=${Math.round(innerHeight * 2.6)}`,
        pin: true,
        pinSpacing: true,
        refreshPriority: 2,
        invalidateOnRefresh: true,
        onUpdate: (s) => sync(s.progress),
        onRefresh: (s) => {
          // tell the shell where the finished board sits (mode-switch mapping)
          el.querySelector<HTMLElement>("#projects")?.setAttribute(
            "data-map-scroll",
            String(Math.round(s.end)),
          );
          morph.measure();
          absorb.measure();
          sync(s.progress);
        },
      });
      // keyboard: focusing a project before the board is built jumps to it
      const onFocus = () => {
        if (pin.progress < 1)
          window.scrollTo({
            top: pin.end,
            behavior: "instant" as ScrollBehavior,
          });
      };
      board.addEventListener("focusin", onFocus);
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
      morph.measure();
      absorb.measure();
      sync(pin.progress);
      return () => {
        board.removeEventListener("focusin", onFocus);
        pin.kill();
        morph.destroy();
        absorb.destroy();
        orbitLine?.style.removeProperty("opacity");
        band?.style.removeProperty("--band");
        stage.classList.remove("is-live");
      };
    });
    return () => mm.revert();
  }, [hydrated, reducedMotion, introPlaying]);

  return (
    <div className="wk" ref={root}>
      <div className="wk-stage">
        <section
          id="top"
          data-map="hero"
          className="wk-hero"
          aria-label="Introduction"
        >
          <HeroScene />
        </section>
        <Projects />
      </div>
      <div className="wk-finale">
        <div className="wk-finale-in">
          <Contact />
          <div className="wk-reprise" aria-hidden="true" inert data-loop-end>
            <div className="wk-hero wk-hero-reprise">
              <HeroScene reprise />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
