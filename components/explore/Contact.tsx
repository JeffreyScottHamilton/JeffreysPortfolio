"use client";
import { Fragment, useEffect, useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Github, Linkedin, Mail } from "lucide-react";
import Portrait from "@/components/shared/Portrait";
import Ribbon from "@/components/shared/Ribbon";
import { usePortfolio } from "@/components/shared/context";
import { contact } from "@/content/portfolio";
import { AccentLines, ExternalLink, YouTubeLinks } from "./parts";

const BOTTOM_GLYPHS = ["q", "Z", "7", "%", "#", "K", "m", "4", "e", "a", "f"];
const ytLinks = [
  { href: contact.youtube, name: "Jeffrey_Creates" },
  { href: contact.vr, name: "JeffreyVR6399" },
];

/** Deterministic scatter offsets (no Math.random during render). */
function scatter(n: number, seed: number) {
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
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

const REPRISE_LINES = ["The person", "behind the", "projects."];

export default function Contact() {
  const { reducedMotion, hydrated } = usePortfolio();
  const run = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = run.current;
    const st = stage.current;
    if (!el || !st || reducedMotion || !hydrated) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const out = gsap.utils.toArray<HTMLElement>(".x-c-ch", st);
      const inn = gsap.utils.toArray<HTMLElement>(".x-r-ch", st);
      const so = scatter(out.length, 3);
      const si = scatter(inn.length, 11);
      gsap.set(inn, {
        x: (i) => si[i].x,
        y: (i) => si[i].y,
        rotation: (i) => si[i].rot,
        opacity: 0,
      });
      gsap.set(".x-reprise", { autoAlpha: 1 });
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6,
        },
      });
      tl.to({}, { duration: 0.12 })
        .to(
          out,
          {
            x: (i) => so[i].x,
            y: (i) => so[i].y,
            rotation: (i) => so[i].rot,
            opacity: 0,
            stagger: { each: 0.012, from: "random" },
            duration: 0.35,
          },
          0.12,
        )
        .to(
          ".x-c-fade",
          { autoAlpha: 0, y: -24, duration: 0.25, stagger: 0.03 },
          0.12,
        )
        .to(".x-c-title", { autoAlpha: 0, duration: 0.01 }, 0.55)
        .to(
          inn,
          {
            x: 0,
            y: 0,
            rotation: 0,
            opacity: 1,
            stagger: { each: 0.01, from: "random" },
            duration: 0.4,
          },
          0.4,
        )
        .fromTo(
          ".x-r-support",
          { autoAlpha: 0, y: 16 },
          { autoAlpha: 1, y: 0, duration: 0.2, stagger: 0.04 },
          0.72,
        )
        .to({}, { duration: 0.08 });
    }, st);
    return () => ctx.revert();
  }, [reducedMotion, hydrated]);

  return (
    <section
      id="contact"
      data-map="contact"
      className={`x-contact ${reducedMotion ? "is-static" : ""}`}
      aria-labelledby="contact-title"
    >
      <div className="x-contact-run" ref={run}>
        <div className="x-contact-stage" ref={stage}>
          <div className="x-contact-portrait">
            <Portrait tone="light" variant="halftone" framing="bust" interactive />
          </div>
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
                <ExternalLink href={contact.github} className="x-icon" label="GitHub (opens in a new tab)">
                  <Github size={44} strokeWidth={1.7} aria-hidden="true" />
                  <span className="x-icon-label" aria-hidden="true">GitHub</span>
                </ExternalLink>
              </li>
              <li>
                <a href={contact.email} className="x-icon" aria-label="Email">
                  <Mail size={46} strokeWidth={1.7} aria-hidden="true" />
                  <span className="x-icon-label" aria-hidden="true">Email</span>
                </a>
              </li>
              <li>
                <ExternalLink href={contact.linkedin} className="x-icon" label="LinkedIn (opens in a new tab)">
                  <Linkedin size={44} strokeWidth={1.7} aria-hidden="true" />
                  <span className="x-icon-label" aria-hidden="true">LinkedIn</span>
                </ExternalLink>
              </li>
            </ul>
            <YouTubeLinks links={ytLinks} className="x-yt-row x-c-fade" />
          </div>

          <div className="x-echo x-c-fade" aria-hidden="true">
            <svg className="x-echo-swirl" viewBox="0 0 120 220">
              <path
                d="M100,20 C40,30 6,80 10,130 C14,180 60,205 104,200"
                fill="none"
                stroke="var(--ink)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="0 6"
              />
              <path
                d="M92,8 C30,26 -4,82 2,134 C8,186 52,214 96,212"
                fill="none"
                stroke="var(--fringe-red)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeDasharray="0 11"
                opacity="0.8"
              />
            </svg>
            <p className="x-echo-text">
              <AccentLines lines={REPRISE_LINES} />
            </p>
          </div>

          <ul className="x-glyph-row x-c-fade" aria-hidden="true">
            {BOTTOM_GLYPHS.map((g, i) => (
              <li
                key={i}
                style={
                  {
                    "--gy": `${Math.round(Math.sin(i * 0.7) * 6 - i * 1.2)}px`,
                  } as CSSProperties
                }
              >
                {g}
              </li>
            ))}
          </ul>

          {/* Reprise: the opening re-forms from the scattered letters. */}
          <div className="x-reprise" aria-hidden="true">
            <p className="x-reprise-title">
              {REPRISE_LINES.map((l, i) => (
                <span className="x-line" key={i}>
                  <Letters text={l} cls="x-r-ch" />
                </span>
              ))}
            </p>
            <span className="rule-accent x-r-support" />
            <p className="x-reprise-sub x-r-support">
              Jeffrey Hamilton <span className="x-slash">/</span> Provo, Utah
            </p>
            <p className="x-reprise-sub x-r-support">A little of how I got here.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
