"use client";
import type { CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import { projects, type Project } from "@/content/portfolio";

/**
 * Short display lines (the approved copy in the reference frames). Each is a
 * condensation of the project's description in content/portfolio.ts; the full
 * description is still exposed to assistive tech via the preview alt text.
 */
const SHORT: Record<string, string> = {
  plainkit: "Browser tools that stay on your device.",
  bedulo: "Talk each night. Bedulo writes the page.",
  slate: "Collaborative whiteboard + 3D editor.",
  pollly: "Every post is a question.",
  bulletin: "Local classifieds.",
  counterpoint: "Sharpen your thinking.",
  violethour: "Editor theme.",
  modrinth: "Fabric projects.",
  signalsurf: "Planned project.",
  ultimatum: "Open-source developer skill for Claude Code.",
  buddy: "Offline AI desktop companion.",
};

/** Which band of each screenshot the cropped strip shows. */
const FOCUS: Record<string, string> = {
  slate: "50% 42%",
  pollly: "50% 4%",
  counterpoint: "50% 10%",
  violethour: "50% 12%",
  modrinth: "50% 6%",
  ultimatum: "50% 3%",
  buddy: "50% 46%",
};

const href = (p: Project) => p.live ?? p.source;

function Title({ p, as: Tag }: { p: Project; as: "h3" | "h4" }) {
  const url = href(p);
  const inner = (
    <>
      {p.name}
      <span className="dot-accent">.</span>
    </>
  );
  return (
    <Tag className="wk-ptitle">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {inner}
        </a>
      ) : (
        inner
      )}
    </Tag>
  );
}

function Strip({ p }: { p: Project }) {
  const s = p.preview.status;
  if (s === "planned")
    return (
      <div
        className="wk-strip wk-strip-planned"
        role="img"
        aria-label="Planned project, not built yet"
      >
        <span>[ Not built yet ]</span>
      </div>
    );
  if (s !== "ready" || !p.preview.src)
    return (
      <div
        className="wk-strip wk-strip-pending"
        role="img"
        aria-label={`${p.name} preview pending`}
      >
        <span className="wk-pending-chip" aria-hidden="true" />
        <span className="wk-pending-text">Preview pending</span>
      </div>
    );
  return (
    <div className="wk-strip">
      <img
        src={p.preview.src}
        alt={`${p.preview.alt}. ${p.description}`}
        decoding="async"
        style={{ objectPosition: FOCUS[p.id] ?? p.preview.focal }}
      />
    </div>
  );
}

/**
 * The project board: one compact screen. On desktop with motion it sits in
 * the pinned hero stage and is built in place from the face's dots
 * (FaceStream); otherwise it simply follows the hero.
 */
export default function Projects() {
  const [plainkit, bedulo, ...rest] = projects;
  return (
    <section
      id="projects"
      data-map="middle"
      className="wk-board"
      aria-labelledby="wk-board-h"
    >
      <div className="wk-board-inner">
        <div className="wk-board-head wk-bd-in" style={{ "--i": 0 } as CSSProperties}>
          <h2 id="wk-board-h" className="wk-board-label">
            Selected work
          </h2>
          <p className="wk-board-count">{projects.length} projects</p>
        </div>

        <div className="wk-pair">
          {[plainkit, bedulo].map((p, k) => (
            <article key={p.id} className={`wk-pair-item wk-pair-${p.id}`}>
              <div className="wk-pair-frame wk-bd-target">
                {p.preview.status === "ready" && p.preview.src ? (
                  <img
                    src={p.preview.src}
                    alt={p.preview.alt}
                    decoding="async"
                  />
                ) : (
                  <div
                    className="wk-journal"
                    role="img"
                    aria-label={`${p.name}: journal preview to add`}
                  >
                    <div className="wk-journal-paper">
                      <span className="wk-journal-kicker">{p.name}</span>
                      <span className="wk-journal-label">
                        Journal preview to add
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div
                className="wk-pair-text wk-bd-in"
                style={{ "--i": 1 + k } as CSSProperties}
              >
                <span className="wk-row-index" aria-hidden="true">
                  {String(k + 1).padStart(2, "0")}
                </span>
                <Title p={p} as="h3" />
                <p className="wk-pdesc">{SHORT[p.id] ?? p.description}</p>
              </div>
            </article>
          ))}
        </div>

        <ol className="wk-rows" start={3}>
          {rest.map((p, i) => (
            <li
              key={p.id}
              className="wk-row wk-bd-in"
              style={{ "--i": 3 + i } as CSSProperties}
            >
              <span className="wk-row-index" aria-hidden="true">
                {String(3 + i).padStart(2, "0")}
              </span>
              <div className="wk-row-text">
                <Title p={p} as="h3" />
                <p className="wk-pdesc">{SHORT[p.id] ?? p.description}</p>
              </div>
              <div className="wk-row-strip wk-bd-target">
                <Strip p={p} />
              </div>
            </li>
          ))}
        </ol>

        <div className="wk-board-foot wk-bd-in" style={{ "--i": 12 } as CSSProperties}>
          <a
            href="https://jeffrey-hamilton-portfolio.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
          >
            More experiments <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          <span className="wk-board-foot-rule" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
