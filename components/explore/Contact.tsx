"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight } from "lucide-react";
import Ribbon from "@/components/shared/Ribbon";
import { usePortfolio } from "@/components/shared/context";
import { DotMorph, norm, play } from "@/components/shared/dotText";
import { inertia } from "@/components/shared/inertia";
import Arrival from "./Arrival";

/** contact copy (forms from dots on arrival, dissolves into the reprise) */
const CONTACT_TEXT = ".x-c-title, .x-contact-copy > .rule-accent, .x-contact-lead, .x-to-work";
/** the opening's copy in the reprise (forms from the contact's dots) */
const OPENING_TEXT =
  ".x-arrival-replica .x-arrival-title, .x-arrival-replica .x-arrival-support, .x-arrival-replica .x-start";
/** the end of the journey above: its last chapter's copy becomes the contact copy */
const LAST_CHAPTER =
  ".x-chapter:last-of-type > .rule-accent, .x-chapter:last-of-type h3 > [aria-hidden], .x-chapter:last-of-type .x-chapter-text, .x-chapter:last-of-type .x-rule-sm, .x-chapter:last-of-type .x-chapter-aside, .photo-wave-label, .photo-wave-hint";
/** scrub window of the contact → opening morph */
const SWAP: [number, number] = [0.06, 0.86];
/** phones: no scroll scrubs — the copy forms from dots on a short clock */
const PHONE = "(max-width: 720px)";
const FORM_MS = 1100;

export default function Contact() {
  const { reducedMotion, hydrated } = usePortfolio();
  const run = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);
  const [phone, setPhone] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia(PHONE);
    const apply = () => setPhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

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

  // Phones: contact copy, then the opening as the last screen (stacked, no
  // pin). The copy forms from dots once it is well in view and is fully
  // formed at rest; leaving the screen resets it for the next visit.
  useEffect(() => {
    const st = stage.current;
    if (!phone || !st || reducedMotion || !hydrated) return;
    const copy = [...st.querySelectorAll<HTMLElement>(CONTACT_TEXT)];
    const box = st.querySelector<HTMLElement>(".x-contact-copy");
    if (!copy.length || !box) return;
    const form = new DotMorph({ from: { scatter: 120 }, to: { text: copy }, anchor: st, salt: 51 });
    let state: "idle" | "playing" | "done" = "idle";
    let p = 0;
    let stop: (() => void) | null = null;
    const draw = (v: number) => {
      p = v;
      form.update(v);
    };
    form.measure().then(() => form.update(p));
    draw(0);
    const io = new IntersectionObserver(
      (es) => {
        const e = es[es.length - 1];
        if (!e) return;
        if (e.intersectionRatio >= 0.45 && state === "idle") {
          state = "playing";
          stop = play(FORM_MS, draw, () => {
            state = "done";
            stop = null;
          });
        } else if (!e.isIntersecting && state !== "idle") {
          stop?.();
          stop = null;
          state = "idle";
          draw(0);
        }
      },
      { threshold: [0, 0.45] },
    );
    io.observe(box);
    return () => {
      io.disconnect();
      stop?.();
      form.destroy();
    };
  }, [phone, reducedMotion, hydrated]);

  useEffect(() => {
    const el = run.current;
    const st = stage.current;
    if (!el || !st || reducedMotion || !hydrated || phone) return;
    gsap.registerPlugin(ScrollTrigger);
    const sec = section.current!;
    const copy = [...st.querySelectorAll<HTMLElement>(CONTACT_TEXT)];
    // arrival: the journey's last chapter dissolves and its dots form the
    // contact copy; the photo above turns into dots that build the head
    const journey = sec.previousElementSibling as HTMLElement | null;
    const above = journey
      ? [...journey.querySelectorAll<HTMLElement>(LAST_CHAPTER)].filter((e) => e.getClientRects().length)
      : [];
    const photo = journey?.querySelector<HTMLElement>(".photo-wave-view");
    const head = st.querySelector<HTMLElement>(".x-reprise .x-arrival-portrait");
    const form = new DotMorph({
      from: above.length ? { text: above, hide: true } : { scatter: 160 },
      to: { text: copy },
      anchor: st,
      salt: 51,
    });
    const face =
      photo && head
        ? new DotMorph({
            from: { picture: photo, hide: true, pick: "img" },
            to: { picture: head, pick: "canvas" },
            anchor: st,
            salt: 57,
            // a finer grid than text: the face should read before it lands
            maxDots: innerWidth < 720 ? 6000 : 16000,
          })
        : null;
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
      face?.update(pOut > 0 ? 1 : norm(pIn, 0, 0.85));
      swap.update(norm(pOut, ...SWAP));
    };
    // the arrival's two sides only sit still relative to each other once the
    // journey's pin has released (this window): measure them in it
    const measureIn = () => {
      form.measure().then(draw);
      face?.measure().then(draw);
    };
    const remeasure = () => {
      measureIn();
      swap.measure().then(draw);
    };
    // both follow the scroll with the shared deceleration (the opening's);
    // the shell's loop jump waits until the exit has landed (data-loop-hold)
    const end = st.querySelector<HTMLElement>("[data-loop-end]");
    let tl: gsap.core.Timeline | null = null;
    const vIn = inertia(
      (p) => {
        pIn = p;
        draw();
      },
      { snap: 1 },
    );
    const vOut = inertia((p) => {
      pOut = p;
      tl?.progress(p);
      draw();
      // (the reprise is fully formed well before p = 1)
      if (p < 0.92) end?.setAttribute("data-loop-hold", "");
      else end?.removeAttribute("data-loop-hold");
    });
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: sec,
        start: "top bottom",
        end: "top top",
        onToggle: (s) => {
          if (s.isActive) measureIn();
        },
        onUpdate: (s) => vIn.follow(s.progress),
        onRefresh: (s) => vIn.jump(s.progress),
        onLeave: () => vIn.follow(1),
        onLeaveBack: () => vIn.follow(0),
      });
      tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
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
      ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: "bottom bottom",
        // let go past the start and it finishes the reprise (and the loop)
        snap: {
          snapTo: (v: number, self?: ScrollTrigger) =>
            v <= 0 || v >= 1 ? v : v < 0.08 ? 0 : (self?.direction ?? 1) > 0 ? 1 : 0,
          duration: { min: 0.4, max: 0.9 },
          delay: 0.1,
          ease: "power2.inOut",
        },
        onUpdate: (s) => vOut.follow(s.progress),
        onRefresh: (s) => {
          remeasure();
          vOut.jump(s.progress);
        },
      });
    }, st);
    draw();
    remeasure();
    return () => {
      vIn.stop();
      vOut.stop();
      end?.removeAttribute("data-loop-hold");
      ctx.revert();
      form.destroy();
      face?.destroy();
      swap.destroy();
    };
  }, [reducedMotion, hydrated, phone]);

  return (
    <section
      ref={section}
      id="contact"
      data-map="contact"
      className={`x-contact${reducedMotion ? " is-static" : ""}${phone ? " is-phone" : ""}`}
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
