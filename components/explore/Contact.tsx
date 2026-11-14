"use client";
import { Fragment, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Github, Linkedin, Mail } from "lucide-react";
import Ribbon from "@/components/shared/Ribbon";
import { usePortfolio } from "@/components/shared/context";
import { contact } from "@/content/portfolio";
import Arrival from "./Arrival";
import { ExternalLink, YouTubeLinks } from "./parts";

const ytLinks = [
  { href: contact.youtube, name: "Jeffrey_Creates" },
  { href: contact.vr, name: "JeffreyVR6399" },
];

/** Deterministic scatter offsets (no Math.random during render). */
function scatter(n: number, seed: number) {
  let s = seed * 9301 + 49297;
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: n }, () => ({
    x: (r() - 0.5) * 900,
    y: (r() - 0.65) * 520,
    rot: (r() - 0.5) * 160,
  }));
}

function Letters({ text, cls }: { text: string; cls: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, wi) => (
        <Fragment key={wi}>
          <span className="x-word">
            {[...w].map((ch, ci) => (
              <span
                className={`${cls}${ch === "." ? " dot-accent" : ""}`}
                key={ci}
              >
                {ch}
              </span>
            ))}
          </span>
          {wi < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}


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
      sec.style.paddingTop = frac > 0.01 && frac < 0.99 ? `${(1 - frac).toFixed(3)}px` : "0px";
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
    const ctx = gsap.context(() => {
      const out = gsap.utils.toArray<HTMLElement>(".x-c-ch", st);
      const inn = gsap.utils.toArray<HTMLElement>(
        ".x-arrival-replica .x-arrival-title-vis .gather-ch, .x-arrival-replica .x-arrival-title-vis .dot-accent",
        st,
      );
      const support = gsap.utils.toArray<HTMLElement>(
        ".x-arrival-replica .x-arrival-support > *, .x-arrival-replica .x-start",
        st,
      );
      const so = scatter(out.length, 3);
      const si = scatter(inn.length, 11);
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.4,
        },
      });
      tl.to({}, { duration: 0.1 })
        .to(
          out,
          {
            x: (i) => so[i].x,
            y: (i) => so[i].y,
            rotation: (i) => so[i].rot,
            opacity: 0,
            stagger: { each: 0.01, from: "random" },
            duration: 0.3,
          },
          0.1,
        )
        .to(
          ".x-c-fade",
          // finish before the opening letters arrive (0.34) so nothing overlaps
          { autoAlpha: 0, y: -24, duration: 0.14, stagger: 0.015 },
          0.1,
        )
        .to(".x-c-title", { autoAlpha: 0, duration: 0.01 }, 0.5)
        .fromTo(
          inn,
          {
            x: (i) => si[i].x,
            y: (i) => si[i].y,
            rotation: (i) => si[i].rot,
            opacity: 0,
          },
          {
            x: 0,
            y: 0,
            rotation: 0,
            opacity: 1,
            stagger: { each: 0.008, from: "random" },
            duration: 0.34,
            immediateRender: true,
          },
          0.34,
        )
        .fromTo(
          ".x-arrival-replica .x-arrival-ribbon",
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.3, immediateRender: true },
          0.42,
        )
        .fromTo(
          support,
          { autoAlpha: 0, y: 16 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.16,
            stagger: 0.03,
            immediateRender: true,
          },
          0.6,
        )
        // hold the finished opening so the scrub settles before the loop jump
        .to({}, { duration: 0.2 });
    }, st);
    return () => ctx.revert();
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
              className="x-contact-ribbon x-c-fade"
              path="M120,770 C260,860 560,890 860,860 C1100,836 1300,800 1420,720"
              tone="light"
              strands={6}
              spread={3.4}
            />
            <div className="x-contact-copy">
              <h2 id="contact-title" className="x-c-title">
                <span className="sr-only">Still curious.</span>
                <span aria-hidden="true">
                  <Letters text="Still curious." cls="x-c-ch" />
                </span>
              </h2>
              <span className="rule-accent x-c-fade" aria-hidden="true" />
              <p className="x-contact-lead x-c-fade">
                <span className="x-line">Good people. New ideas.</span>
                <span className="x-line">Things worth making.</span>
              </p>
              <ul className="x-social x-c-fade">
                <li>
                  <ExternalLink
                    href={contact.github}
                    className="x-icon"
                    label="GitHub (opens in a new tab)"
                  >
                    <Github size={44} strokeWidth={1.7} aria-hidden="true" />
                    <span className="x-icon-label" aria-hidden="true">
                      GitHub
                    </span>
                  </ExternalLink>
                </li>
                <li>
                  <a href={contact.email} className="x-icon" aria-label="Email">
                    <Mail size={46} strokeWidth={1.7} aria-hidden="true" />
                    <span className="x-icon-label" aria-hidden="true">
                      Email
                    </span>
                  </a>
                </li>
                <li>
                  <ExternalLink
                    href={contact.linkedin}
                    className="x-icon"
                    label="LinkedIn (opens in a new tab)"
                  >
                    <Linkedin size={44} strokeWidth={1.7} aria-hidden="true" />
                    <span className="x-icon-label" aria-hidden="true">
                      LinkedIn
                    </span>
                  </ExternalLink>
                </li>
              </ul>
              <YouTubeLinks links={ytLinks} className="x-yt-row x-c-fade" />
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
