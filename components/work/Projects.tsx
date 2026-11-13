"use client";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import Portrait from "@/components/shared/Portrait";
import Ribbon from "@/components/shared/Ribbon";
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
        loading="lazy"
        decoding="async"
        style={{ objectPosition: FOCUS[p.id] ?? p.preview.focal }}
      />
    </div>
  );
}

const ROW_TRAIL = "M0,118 C120,126 230,92 340,84 C450,76 520,62 600,46";
const ROW_TRAIL_ALT = "M0,92 C130,70 250,118 360,104 C470,90 530,70 600,60";

export default function Projects() {
  const [plainkit, bedulo, ...rest] = projects;
  const startIndex = 3;
  return (
    <section
      id="projects"
      data-map="middle"
      className="wk-projects"
      aria-labelledby="wk-projects-h"
    >
      <h2 id="wk-projects-h" className="sr-only">
        Projects
      </h2>
      <div className="wk-slice" aria-hidden="true">
        <div className="wk-slice-sticky">
          <div className="wk-slice-portrait">
            <Portrait tone="dark" framing="face" decorative />
          </div>
          {["e", "m", "a", "j", "t", "H", "a", "e", "r", "i"].map((ch, i) => (
            <span key={i} className={`wk-float wk-slice-ch wk-slice-ch-${i}`}>
              {ch}
            </span>
          ))}
        </div>
      </div>

      <div className="wk-projects-body">
        {/* Opening pair */}
        <div className="wk-pair">
          <div className="wk-pair-trails" aria-hidden="true">
            <Ribbon
              path="M0,520 C70,500 150,452 220,410 C270,380 300,350 330,330"
              viewBox="0 0 1440 640"
              strands={7}
              spread={3}
            />
            <Ribbon
              path="M0,600 C90,560 170,500 250,470"
              viewBox="0 0 1440 640"
              strands={5}
              spread={2.4}
            />
            <Ribbon
              path="M846,520 C866,440 880,360 892,290 C898,250 904,220 912,200"
              viewBox="0 0 1440 640"
              strands={7}
              spread={3}
            />
          </div>
          {[plainkit, bedulo].map((p) => (
            <article key={p.id} className={`wk-pair-item wk-pair-${p.id}`}>
              <div className="wk-pair-frame">
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
              <Title p={p} as="h3" />
              <p className="wk-pdesc">{SHORT[p.id] ?? p.description}</p>
            </article>
          ))}
        </div>
        <div className="wk-more" aria-hidden="true">
          <span>More projects below</span>
          <ArrowDown size={22} />
        </div>

        {/* Reel */}
        <div className="wk-reel">
          <div className="wk-reel-head">
            <h3 className="wk-reel-label">
              <span aria-hidden="true">03</span> Selected work
            </h3>
            <p className="wk-reel-count" aria-hidden="true">
              Work 03 → {String(projects.length).padStart(2, "0")}
            </p>
          </div>
          <ol className="wk-rows">
            {rest.map((p, i) => (
              <li key={p.id} className="wk-row">
                <div className="wk-row-trail" aria-hidden="true">
                  <Ribbon
                    path={i % 2 ? ROW_TRAIL_ALT : ROW_TRAIL}
                    viewBox="0 0 600 160"
                    strands={7}
                    spread={2.6}
                  />
                </div>
                <span className="wk-row-index" aria-hidden="true">
                  {String(startIndex + i).padStart(2, "0")}
                </span>
                <div className="wk-row-text">
                  <Title p={p} as="h4" />
                  <p className="wk-pdesc">{SHORT[p.id] ?? p.description}</p>
                </div>
                <div className="wk-row-strip">
                  <Strip p={p} />
                </div>
              </li>
            ))}
          </ol>
          <div className="wk-reel-foot">
            <a
              href="https://jeffrey-hamilton-portfolio.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
            >
              More experiments <ArrowUpRight size={20} aria-hidden="true" />
            </a>
            <span className="wk-reel-foot-rule" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
