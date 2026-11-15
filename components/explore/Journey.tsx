"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Ribbon from "@/components/shared/Ribbon";
import { GLYPHS, usePortfolio } from "@/components/shared/context";
import { contact, journey } from "@/content/portfolio";
import { gallery } from "@/content/media";
import PhotoWave from "./PhotoWave";
import { AccentLines, YouTubeLinks } from "./parts";
import { ChapterDots, chapterAlpha } from "./chapterDots";
import { buildHandoffSource, type HandoffSource } from "./handoff";
import { YearField, type YearSpec } from "./yearField";

/**
 * Presentation for each chapter of `journey` (content/portfolio.ts).
 * Headline lines follow the reference frames and only restate facts from the
 * content; prose comes from the content text. `asideFrom` splits the last
 * sentence into the small second note shown under a short rule.
 */
const CHAPTERS = [
  {
    id: "ch-2018",
    year: { text: "2018" },
    lines: ["An egg business", "was the beginning."],
    asideFrom: 0,
  },
  {
    id: "ch-2022",
    year: { text: "2022" },
    lines: ["YouTube.", "Blender.", "Little games."],
    asideFrom: 0,
    media: true,
  },
  {
    id: "ch-2024",
    year: { text: "2023", after: "24" },
    lines: ["New place.", "New people."],
    asideFrom: 1,
  },
  {
    id: "ch-now",
    year: { text: "now", weight: 500 },
    lines: ["Still close.", "Still creating."],
    asideFrom: 2,
  },
] as const satisfies readonly {
  id: string;
  year: YearSpec;
  lines: readonly string[];
  asideFrom: number;
  media?: boolean;
}[];

const YEARS: YearSpec[] = CHAPTERS.map((c) => ({ ...c.year }));
const LAST = CHAPTERS.length - 1;

function sentences(text: string) {
  return text.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [text];
}

const photos = gallery.filter((g) => g.status === "ready" && g.src);
const ytLinks = [
  { href: contact.youtube, name: "Jeffrey_Creates" },
  { href: contact.vr, name: "JeffreyVR6399" },
];

/* ------------------------------------------------------------ scrub maths */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => v * v * (3 - 2 * v);

/** pinned progress 0..1 → chapter position 0..LAST with rests on each year */
function chapterAt(P: number) {
  const raw = clamp01(P) * LAST;
  const k = Math.min(LAST - 1, Math.floor(raw));
  const f = raw - k;
  return k + smooth(clamp01((f - 0.22) / 0.56));
}

/* ------------------------------------------------------------ text pieces */

function ChapterHeading({ id, lines }: { id: string; lines: readonly string[] }) {
  return (
    <h3 id={id} className="x-chapter-title">
      <span className="sr-only">{lines.join(" ")}</span>
      <span aria-hidden="true">
        <AccentLines lines={[...lines]} />
      </span>
    </h3>
  );
}

