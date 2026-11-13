"use client";
import { ArrowDown } from "lucide-react";
import GatherText from "@/components/shared/GatherText";
import Portrait from "@/components/shared/Portrait";
import Ribbon from "@/components/shared/Ribbon";
import Contact from "./Contact";
import Journey from "./Journey";

/**
 * Explore mode (warm ivory): arrival → one continuous journey with a sticky
 * cutout portrait and the single auto-cycling photo frame → contact → the
 * opening re-forms on continued scroll.
 */
export default function ExploreMode() {
  return (
    <div className="explore">
      <Arrival />
      <Journey />
      <Contact />
    </div>
  );
}

function Arrival() {
  return (
    <section id="top" data-map="hero" className="x-arrival">
      <div className="x-arrival-art" data-intro="portrait">
        <Ribbon
          className="x-arrival-ribbon"
          path="M520,720 C600,660 680,720 780,780 C940,860 1180,860 1460,690"
          tone="light"
          strands={7}
          spread={3.6}
        />
        <Ribbon
          className="x-arrival-ribbon"
          path="M1180,410 C1270,420 1360,360 1440,300"
          tone="light"
          strands={6}
          spread={3}
        />
        <div className="x-arrival-portrait">
          <Portrait tone="light" variant="halftone" framing="bust" interactive assemble />
        </div>
      </div>

      <div className="x-arrival-copy">
        <h1 id="hero-title" tabIndex={-1} className="x-arrival-title" data-intro="title">
          <span className="sr-only">The person behind the projects.</span>
          <span aria-hidden="true" className="x-arrival-title-vis">
            <span className="x-line">
              <GatherText text="The person" seed={2} />
            </span>
            <span className="x-line">
              <GatherText text="behind the" seed={5} />
            </span>
            <span className="x-line">
              <GatherText text="projects" seed={9} />
              <span className="dot-accent">.</span>
            </span>
          </span>
        </h1>
        <div className="x-arrival-support" data-intro="support">
          <span className="rule-accent" aria-hidden="true" />
          <p className="x-arrival-who">
            Jeffrey Hamilton <span className="x-slash">/</span> Provo, Utah
          </p>
          <p className="x-arrival-lead">A little of how I got here.</p>
        </div>
      </div>

      <a className="x-start" href="#journey" data-intro="support">
        Start the story
        <ArrowDown size={22} strokeWidth={1.8} aria-hidden="true" />
      </a>

      <div className="x-arrival-year" aria-hidden="true" data-intro="support">
        <svg className="x-arrival-dotline" viewBox="0 0 400 40" preserveAspectRatio="none">
          <path
            d="M0,30 C120,38 260,30 392,16"
            fill="none"
            stroke="var(--ink)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="0 7"
          />
        </svg>
        <span className="x-arrival-dot" />
        <span className="x-arrival-yr">2018</span>
      </div>
    </section>
  );
}
