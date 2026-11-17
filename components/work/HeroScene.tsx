"use client";
import { ArrowDown } from "lucide-react";
import GatherText from "@/components/shared/GatherText";
import Portrait from "@/components/shared/Portrait";
import Ribbon from "@/components/shared/Ribbon";
import CertOrbit from "./CertOrbit";
import Words from "./Words";

const HERO_RIBBON =
  "M150,905 C240,800 440,780 640,750 C860,716 1080,680 1220,640 C1330,605 1330,535 1200,515 C1040,492 800,540 700,600 C640,640 690,690 800,690";
const HERO_RIBBON_2 =
  "M120,920 C260,820 470,800 660,772 C880,740 1090,700 1235,655 C1350,615 1350,530 1215,505";

/** phones: one ribbon under the shoulders (never across the face) */
const HERO_RIBBON_M =
  "M-30,250 C40,214 120,236 200,212 C270,190 330,150 420,96";

const EXPERIENCE: [string, string][] = [
  ["Software Engineering", "Provo CAPS"],
  ["Intern", "Doing Business Intelligently"],
  ["Timpview High School", "Graduating 2027"],
];

import { floatStyle } from "./floatStyle";

const SPARSE: [string, number, number][] = [
  ["{", 86.5, 21],
  ["</>", 90.2, 23],
  [";", 94.2, 25],
  ["=>", 89, 33],
  ["#", 92.6, 40],
  ["()", 87.4, 44],
  ["&&", 89.6, 50],
  ["[ ]", 85.6, 55],
  ["!=", 82.6, 66],
  ["}", 87, 64],
  ["//", 88.6, 75],
  ["$", 78.8, 72],
];

const DOT = <span className="dot-accent">.</span>;

function Statement({ ghost = false }: { ghost?: boolean }) {
  return (
    <p className="wk-statement">
      <Words text="I turn ideas into" ghost={ghost} />{" "}
      <br />
      <Words text="things you can use" ghost={ghost} end={DOT} />
    </p>
  );
}

function Kinds() {
  return (
    <p className="wk-kinds">
      <Words text="Browser tools" end={DOT} /> <Words text="Desktop apps" end={DOT} />{" "}
      <Words text="Games" end={DOT} />
    </p>
  );
}

function SelectedLabel() {
  return (
    <>
      <span>
        <Words text="Selected work" />
      </span>
      <ArrowDown size={20} aria-hidden="true" />
    </>
  );
}

/**
 * The opening composition. Rendered once as the real hero and once (`reprise`)
 * as the decorative frame the page re-forms into after contact.
 */
export default function HeroScene({ reprise = false }: { reprise?: boolean }) {
  const Title = reprise ? "div" : "h1";
  return (
    <>
      <div className="wk-hero-field" aria-hidden="true">
        <Ribbon
          path={HERO_RIBBON}
          text="jeffrey Hamilton"
          textStart="4%"
          strands={7}
          spread={3.4}
          className="wk-hero-ribbon"
        />
        <Ribbon
          path={HERO_RIBBON_2}
          strands={5}
          spread={2.6}
          className="wk-hero-ribbon wk-hero-ribbon-2"
        />
        <Ribbon
          path={HERO_RIBBON_M}
          viewBox="0 0 390 300"
          strands={6}
          spread={2.6}
          className="wk-hero-ribbon-m"
        />
        {SPARSE.map(([ch, x, y], i) => (
          <span
            key={i}
            className="wk-float"
            style={floatStyle(x, y, i)}
          >
            {ch}
          </span>
        ))}
      </div>

      <div
        className="wk-hero-portrait"
        data-intro={reprise ? undefined : "portrait"}
      >
        <Portrait
          tone="dark"
          framing="bust"
          interactive={!reprise}
          assemble={!reprise}
          decorative={reprise}
        />
      </div>

      <CertOrbit still={reprise} />

      <div className="wk-hero-copy">
        <Title
          className="wk-title"
          data-intro={reprise ? undefined : "title"}
          {...(reprise ? {} : { id: "hero-title", tabIndex: -1 })}
        >
          <GatherText text="Jeffrey Hamilton" seed={reprise ? 7 : 1} />
        </Title>
        <p className="wk-sub" data-intro={reprise ? undefined : "support"}>
          <Words text="Software developer / Provo, Utah" />
        </p>
        <span
          className="rule-accent wk-rule"
          aria-hidden="true"
          data-intro={reprise ? undefined : "rule"}
        />
        {reprise ? (
          <div>
            {/* Same frame as the live hero, but the statement text is drawn via
                CSS so the decorative copy never duplicates real page text. */}
            <Statement ghost />
            <Kinds />
            <span className="wk-selected">
              <SelectedLabel />
            </span>
          </div>
        ) : (
          <div data-intro="support">
            <Statement />
            <Kinds />
            <a className="wk-selected" href="#projects">
              <SelectedLabel />
            </a>
          </div>
        )}
      </div>

      <div
        className="wk-experience"
        {...(reprise
          ? {}
          : {
              "data-intro": "support",
              "aria-label": "Experience",
              role: "region",
            })}
      >
        <ul>
          {EXPERIENCE.map(([role, place], i) => (
            <li key={role}>
              {i > 0 && (
                <span className="wk-slash" aria-hidden="true">
                  /
                </span>
              )}
              <span>
                <Words text={role} />
              </span>
              <span className="wk-sep-dot" aria-hidden="true">
                ·
              </span>
              <span className="sr-only">, </span>
              <span>
                <Words text={place} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
