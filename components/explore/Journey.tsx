"use client";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Ribbon from "@/components/shared/Ribbon";
import { GLYPHS, usePortfolio } from "@/components/shared/context";
import { contact, journey } from "@/content/portfolio";
import { gallery } from "@/content/media";
import PhotoWave from "./PhotoWave";
import { YouTubeLinks } from "./parts";
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

/** how assembled chapter k's text is (1 = in place) */
function textAt(k: number, b: number, t: number) {
  let a = clamp01(1 - 2.2 * Math.abs(t - k));
  if (k === 0) a = Math.min(a, clamp01((b - 0.35) / 0.6));
  return a;
}

/* ------------------------------------------------------------ text pieces */

/** deterministic scatter for one piece of text */
function scatterer(seed: number) {
  let s = seed * 9301 + 49297;
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return (spread: number, d0: number, d1: number, order: number): CSSProperties =>
    ({
      "--dx": `${Math.round((r() - 0.6) * spread * 2)}px`,
      "--dy": `${Math.round((r() - 0.5) * spread * 1.2)}px`,
      "--r": `${Math.round((r() - 0.5) * 80)}deg`,
      "--d": (d0 + (d1 - d0) * (order * 0.6 + r() * 0.4)).toFixed(3),
    }) as CSSProperties;
}
type Scatter = ReturnType<typeof scatterer>;

function ChapterHeading({ id, lines, sc }: { id: string; lines: readonly string[]; sc: Scatter }) {
  const total = lines.join("").length || 1;
  let n = 0;
  return (
    <h3 id={id} className="x-chapter-title">
      <span className="sr-only">{lines.join(" ")}</span>
      <span aria-hidden="true">
        {lines.map((l, li) => (
          <span className="x-line" key={li}>
            {l.split(" ").map((w, wi, ws) => (
              <Fragment key={wi}>
                <span className="x-word">
                  {[...w].map((ch, ci) => {
                    const order = n++ / total;
                    const dot = ch === "." && ci === w.length - 1;
                    return (
                      <span
                        key={ci}
                        className={`x-as x-ch${dot ? " dot-accent" : ""}`}
                        style={sc(420, 0.02, 0.55, order)}
                      >
                        {ch}
                      </span>
                    );
                  })}
                </span>
                {wi < ws.length - 1 ? " " : null}
              </Fragment>
            ))}
          </span>
        ))}
      </span>
    </h3>
  );
}

function Words({
  text,
  className,
  sc,
  d0,
  d1,
}: {
  text: string;
  className: string;
  sc: Scatter;
  d0: number;
  d1: number;
}) {
  const words = text.split(" ");
  return (
    <p className={className}>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className="x-as x-w" style={sc(260, d0, d1, i / words.length)}>
            {w}
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </p>
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
  const { reducedMotion } = usePortfolio();
  const [stage, setStage] = useState(true);
  const sec = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
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
      const a = textAt(k, b, t);
      el.style.setProperty("--a", a.toFixed(4));
      el.dataset.on = a > 0.6 ? "1" : "0";
    });
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
    let ready = false;
    const update = (self: ScrollTrigger) => {
      const vh = window.innerHeight;
      const s = self.scroll() - self.start;
      const R = Math.max(1, self.end - self.start - vh);
      const b = clamp01((s - vh * 0.12) / (vh * 0.82));
      const t = chapterAt((s - vh) / R);
      target.current = t;
      if (field && ready) field.set(b, t);
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
    field
      ?.start()
      .then(() => {
        ready = true;
        update(st);
      })
      .catch(() => {});
    return () => {
      st.kill();
      trigger.current = null;
      field?.destroy();
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

        <div className="x-j-chapters">
          {CHAPTERS.map((c, i) => {
            const j = journey[i];
            if (!j) return null;
            const parts = sentences(j.text);
            const main = c.asideFrom ? parts.slice(0, -1) : parts;
            const aside = c.asideFrom ? parts.slice(-1) : [];
            const sc = scatterer(i * 7 + 3);
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
                <span className="rule-accent x-as x-blk" aria-hidden="true" style={sc(160, 0, 0.1, 0)} />
                <ChapterHeading id={`${c.id}-h`} lines={c.lines} sc={sc} />
                <Words text={main.join(" ")} className="x-chapter-text" sc={sc} d0={0.25} d1={0.8} />
                {aside.length ? (
                  <>
                    <span className="x-rule-sm x-as x-blk" aria-hidden="true" style={sc(120, 0.7, 0.8, 0)} />
                    <Words text={aside.join(" ")} className="x-chapter-aside" sc={sc} d0={0.72} d1={0.95} />
                  </>
                ) : null}
                {"media" in c && c.media ? (
                  <div className="x-as x-blk" style={sc(140, 0.75, 0.95, 0.5)}>
                    <YouTubeLinks links={ytLinks} />
                  </div>
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
