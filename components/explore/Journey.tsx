"use client";
import { useEffect, useRef, useState } from "react";
import Portrait from "@/components/shared/Portrait";
import Ribbon from "@/components/shared/Ribbon";
import { contact, journey } from "@/content/portfolio";
import { gallery, videos } from "@/content/media";
import PhotoWave from "./PhotoWave";
import { AccentLines, DottedYear, YouTubeLinks } from "./parts";

/**
 * Presentation for each chapter of `journey` (content/portfolio.ts).
 * Headline lines follow the reference frames and only restate facts from the
 * content; prose comes from the content text. `asideFrom` splits the last
 * sentence(s) into the small second note shown under a short rule.
 */
const CHAPTERS = [
  {
    id: "ch-2018",
    path: "2018",
    year: ["2018"],
    lines: ["An egg business", "was the beginning."],
    asideFrom: 0,
  },
  {
    id: "ch-2022",
    path: "2022",
    year: ["2022"],
    lines: ["YouTube.", "Blender.", "Little games."],
    asideFrom: 0,
    media: true,
  },
  {
    id: "ch-2024",
    path: "2024",
    year: ["2023", "2024"],
    arrow: true,
    lines: ["New place.", "New people."],
    asideFrom: 1,
  },
  {
    id: "ch-now",
    path: "Now",
    year: ["now"],
    lines: ["Still close.", "Still creating."],
    asideFrom: 2,
  },
] as const;

function sentences(text: string) {
  return text.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [text];
}

const photos = gallery.filter((g) => g.status === "ready" && g.src);
const clips = videos.filter((v) => v.status === "ready" && v.src);
const ytLinks = [
  { href: contact.youtube, name: "Jeffrey_Creates" },
  { href: contact.vr, name: "JeffreyVR6399" },
];

export default function Journey() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = refs.current.indexOf(e.target as HTMLElement);
          if (i >= 0) setActive(i);
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section
      id="journey"
      data-map="middle"
      className="x-journey"
      aria-labelledby="journey-title"
    >
      <h2 id="journey-title" className="sr-only">
        How I got here
      </h2>
      <nav className="x-path" aria-label="Journey chapters">
        <ol>
          {CHAPTERS.map((c, i) => (
            <li key={c.id}>
              {i > 0 ? (
                <span className="x-path-sep" aria-hidden="true">
                  /
                </span>
              ) : null}
              <a
                href={`#${c.id}`}
                aria-current={active === i ? "step" : undefined}
              >
                {c.path}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="x-journey-grid">
        <div className="x-j-portrait" aria-hidden="true">
          <div className="x-j-portrait-box">
            <Portrait tone="light" variant="cutout" decorative />
          </div>
        </div>

        <div className="x-j-orbit" aria-hidden="true">
          <Ribbon
            className="x-orbit"
            viewBox="0 0 1000 900"
            path="M70,560 C40,330 300,170 560,150 C800,130 975,210 985,430 C995,650 820,820 560,835 C330,850 130,800 70,560 Z"
            text="jeffrey, hamilton,"
            textStart="6%"
            tone="light"
            strands={5}
            spread={4}
          />
          <Ribbon
            className="x-orbit x-orbit-b"
            viewBox="0 0 1000 900"
            path="M250,800 C330,830 430,842 560,835 C820,820 995,650 985,430"
            text="now"
            textStart="52%"
            tone="light"
            strands={3}
            spread={3}
          />
        </div>

        <div className="x-j-chapters">
          {CHAPTERS.map((c, i) => {
            const j = journey[i];
            if (!j) return null;
            const parts = sentences(j.text);
            const main = c.asideFrom ? parts.slice(0, -1) : parts;
            const aside = c.asideFrom ? parts.slice(-1) : [];
            return (
              <article
                key={c.id}
                id={c.id}
                className="x-chapter"
                ref={(el) => {
                  refs.current[i] = el;
                }}
                aria-labelledby={`${c.id}-h`}
              >
                <DottedYear
                  text={[...c.year]}
                  arrow={"arrow" in c && c.arrow}
                  label={j.year}
                />
                <span className="rule-accent" aria-hidden="true" />
                <h3 id={`${c.id}-h`} className="x-chapter-title">
                  <AccentLines lines={[...c.lines]} />
                </h3>
                <p className="x-chapter-text">{main.join(" ")}</p>
                {aside.length ? (
                  <>
                    <span className="x-rule-sm" aria-hidden="true" />
                    <p className="x-chapter-aside">{aside.join(" ")}</p>
                  </>
                ) : null}
                {"media" in c && c.media ? (
                  <>
                    <YouTubeLinks links={ytLinks} />
                    {clips.length ? (
                      <ul className="x-clips">
                        {clips.map((v) => (
                          <li key={v.id}>
                            <video
                              className="x-clip"
                              src={v.src}
                              poster={v.poster}
                              controls
                              muted
                              playsInline
                              preload="none"
                              aria-label={v.alt}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : null}
              </article>
            );
          })}
        </div>

        <div className="x-j-frame">
          <PhotoWave photos={photos} />
        </div>
      </div>
    </section>
  );
}