/** Small dot year for the stacked layout: builds once when it scrolls in. */
function MiniYear({ spec, label }: { spec: YearSpec; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { reducedMotion } = usePortfolio();
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let field: YearField | null = null;
    let done = false;
    const io = new IntersectionObserver(
      (e) => {
        if (done || !e.some((x) => x.isIntersecting)) return;
        done = true;
        io.disconnect();
        try {
          field = new YearField(c, {
            years: [spec],
            count: 1500,
            fill: 0.9,
            boxW: 0.94,
            boxH: 0.74,
            tau: 280,
            orbit: false,
            glyphs: GLYPHS,
          });
        } catch {
          return;
        }
        const f = field;
        f.start()
          .then(() => {
            if (reducedMotion) f.set(1, 0, true);
            else {
              f.set(0, 0, true);
              requestAnimationFrame(() => f.set(1, 0));
            }
          })
          .catch(() => {});
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(c);
    return () => {
      io.disconnect();
      field?.destroy();
    };
  }, [spec, reducedMotion]);
  return (
    <p className="x-mini-year">
      <span className="sr-only">{label}</span>
      <canvas ref={ref} className="x-mini-canvas" aria-hidden="true" />
    </p>
  );
}

/* ------------------------------------------------------------ journey */

export default function Journey() {
  const { reducedMotion, introPlaying } = usePortfolio();
  const [stage, setStage] = useState(true);
  const sec = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const textCanvas = useRef<HTMLCanvasElement>(null);
  const chapterBox = useRef<HTMLDivElement>(null);
  const dots = useRef<ChapterDots | null>(null);
  const intro = useRef(introPlaying);
  useEffect(() => {
    intro.current = introPlaying;
  }, [introPlaying]);
  const chapters = useRef<(HTMLElement | null)[]>([]);
  const trigger = useRef<ScrollTrigger | null>(null);
  const target = useRef(0);

  // stacked layout on small/short screens and for reduced motion
  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 720px), (max-height: 540px)");
    const apply = () => setStage(!reducedMotion && !mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [reducedMotion]);

  const applyText = useCallback((b: number, t: number) => {
    chapters.current.forEach((el, k) => {
      if (!el) return;
      const a = chapterAlpha(k, b, t, LAST);
      el.style.setProperty("--a", a.toFixed(4));
      el.dataset.on = a > 0.6 ? "1" : "0";
    });
    dots.current?.update(b, t);
  }, []);

  /** scroll position at which chapter k rests */
  const chapterY = (k: number) => {
    const st = trigger.current;
    if (!st) return null;
    const vh = window.innerHeight;
    const R = st.end - st.start - vh;
    return Math.round(st.start + vh + (R * k) / LAST);
  };

  useEffect(() => {
    const el = sec.current;
    const cv = canvas.current;
    if (!stage || !el) {
      chapters.current.forEach((c) => {
        c?.style.removeProperty("--a");
        if (c) delete c.dataset.on;
      });
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    let field: YearField | null = null;
    try {
      if (cv)
        field = new YearField(cv, {
          years: YEARS,
          count: 4200,
          glyphs: GLYPHS,
          onFrame: applyText,
        });
    } catch {
      field = null;
    }
    // the chapter text is carried by one persistent set of dots
    const tc = textCanvas.current;
    const box = chapterBox.current;
    let cd: ChapterDots | null = null;
    let lastBT: [number, number] = [0, 0];
    if (tc && box) {
      cd = new ChapterDots(
        tc,
        box,
        chapters.current.filter((c): c is HTMLElement => !!c),
      );
      dots.current = cd;
    }
    const measure = () => {
      cd?.measure()
        .then(() => cd?.update(...lastBT))
        .catch(() => {});
    };
    measure();
    let measureTimer = 0;
    const boxRo =
      cd && box
        ? new ResizeObserver(() => {
            clearTimeout(measureTimer);
            measureTimer = window.setTimeout(measure, 200);
          })
        : null;
    let ready = false;
    let lastS: number | null = null;
    const update = (self: ScrollTrigger) => {
      const vh = window.innerHeight;
      const s = self.scroll() - self.start;
      const R = Math.max(1, self.end - self.start - vh);
      const b = clamp01((s - vh * 0.12) / (vh * 0.82));
      const t = chapterAt((s - vh) / R);
      target.current = t;
      lastBT = [b, t];
      // a jump (loop back to the top, anchor link) snaps instead of replaying
      const jump = lastS !== null && Math.abs(s - lastS) > vh * 1.2;
      lastS = s;
      if (field && ready) field.set(b, t, jump);
      else applyText(b, t);
    };
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top bottom",
      end: "bottom bottom",
      onUpdate: update,
      onRefresh: update,
    });
    trigger.current = st;
    update(st);
    // face → year hand-off: the arrival portrait's dots travel into the
    // first year; the copy's dots become the first chapter's text
    const arrival = document.getElementById("top");
    const ov = overlay.current;
    let src: HandoffSource | null = null;
    let alive = true;
    let buildTimer = 0;
    const onState = (b: number, active: boolean) => {
      if (!src) return;
      const hide = active || b > 0.0005;
      src.portrait.style.visibility = hide ? "hidden" : "";
      const op = hide ? (1 - smooth(clamp01(b / 0.05))).toFixed(3) : "";
      src.copy.forEach((e) => (e.style.opacity = op));
    };
    const restore = () => {
      if (!src) return;
      src.portrait.style.visibility = "";
      src.copy.forEach((e) => (e.style.opacity = ""));
    };
    const buildSource = () => {
      clearTimeout(buildTimer);
      buildTimer = window.setTimeout(() => {
        if (!alive || !field || !arrival || !ov) return;
        if (intro.current) {
          buildSource();
          return;
        }
        buildHandoffSource(arrival, 4200)
          .then((h) => {
            if (!alive || !field) return;
            restore();
            src = h;
            field.setHandoff(h, ov, onState);
            return cd?.setSource(arrival);
          })
          .catch(() => {});
      }, 300);
    };
    const ro = arrival ? new ResizeObserver(buildSource) : null;
    field
      ?.start()
      .then(() => {
        ready = true;
        update(st);
        if (arrival) ro?.observe(arrival);
        if (box) boxRo?.observe(box);
      })
      .catch(() => {});
    return () => {
      alive = false;
      clearTimeout(buildTimer);
      clearTimeout(measureTimer);
      ro?.disconnect();
      boxRo?.disconnect();
      cd?.destroy();
      dots.current = null;
      st.kill();
      trigger.current = null;
      field?.destroy();
      restore();
      if (ov) ov.style.display = "none";
    };
  }, [stage, applyText]);

  // keyboard focus inside a chapter that isn't showing brings it forward
  const onFocus = (k: number) => () => {
    if (!stage || Math.round(target.current) === k) return;
    const y = chapterY(k);
    if (y !== null) window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
  };

  return (
    <section
      id="journey"
      ref={sec}
      data-map="middle"
      className={`x-journey ${stage ? "is-stage" : "is-stack"}`}
      aria-labelledby="journey-title"
    >
      <h2 id="journey-title" className="sr-only">
        How I got here
      </h2>
      {stage ? <canvas ref={overlay} className="x-handoff" aria-hidden="true" /> : null}
      {stage ? <canvas ref={textCanvas} className="x-textdots" aria-hidden="true" /> : null}
      <div className="x-j-stage">
        {stage ? (
          <div className="x-j-year" aria-hidden="true">
            <div className="x-j-orbit">
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
            </div>
            <canvas ref={canvas} className="x-j-canvas" />
          </div>
        ) : null}

        <div className="x-j-chapters" ref={chapterBox}>
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
                ref={(node) => {
                  chapters.current[i] = node;
                }}
                onFocus={onFocus(i)}
                aria-labelledby={`${c.id}-h`}
              >
                {stage ? <p className="sr-only">{j.year}</p> : <MiniYear spec={c.year} label={j.year} />}
                <span className="rule-accent" aria-hidden="true" />
                <ChapterHeading id={`${c.id}-h`} lines={c.lines} />
                <p className="x-chapter-text">{main.join(" ")}</p>
                {aside.length ? (
                  <>
                    <span className="x-rule-sm" aria-hidden="true" />
                    <p className="x-chapter-aside">{aside.join(" ")}</p>
                  </>
                ) : null}
                {"media" in c && c.media ? <YouTubeLinks links={ytLinks} /> : null}
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
