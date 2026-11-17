"use client";
import { Github, Linkedin, Mail } from "lucide-react";
import GatherText from "@/components/shared/GatherText";
import Portrait from "@/components/shared/Portrait";
import Ribbon from "@/components/shared/Ribbon";
import { contact } from "@/content/portfolio";

const LINKS = [
  { label: "GitHub", href: contact.github, Icon: Github, external: true },
  { label: "Email", href: contact.email, Icon: Mail, external: false },
  { label: "LinkedIn", href: contact.linkedin, Icon: Linkedin, external: true },
];

export default function Contact() {
  return (
    <section
      id="contact"
      data-map="contact"
      className="wk-contact"
      aria-labelledby="wk-contact-h"
    >
      <div className="wk-contact-field" aria-hidden="true">
        <Ribbon
          path="M40,860 C260,840 480,850 690,820 C900,790 1140,760 1330,700 C1420,670 1420,620 1370,600"
          text="Jeffrey Hamilton"
          textStart="46%"
          strands={7}
          spread={3.4}
        />
        <Ribbon
          path="M1090,470 C1180,462 1260,440 1330,410 C1380,390 1410,370 1440,360"
          strands={5}
          spread={2.4}
        />
      </div>
      <div className="wk-contact-portrait">
        <Portrait tone="dark" framing="bust" interactive />
      </div>
      <div className="wk-contact-copy">
        <h2
          id="wk-contact-h"
          className="wk-contact-title"
          aria-label="Let’s build something useful."
        >
          <span className="wk-line">
            <GatherText text="Let’s build" seed={3} />
          </span>
          <span className="wk-line">
            <GatherText text="something" seed={4} />
          </span>
          <span className="wk-line">
            <GatherText text="useful" seed={5} />
            <span className="dot-accent wk-scatter">.</span>
          </span>
        </h2>
        <span className="rule-accent wk-rule wk-scatter" aria-hidden="true" />
        <ul className="wk-contact-links wk-scatter">
          {LINKS.map(({ label, href, Icon, external }) => (
            <li key={label}>
              <a
                href={href}
                aria-label={label}
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                <Icon size={44} strokeWidth={1.6} aria-hidden="true" />
                <span className="wk-contact-tip" aria-hidden="true">
                  {label}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
