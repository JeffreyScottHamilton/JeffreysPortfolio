"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { usePortfolio } from "@/components/shared/context";
import HeroScene from "./HeroScene";
import Projects from "./Projects";
import Contact from "./Contact";

const px = (el: HTMLElement, v: string) =>
  parseFloat(el.style.getPropertyValue(v)) || 0;

/**
 * Work mode: hero + certificate orbit → Plainkit/Bedulo pair → preview-strip
 * reel → contact → reprise (contact scatters, opening re-forms on scroll).
 */
export default function WorkMode() {
  const root = useRef<HTMLDivElement>(null);
  const { reducedMotion, hydrated } = usePortfolio();

  useEffect(() => {
    const el = root.current;
    if (!el || !hydrated || reducedMotion) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      // Rows ease in as they enter (desktop only); each strip moves with its title.
      mm.add("(min-width: 721px)", () => {
        gsap.utils
          .toArray<HTMLElement>(".wk-row, .wk-pair-item")
          .forEach((row) => {
            gsap.fromTo(
              row,
              { y: 32, opacity: 0.25 },
              {
                y: 0,
                opacity: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: row,
                  start: "top 100%",
                  end: "top 72%",
                  scrub: 0.5,
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
      const inn = reprise.querySelectorAll<HTMLElement>(".gather-ch");
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: reprise,
          start: "top 70%",
          end: "bottom bottom",
          scrub: 0.5,
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
            ".wk-orbit, .wk-sub, .wk-rule, .wk-hero-field",
          ),
          { opacity: 0 },
          { opacity: 1, ease: "none" },
          0.35,
        );
    }, el);
    return () => {
      mm.revert();
      ctx.revert();
    };
  }, [hydrated, reducedMotion]);

  return (
    <div className="wk" ref={root}>
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
      <div className="wk-reprise" aria-hidden="true" inert>
        <div className="wk-hero wk-hero-reprise">
          <HeroScene reprise />
        </div>
      </div>
    </div>
  );
}
