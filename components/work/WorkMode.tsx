"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { usePortfolio } from "@/components/shared/context";
import HeroScene from "./HeroScene";
import Projects from "./Projects";
import Contact from "./Contact";
import { HalftoneMorph, snapProgress, TEXT1 } from "./HalftoneMorph";
import { faceRegion, norm } from "./absorb";
import { DotMorph, play } from "@/components/shared/dotText";
import { inertia } from "@/components/shared/inertia";
import { Finale } from "./Finale";

/** share of the hero pin that holds before anything turns into dots */
const HOLD = 0.1;
/** near the board end, letting go finishes the move */
const EDGE = 0.08;
/** hero pin length in viewport heights (the morph itself gets 2.8, scrubbed by the scroll) */
const PIN_VH = 2.8 / (1 - HOLD);

/** Hero text that dissolves into dots and flies into the Plainkit card when the set piece starts. */
const HERO_TEXT = [
  ".wk-title",
  ".wk-sub",
  ":scope > .wk-hero-copy > .wk-rule",
  ".wk-statement",
  ".wk-kinds",
  ".wk-selected > span",
  ".wk-orbit-label",
  ".wk-experience ul",
  ".wk-hero-field .wk-float",
].join(", ");
/** Hero icons that dissolve into dots streaming into the face. */
const HERO_ICONS = [".wk-selected > svg", ".wk-cert-btn"].join(", ");
/** progress window (of the hero pin) of the icons' dissolve */
const ICONS_END = 0.08;
/** Contact text that forms from the contact portrait's dots as it arrives. */
const CONTACT_TEXT = ".wk-contact-title, .wk-contact-copy > .wk-rule, .wk-contact-place";

/**
 * Work mode: one pinned stage (hero + certificate orbit → set piece → project
 * board built in place) → contact, pinned, which re-forms into the opening in
 * place (the loop end).
 */
