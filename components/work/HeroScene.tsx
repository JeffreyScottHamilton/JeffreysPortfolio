"use client";
import { ArrowDown } from "lucide-react";
import GatherText from "@/components/shared/GatherText";
import Portrait from "@/components/shared/Portrait";
import Ribbon from "@/components/shared/Ribbon";
import CertOrbit from "./CertOrbit";

const HERO_RIBBON =
  "M150,905 C240,800 440,780 640,750 C860,716 1080,680 1220,640 C1330,605 1330,535 1200,515 C1040,492 800,540 700,600 C640,640 690,690 800,690";
const HERO_RIBBON_2 =
  "M120,920 C260,820 470,800 660,772 C880,740 1090,700 1235,655 C1350,615 1350,530 1215,505";

const EXPERIENCE: [string, string][] = [
  ["Software Engineering", "Provo CAPS"],
  ["Intern", "Doing Business Intelligently"],
  ["Timpview High School", "Graduating 2027"],
];

const SPARSE: [string, number, number][] = [
  ["t", 86.5, 21],
  ["i", 90.2, 23],
  ["e", 94.2, 25],
  ["m", 89, 33],
  ["j", 92.6, 40],
  ["a", 87.4, 44],
  ["i", 89.6, 50],
  ["r", 85.6, 55],
  ["a", 82.6, 66],
  ["H", 87, 64],
  ["e", 88.6, 75],
  ["e", 78.8, 72],
];

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
        {SPARSE.map(([ch, x, y], i) => (
          <span
            key={i}
            className="wk-float"
            style={{ left: `${x}%`, top: `${y}%` }}
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
          Software developer / Provo, Utah
        </p>
        <span className="rule-accent wk-rule" aria-hidden="true" />
        {!reprise && (
          <div data-intro="support">
            <p className="wk-statement">
              I turn ideas into <br />
              things you can use
              <span className="dot-accent">.</span>
            </p>
            <p className="wk-kinds">
              Browser tools<span className="dot-accent">.</span> Desktop apps
              <span className="dot-accent">.</span> Games
              <span className="dot-accent">.</span>
            </p>
            <a className="wk-selected" href="#projects">
              Selected work <ArrowDown size={20} aria-hidden="true" />
            </a>
          </div>
        )}
      </div>

      {!reprise && (
        <div
          className="wk-experience"
          data-intro="support"
          aria-label="Experience"
          role="region"
        >
          <ul>
            {EXPERIENCE.map(([role, place], i) => (
              <li key={role}>
                {i > 0 && (
                  <span className="wk-slash" aria-hidden="true">
                    /
                  </span>
                )}
                <span>{role}</span>
                <span className="wk-sep-dot" aria-hidden="true">
                  ·
                </span>
                <span className="sr-only">, </span>
                <span>{place}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
