"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { usePortfolio } from "@/components/shared/context";
import HeroScene from "./HeroScene";
import Projects from "./Projects";
import Contact from "./Contact";
import { FaceStream } from "./FaceStream";
import { ReelDots } from "./ReelDots";

const px = (el: HTMLElement, v: string) =>
  parseFloat(el.style.getPropertyValue(v)) || 0;

/**
 * Work mode: hero + certificate orbit → Plainkit/Bedulo pair → preview-strip
 * reel → contact → reprise (contact scatters, opening re-forms on scroll).
 */
export default function WorkMode() {
  const root = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLCanvasElement>(null);
  const { reducedMotion, hydrated, introPlaying } = usePortfolio();

  useEffect(() => {
    const el = root.current;
    if (!el || !hydrated || reducedMotion) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    const cleanups: (() => void)[] = [];
    const ctx = gsap.context(() => {
      // Reel rows slide in from the right; each strip assembles from dots.
      const reels = gsap.utils.toArray<HTMLElement>(".wk-row").map((row) => {
        const rd = new ReelDots(row, innerWidth <= 720 ? 40 : 34);
        ScrollTrigger.create({
          trigger: row,
          start: "top 260%",
          once: true,
          onEnter: () => rd.prepare(),
        });
        const st = ScrollTrigger.create({
          trigger: row,
          start: "top 100%",
          end: "top 62%",
          onUpdate: (s) => rd.render(s.progress),
          onRefresh: (s) => rd.render(s.progress),
        });
        rd.render(st.progress);
        return rd;
      });
      cleanups.push(() => reels.forEach((r) => r.destroy()));

      // Mobile: the opening pair simply slides in from the right.
      mm.add("(max-width: 720px)", () => {
        gsap.utils.toArray<HTMLElement>(".wk-pair-item").forEach((item) => {
          gsap.fromTo(
            item,
            { xPercent: 70, opacity: 0.2 },
            {
              xPercent: 0,
              opacity: 1,
              ease: "none",
              scrollTrigger: {
                trigger: item,
                start: "top 100%",
                end: "top 55%",
                scrub: true,
              },
            },
          );
        });
      });

      const reprise = el.querySelector<HTMLElement>(".wk-reprise");
      if (!reprise) return;

      // Contact letters scatter as the reprise rises into view.
      const out = el.querySelectorAll<HTMLElement>(".wk-contact .gather-ch");
      gsap.to(out, {
        x: (_i: number, t: HTMLElement) => px(t, "--gx") * 2.2,
        y: (_i: number, t: HTMLElement) => px(t, "--gy") * 2.2 - 120,
        rotation: (_i: number, t: HTMLElement) => px(t, "--gr"),
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: reprise,
          start: "top bottom",
          end: "top 25%",
          scrub: 0.4,
        },
      });
      gsap.to(
        el.querySelectorAll(".wk-contact .wk-scatter, .wk-contact-portrait"),
        {
          opacity: 0,
          y: -60,
          ease: "none",
          scrollTrigger: {
            trigger: reprise,
            start: "top 90%",
            end: "top 30%",
            scrub: 0.4,
          },
        },
      );

      // The opening re-forms: letters gather, portrait and orbit fade in.
      // Unsmoothed and finished well before the bottom, so the frame at max
      // scroll is exactly the opening (the shell then jumps to the top).
      const inn = reprise.querySelectorAll<HTMLElement>(".gather-ch");
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: reprise,
          start: "top 70%",
          end: () => `bottom-=${Math.round(innerHeight * 0.18)} bottom`,
          scrub: true,
          invalidateOnRefresh: true,
        },
      });
      tl.fromTo(
        inn,
        {
          x: (_i: number, t: HTMLElement) => px(t, "--gx") * 1.6,
          y: (_i: number, t: HTMLElement) => px(t, "--gy") * 1.6 + 60,
          rotation: (_i: number, t: HTMLElement) => px(t, "--gr"),
          opacity: 0,
        },
        {
          x: 0,
          y: 0,
          rotation: 0,
          opacity: 1,
          ease: "power2.out",
          stagger: 0.015,
        },
        0,
      )
        .fromTo(
          reprise.querySelectorAll(".wk-hero-portrait"),
          { opacity: 0, scale: 0.94, y: 40 },
          { opacity: 1, scale: 1, y: 0, ease: "power1.out" },
          0.1,
        )
        .fromTo(
          reprise.querySelectorAll(
            ".wk-orbit, .wk-sub, .wk-rule, .wk-hero-field, .wk-hero-copy > div, .wk-experience",
          ),
          { opacity: 0 },
          { opacity: 1, ease: "none" },
          0.35,
        );
    }, el);
    return () => {
      cleanups.forEach((f) => f());
      mm.revert();
      ctx.revert();
    };
  }, [hydrated, reducedMotion]);

  // The loop end must be pixel-identical to scrollY 0: pad the reprise so the
  // document ends on a whole pixel (scroll positions are integers).
  useEffect(() => {
    const el = root.current;
    const rep = el?.querySelector<HTMLElement>(".wk-reprise");
    if (!el || !rep || !hydrated) return;
    let raf = 0;
    const fix = () => {
      raf = 0;
      const cur = parseFloat(rep.style.getPropertyValue("--rep-pad")) || 0;
      const r = rep.getBoundingClientRect();
      const bottom = r.bottom + scrollY - cur;
      const pad = Math.ceil(bottom - 0.001) - bottom;
      if (Math.abs(pad - cur) > 0.002)
        rep.style.setProperty("--rep-pad", `${pad.toFixed(3)}px`);
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(fix);
    };
    const ro = new ResizeObserver(queue);
    ro.observe(el);
    ScrollTrigger.addEventListener("refresh", queue);
    queue();
    return () => {
      ro.disconnect();
      ScrollTrigger.removeEventListener("refresh", queue);
      cancelAnimationFrame(raf);
      rep.style.removeProperty("--rep-pad");
    };
  }, [hydrated]);

  // Set piece: hero ribbon loops the portrait, the face pours into it and
  // streams off right, then lands as the Plainkit / Bedulo previews.
  useEffect(() => {
    const el = root.current;
    const canvas = streamRef.current;
    if (!el || !canvas || !hydrated || reducedMotion || introPlaying) return;
    const probe = document.createElement("canvas").getContext("2d");
    if (!probe) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(min-width: 721px)", () => {
      const hero = el.querySelector<HTMLElement>(".wk > .wk-hero");
      const portrait = hero?.querySelector<HTMLElement>(
        ".wk-hero-portrait .portrait",
      );
      const pair = el.querySelector<HTMLElement>(".wk-pair");
      if (!hero || !portrait || !pair) return;
      const ribbons = hero.querySelectorAll<SVGSVGElement>(
        ".wk-hero-field svg.ribbon",
      );
      let stream: FaceStream;
      try {
        stream = new FaceStream(
          {
            canvas,
            hero,
            portrait,
            ribbon: ribbons[0] ?? null,
            ribbon2: ribbons[1] ?? null,
            slideOut: [
              ...hero.querySelectorAll<HTMLElement>(
                ":scope > .wk-hero-copy, :scope > .wk-orbit, :scope > .wk-experience, .wk-hero-field .wk-float",
              ),
            ],
            items: [...pair.querySelectorAll<HTMLElement>(".wk-pair-item")],
            frames: [...pair.querySelectorAll<HTMLElement>(".wk-pair-frame")],
          },
          innerWidth > 1024 ? 8000 : 5000,
        );
      } catch {
        return;
      }
      const pin = ScrollTrigger.create({
        trigger: hero,
        start: "top top",
        end: () => `+=${Math.round(innerHeight * 1.5)}`,
        pin: true,
        refreshPriority: 2,
        pinSpacing: true,
        invalidateOnRefresh: true,
      });
      const master = ScrollTrigger.create({
        start: 0,
        endTrigger: pair.querySelector(".wk-pair-frame") ?? pair,
        end: "top 20%",
        invalidateOnRefresh: true,
        refreshPriority: 1,
        onUpdate: (s) => stream.update(s.progress),
        onRefresh: (s) => {
          stream.update(s.progress);
          void stream.build();
        },
      });
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
      stream.update(master.progress);
      void stream.build();
      return () => {
        master.kill();
        pin.kill();
        stream.destroy();
      };
    });
    return () => mm.revert();
  }, [hydrated, reducedMotion, introPlaying]);

  return (
    <div className="wk" ref={root}>
      <canvas ref={streamRef} className="wk-stream" aria-hidden="true" />
      <section
        id="top"
        data-map="hero"
        className="wk-hero"
        aria-label="Introduction"
      >
        <HeroScene />
      </section>
      <Projects />
      <Contact />
      <div className="wk-reprise" aria-hidden="true" inert data-loop-end>
        <div className="wk-hero wk-hero-reprise">
          <HeroScene reprise />
        </div>
      </div>
    </div>
  );
}
