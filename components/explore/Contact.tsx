"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight } from "lucide-react";
import Ribbon from "@/components/shared/Ribbon";
import { usePortfolio } from "@/components/shared/context";
import { DotMorph, norm } from "@/components/shared/dotText";
import Arrival from "./Arrival";

/** contact copy (forms from dots on arrival, dissolves into the reprise) */
const CONTACT_TEXT = ".x-c-title, .x-contact-copy > .rule-accent, .x-contact-lead, .x-to-work";
/** the opening's copy in the reprise (forms from the contact's dots) */
const OPENING_TEXT =
  ".x-arrival-replica .x-arrival-title, .x-arrival-replica .x-arrival-support, .x-arrival-replica .x-start";
/** scrub window of the contact → opening morph */
const SWAP: [number, number] = [0.1, 0.78];

export default function Contact() {
  const { reducedMotion, hydrated } = usePortfolio();
  const run = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);

  // The loop needs the reprise to sit exactly on the viewport at max scroll.
  // Sub-pixel section heights (dvh multiples, wrapped text) would leave it
  // half a pixel off, so pad the section so the document ends on a whole pixel.
  useEffect(() => {
    const sec = section.current;
    const el = run.current;
    const main = sec?.closest("main");
    if (!sec || !el || !main) return;
    const snap = () => {
      sec.style.paddingTop = "0px";
      const end = el.getBoundingClientRect().bottom + window.scrollY;
      const frac = end - Math.floor(end);
      sec.style.paddingTop =
        frac > 0.01 && frac < 0.99 ? `${(1 - frac).toFixed(3)}px` : "0px";
    };
    snap();
    const ro = new ResizeObserver(snap);
    ro.observe(main);
    return () => {
      ro.disconnect();
      sec.style.removeProperty("padding-top");
    };
  }, []);

  useEffect(() => {
    const el = run.current;
    const st = stage.current;
    if (!el || !st || reducedMotion || !hydrated) return;
    gsap.registerPlugin(ScrollTrigger);
    const sec = section.current!;
    const copy = [...st.querySelectorAll<HTMLElement>(CONTACT_TEXT)];
    // arrival: the contact copy forms from dots as the section scrolls in
    const form = new DotMorph({ from: { scatter: 160 }, to: { text: copy }, anchor: st, salt: 51 });
    // exit: its dots travel and re-form as the opening's copy (the reprise)
    const swap = new DotMorph({
      from: { text: copy, hide: true },
      to: { text: [...st.querySelectorAll<HTMLElement>(OPENING_TEXT)] },
      anchor: st,
      salt: 53,
    });
    let pIn = 0;
    let pOut = 0;
    const draw = () => {
      // (once the exit has begun the arrival is complete, however fast the scroll)
      form.update(pOut > 0 ? 1 : pIn);
      swap.update(norm(pOut, ...SWAP));
    };
    const remeasure = () => {
      form.measure().then(draw);
      swap.measure().then(draw);
    };
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: sec,
        start: "top 72%",
        end: "top top",
        onUpdate: (s) => {
          pIn = s.progress;
          draw();
        },
        onRefresh: (s) => {
          pIn = s.progress;
          draw();
        },
        onLeave: () => {
          pIn = 1;
          draw();
        },
        onLeaveBack: () => {
          pIn = 0;
          draw();
        },
      });
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.4,
          onRefresh: remeasure,
        },
        onUpdate() {
          pOut = this.progress();
          draw();
        },
      });
      // the ribbons (not text) hand over as before; the copy is carried by dots
      tl.to({}, { duration: 0.1 })
        .to(".x-contact-ribbon", { autoAlpha: 0, y: -24, duration: 0.14 }, 0.1)
        .fromTo(
          ".x-arrival-replica .x-arrival-ribbon",
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.3, immediateRender: true },
          0.42,
        )
        .to({}, { duration: 0.24 }, 0.76);
    }, st);
    draw();
    remeasure();
    return () => {
      ctx.revert();
      form.destroy();
      swap.destroy();
    };
  }, [reducedMotion, hydrated]);

  return (
    <section
      ref={section}
      id="contact"
      data-map="contact"
      className={`x-contact ${reducedMotion ? "is-static" : ""}`}
      aria-labelledby="contact-title"
    >
      <div className="x-contact-run" ref={run}>
        <div className="x-contact-stage" ref={stage}>
          {/* Reprise: the opening, frame-identical to scrollY 0. Its portrait
              doubles as the contact portrait; its copy re-forms at the end. */}
          <div className="x-reprise" data-loop-end>
            <Arrival replica />
          </div>
          <div className="x-contact-main">
            <Ribbon
              className="x-contact-ribbon"
              path="M120,770 C260,860 560,890 860,860 C1100,836 1300,800 1420,720"
              tone="light"
              strands={6}
              spread={3.4}
            />
            <div className="x-contact-copy">
              <h2 id="contact-title" className="x-c-title">
                <span className="sr-only">Still curious.</span>
                <span aria-hidden="true">
                  Still curious<span className="dot-accent">.</span>
                </span>
              </h2>
              <span className="rule-accent" aria-hidden="true" />
              <p className="x-contact-lead">
                <span className="x-line">Good people. New ideas.</span>
                <span className="x-line">Things worth making.</span>
              </p>
              {/* Professional links live on Work's contact; YouTube lives in the
                  2022 chapter. Here, one quiet way across to the work. */}
              <button
                type="button"
                className="x-to-work"
                onClick={() =>
                  document
                    .querySelector<HTMLButtonElement>(
                      '.mode-switch button[aria-pressed="false"]',
                    )
                    ?.click()
                }
              >
                Want to work together? <span>See my work</span>
                <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