export default function WorkMode() {
  const root = useRef<HTMLDivElement>(null);
  const { reducedMotion, hydrated, introPlaying } = usePortfolio();

  // Contact arrival: its text forms from the contact portrait's dots — scrubbed
  // with scroll (reversible) on wider screens; on phones a timed morph once
  // the section is in view, so short, fast swipes don't leave it half-formed.
  useEffect(() => {
    const el = root.current;
    const contact = el?.querySelector<HTMLElement>(".wk-contact");
    const portrait = contact?.querySelector<HTMLElement>(".wk-contact-portrait .portrait");
    if (!el || !contact || !portrait || !hydrated || reducedMotion) return;
    gsap.registerPlugin(ScrollTrigger);
    const form = new DotMorph({
      from: { region: () => faceRegion(portrait) },
      to: { text: [...contact.querySelectorAll<HTMLElement>(CONTACT_TEXT)] },
      anchor: contact,
      salt: 21,
    });
    const mm = gsap.matchMedia();
    mm.add("(min-width: 721px)", () => {
      const v = inertia((p) => form.update(p), { snap: 1 });
      const st = ScrollTrigger.create({
        trigger: contact,
        start: "top 80%",
        end: "top 12%",
        invalidateOnRefresh: true,
        onUpdate: (s) => v.follow(s.progress),
        onLeave: () => v.follow(1),
        onLeaveBack: () => v.follow(0),
        onRefresh: (s) => {
          v.jump(s.progress);
          form.measure().then(() => form.update(v.value));
        },
      });
      v.jump(st.progress);
      form.measure().then(() => form.update(v.value));
      return () => {
        v.stop();
        st.kill();
      };
    });
    mm.add("(max-width: 720px)", () => {
      let stop: (() => void) | null = null;
      let formed = false;
      form.update(0);
      form.measure().then(() => form.update(formed ? 1 : 0));
      const io = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) {
            if (formed) return;
            formed = true;
            stop = play(1100, (p) => form.update(p));
          } else if (e.boundingClientRect.top > 0 && formed) {
            // left below (scrolled back up): reset so it forms again next time
            stop?.();
            stop = null;
            formed = false;
            form.update(0);
          }
        },
        { threshold: 0.35 },
      );
      io.observe(contact);
      return () => {
        io.disconnect();
        stop?.();
      };
    });
    return () => {
      mm.revert();
      form.destroy();
    };
  }, [hydrated, reducedMotion]);

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
    // the shared deceleration; the shell's loop jump (at max scroll) waits
    // until the glide has really reached the end frame (data-loop-hold)
    const end = inner.querySelector<HTMLElement>("[data-loop-end]");
    const v = inertia((q) => {
      finale.update(q);
      if (q < 1) end?.setAttribute("data-loop-hold", "");
      else end?.removeAttribute("data-loop-hold");
    });
    const pin = ScrollTrigger.create({
      trigger: inner,
      start: "bottom bottom",
      end: () => `+=${Math.round(innerHeight * 0.45)}`,
      pin: true,
      pinSpacing: true,
      invalidateOnRefresh: true,
      onUpdate: (s) => v.follow(s.progress),
      onRefresh: (s) => {
        finale.measure();
        v.jump(s.progress);
      },
    });
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
    finale.measure();
    v.jump(pin.progress);
    return () => {
      v.stop();
      end?.removeAttribute("data-loop-hold");
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

  // Set piece: the hero copy's dots fly into a halftone of Plainkit while the
  // portrait's dot grid stays put and resizes into Bedulo; the real pictures
  // resolve, the pair glides into the board and the other ten rows pop in
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
        copy: () => copyEls,
        // Plainkit's ink dots are known: re-aim the copy's dots at them
        onBuilt: () => void text.measure().then(() => text.update(norm(last, 0, AB))),
      });
      // the copy dissolves into dots that fly into the Plainkit card (while
      // the face becomes Bedulo); the certificates are pulled into the face
      const AB = TEXT1;
      const copyEls = [...hero.querySelectorAll<HTMLElement>(HERO_TEXT)];
      const text = new DotMorph({
        from: { text: copyEls },
        to: { points: () => morph.cardPoints(), jitter: 1 },
        anchor: stage,
        salt: 1,
      });
      let last = 0;
      const icons = new DotMorph({
        from: { text: [...hero.querySelectorAll<HTMLElement>(HERO_ICONS)] },
        to: { region: () => faceRegion(portrait) },
        anchor: stage,
        salt: 2,
      });
      const orbitLine = hero.querySelector<SVGElement>(".wk-orbit-line");
      const band = hero.querySelector<HTMLElement>(":scope > .wk-experience");
      const sync = (raw: number) => {
        // the first HOLD of the pin keeps the hero exactly as it is
        const p = snapProgress(norm(raw, HOLD, 1));
        last = p;
        morph.update(p);
        icons.update(norm(p, 0, ICONS_END));
        text.update(norm(p, 0, AB));
        if (p <= 0) {
          orbitLine?.style.removeProperty("opacity");
          band?.style.removeProperty("--band");
        } else {
          orbitLine?.style.setProperty("opacity", (1 - norm(p, 0, 0.05)).toFixed(3));
          band?.style.setProperty("--band", (1 - norm(p, 0.02, 0.08)).toFixed(3));
        }
      };
      // the morph follows the scroll with inertia (the shared deceleration,
      // components/shared/inertia.ts); big jumps (the loop's jump to the
      // top, a keyboard jump to the board) snap.
      const v = inertia(sync);
      const pin = ScrollTrigger.create({
        trigger: stage,
        start: "top top",
        end: () => `+=${Math.round(innerHeight * PIN_VH)}`,
        pin: true,
        // scroll snap: a nudge inside the hold springs back to the hero; past
        // it, letting go finishes the move in the direction scrolled (hero ⇄
        // board), so the page never rests half-way through the morph
        snap: {
          // only the ends snap: the morph itself is scrubbed by the reader
          snapTo: (v: number) => (v < HOLD ? 0 : v > 1 - EDGE ? 1 : v),
          duration: { min: 0.4, max: 0.9 },
          delay: 0.12,
          ease: "power2.inOut",
        },
        pinSpacing: true,
        refreshPriority: 2,
        invalidateOnRefresh: true,
        onUpdate: (s) => v.follow(s.progress),
        onRefresh: (s) => {
          // tell the shell where the finished board sits (mode-switch mapping)
          el.querySelector<HTMLElement>("#projects")?.setAttribute(
            "data-map-scroll",
            String(Math.round(s.end)),
          );
          morph.measure();
          icons.measure().then(() => icons.update(norm(last, 0, ICONS_END)));
          text.measure().then(() => text.update(norm(last, 0, AB)));
          v.jump(s.progress);
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
      icons.measure().then(() => icons.update(norm(last, 0, ICONS_END)));
      text.measure().then(() => text.update(norm(last, 0, AB)));
      v.jump(pin.progress);
      return () => {
        v.stop();
        text.destroy();
        board.removeEventListener("focusin", onFocus);
        pin.kill();
        morph.destroy();
        icons.destroy();
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
