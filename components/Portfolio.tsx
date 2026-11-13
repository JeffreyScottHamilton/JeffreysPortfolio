"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  ArrowUp,
  Code2,
  Gamepad2,
  Image as ImageIcon,
  Film,
  Settings,
  Plane,
  Shapes,
  House,
  Mail,
  Github,
  Linkedin,
  Youtube,
} from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  certificates,
  contact,
  journey,
  projects,
  type Project,
} from "@/content/portfolio";
import { videos } from "@/content/media";
import Portrait from "./Portrait";
import Ribbon from "./Ribbon";
import Gallery from "./Gallery";
import ParticleField from "./ParticleField";
import ModeSweep from "./ModeSweep";
import FormationTitle from "./FormationTitle";
import { createSceneMotion } from "@/lib/scene-motion";
const certificateIcons = [
  Code2,
  Code2,
  Gamepad2,
  ImageIcon,
  Film,
  Settings,
  Plane,
  Shapes,
  House,
];
function Preview({ project }: { project: Project }) {
  const [failed, setFailed] = useState(false);
  const p = project.preview;
  return (
    <div className={`preview ${p.status} preview-${project.id}`}>
      {p.src && !failed ? (
        <img
          src={p.src}
          alt={p.alt}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="preview-placeholder">
          <span className="placeholder-cross">+</span>
          <span>
            {p.status === "planned" ? "Planned project" : "Preview coming soon"}
          </span>
          <span className="placeholder-cross bottom">+</span>
        </div>
      )}
    </div>
  );
}
function ProjectInfo({ project, index }: { project: Project; index: number }) {
  return (
    <div className="project-info">
      <span className="eyebrow">
        {String(index + 1).padStart(2, "0")} / {project.category}
      </span>
      <h3>{project.name}</h3>
      <p>{project.description}</p>
      <div className="project-actions">
        {project.live && (
          <a href={project.live} target="_blank" rel="noopener noreferrer">
            Visit project <ArrowUpRight size={14} />
          </a>
        )}
        {project.source && (
          <a href={project.source} target="_blank" rel="noopener noreferrer">
            Source <ArrowUpRight size={14} />
          </a>
        )}
      </div>
    </div>
  );
}
export default function Portfolio() {
  const [chapterIndex, setChapterIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<"work" | "explore">("work");
  const [intro, setIntro] = useState(true);
  const [engineReady, setEngineReady] = useState(false),
    [titleReady, setTitleReady] = useState(false);
  const [motion] = useState(() => {
    const m = createSceneMotion();
    m.portrait = m.title = m.support = 0;
    return m;
  });
  const introTimeline = useRef<gsap.core.Timeline | null>(null);
  const modeTimeline = useRef<gsap.core.Tween | null>(null);
  const [switching, setSwitching] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const light = mode === "explore";
  function finishIntro() {
    introTimeline.current?.kill();
    motion.portrait = motion.title = motion.support = 1;
    root.current?.style.setProperty("--intro-support", "1");
    motion.notify();
    setIntro(false);
    try {
      sessionStorage.setItem("portfolio-visited", "true");
    } catch {}
  }
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("portfolio-mode");
      if (saved === "explore") setMode("explore");
      if (
        sessionStorage.getItem("portfolio-visited") ||
        matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        finishIntro();
    } catch {
      finishIntro();
    }
    setHydrated(true);
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const bypass = () => {
      if (preference.matches) finishIntro();
    };
    preference.addEventListener("change", bypass);
    return () => {
      preference.removeEventListener("change", bypass);
      introTimeline.current?.kill();
      modeTimeline.current?.kill();
    };
  }, []);
  useEffect(() => {
    if (!hydrated || !intro || !engineReady || !titleReady) return;
    const tl = gsap.timeline({
      onUpdate: () => {
        root.current?.style.setProperty(
          "--intro-support",
          String(motion.support),
        );
        motion.notify();
      },
      onComplete: finishIntro,
    });
    introTimeline.current = tl;
    tl.to(motion, { title: 1, duration: 1.0, ease: "power2.inOut" }, 0.12)
      .to(motion, { portrait: 1, duration: 1.4, ease: "power2.inOut" }, 0.48)
      .to(motion, { support: 1, duration: 0.42, ease: "power2.out" }, 1.4);
    return () => {
      tl.kill();
    };
  }, [hydrated, intro, engineReady, titleReady, motion]);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    // Keep scene durations in wall time, including on slow software-rendered browsers.
    gsap.ticker.lagSmoothing(0);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        const update = () => motion.notify();
        // One physical portrait travels into the project scene. No duplicate-head crossfade.
        const desktop = matchMedia("(min-width: 900px)").matches;
        if (!light && desktop) {
          ScrollTrigger.create({
            trigger: ".hero",
            start: "top top",
            endTrigger: ".work-section",
            end: "bottom 65%",
            pin: ".hero-visual",
            pinSpacing: false,
            invalidateOnRefresh: true,
          });
          gsap.to(".hero-visual .portrait", {
            transformPerspective: 1300,
            x: () => -innerWidth * 0.72,
            scale: 0.76,
            rotationY: 18,
            rotationZ: -2,
            y: 35,
            ease: "power2.inOut",
            scrollTrigger: {
              trigger: ".hero",
              start: "top top",
              endTrigger: ".opening-pair",
              end: "top 32%",
              scrub: 0.55,
              invalidateOnRefresh: true,
            },
          });
          gsap.to(".certificates", {
            opacity: 0,
            x: -30,
            y: 0,
            scrollTrigger: {
              trigger: ".hero",
              start: "top top",
              end: "bottom 80%",
              scrub: true,
            },
          });
          gsap.to(".hero-copy", {
            transformPerspective: 1300,
            z: -200,
            x: -180,
            y: 0,
            opacity: 0,
            rotationY: -12,
            scrollTrigger: {
              trigger: ".hero",
              start: "top top",
              end: "bottom 35%",
              scrub: 0.4,
            },
          });
          gsap.to(".hero-visual .portrait", {
            opacity: 0,
            scrollTrigger: {
              trigger: ".project-reel",
              start: "bottom 90%",
              end: "bottom 45%",
              scrub: true,
            },
          });
        }
        gsap.to(".experience", {
          opacity: 0,
          x: -80,
          y: 0,
          ease: "none",
          scrollTrigger: {
            trigger: ".hero",
            start: "top top",
            end: "bottom 80%",
            scrub: true,
          },
        });
        gsap.to(".hero-ribbon", {
          y: 0,
          x: () => innerWidth * 0.18,
          rotationZ: 0,
          scale: 1.05,
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: ".hero",
            start: "top top",
            end: "bottom top",
            scrub: 0.5,
          },
        });
        if (!light)
          gsap.fromTo(
            motion,
            { workLine: 0 },
            {
              workLine: 1,
              ease: "none",
              onUpdate: update,
              scrollTrigger: {
                trigger: ".hero",
                start: "top top",
                endTrigger: ".opening-pair",
                end: "top 28%",
                scrub: 0.55,
              },
            },
          );
        gsap.fromTo(
          ".opening-pair article",
          {
            x: () => innerWidth * 0.85,
            y: 0,
            z: -180,
            rotationY: -18,
            rotationX: 0,
            scale: 0.94,
          },
          {
            x: 0,
            y: 0,
            z: 0,
            rotationY: 0,
            rotationX: 0,
            scale: 1,
            stagger: 0.1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: ".opening-pair",
              start: "top 105%",
              end: "top 28%",
              scrub: 0.65,
            },
          },
        );
        gsap.fromTo(
          motion,
          { contactFormation: 0 },
          {
            contactFormation: 1,
            ease: "none",
            onUpdate: update,
            scrollTrigger: {
              trigger: ".contact",
              start: "top 95%",
              end: "top 20%",
              scrub: 0.4,
            },
          },
        );
        gsap.fromTo(
          motion,
          { returnFormation: 0 },
          {
            returnFormation: 1,
            ease: "none",
            onUpdate: update,
            scrollTrigger: {
              trigger: ".return-scene",
              start: "top 95%",
              end: "clamp(bottom bottom)",
              scrub: 0.4,
            },
          },
        );

        gsap.utils.toArray<HTMLElement>(".project-row").forEach((row) => {
          gsap.fromTo(
            row,
            {
              transformPerspective: 1400,
              rotateY: -12,
              rotateX: 5,
              z: -160,
              x: 180,
              y: 0,
              opacity: 0.65,
            },
            {
              rotateY: 3,
              rotateX: -1,
              z: 60,
              x: 0,
              y: 0,
              opacity: 1,
              ease: "none",
              scrollTrigger: {
                trigger: row,
                start: "top bottom",
                end: "bottom top",
                scrub: 1,
              },
            },
          );
        });
        gsap.fromTo(
          ".contact-heading",
          { opacity: 1, y: 0 },
          {
            opacity: 0.2,
            x: -30,
            y: 0,
            scrollTrigger: {
              trigger: ".return-scene",
              start: "top bottom",
              end: "top 35%",
              scrub: true,
            },
          },
        );
      }, root);
      return () => context.revert();
    });
    return () => mm.revert();
  }, [mode]);
  useEffect(() => {
    if (!light) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting)
            setChapterIndex(
              Number((entry.target as HTMLElement).dataset.chapter),
            );
      },
      { rootMargin: "-25% 0px -45% 0px" },
    );
    document.querySelectorAll(".chapter").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [light]);
  function changeMode(next: "work" | "explore") {
    if (next === mode) return;
    const contactVisible =
      document.querySelector("#contact")!.getBoundingClientRect().top <
      innerHeight * 0.6;
    const heroVisible =
      document.querySelector("#top")!.getBoundingClientRect().bottom >
      innerHeight * 0.35;
    modeTimeline.current?.kill();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setSwitching(!reduced);
    motion.modeProgress = 0;
    motion.notify();
    let swapped = false;
    const swap = () => {
      if (swapped) return;
      swapped = true;
      setMode(next);

      try {
        sessionStorage.setItem("portfolio-mode", next);
      } catch {}
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (contactVisible)
            document
              .querySelector("#contact")
              ?.scrollIntoView({ behavior: "instant" });
          else if (!heroVisible)
            document
              .querySelector("#path")
              ?.scrollIntoView({ behavior: "instant" });
          ScrollTrigger.refresh();
        }),
      );
    };
    if (reduced) {
      swap();
      motion.modeProgress = 1;
      motion.notify();
    } else
      modeTimeline.current = gsap.to(motion, {
        modeProgress: 1,
        duration: 0.84,
        ease: "none",
        onUpdate: () => {
          if (motion.modeProgress >= 0.47) swap();
          motion.notify();
        },
        onComplete: () => setSwitching(false),
      });
  }
  function home() {
    document.getElementById("top")?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    document.getElementById("hero-title")?.focus({ preventScroll: true });
  }
  return (
    <div
      ref={root}
      className={`portfolio ${mode} ${intro ? "introducing" : ""} ${switching ? "switching" : ""}`}
    >
      <a className="skip-link" href="#path">
        Skip to {light ? "the journey" : "projects"}
      </a>
      <header className="header">
        <nav aria-label="Portfolio mode">
          <button
            disabled={!hydrated}
            aria-pressed={!light}
            onClick={() => changeMode("work")}
          >
            Work
          </button>
          <button
            disabled={!hydrated}
            aria-pressed={light}
            onClick={() => changeMode("explore")}
          >
            Explore
          </button>
        </nav>
      </header>
      {intro && (
        <button className="skip-intro" onClick={finishIntro}>
          Skip intro <ArrowUpRight size={13} />
        </button>
      )}
      <ModeSweep active={switching} light={light} motion={motion} />
      <main>
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero-copy">
            <h1 id="hero-title" tabIndex={-1}>
              {light ? (
                <>
                  The person
                  <br />
                  behind the
                  <br />
                  <span>
                    projects<span className="title-dot">.</span>
                  </span>
                </>
              ) : (
                <>
                  Jeffrey
                  <br />
                  Hamilton
                </>
              )}
            </h1>
            <FormationTitle
              motion={motion}
              onReady={() => setTitleReady(true)}
            />
            <p className="eyebrow hero-kicker">
              {light
                ? "Jeffrey Hamilton / Provo, Utah"
                : "Software developer / Provo, Utah"}
            </p>
            <div className="hero-description">
              {light ? (
                <p>A little of how I got here.</p>
              ) : (
                <>
                  <p className="professional-line">
                    I turn ideas into
                    <br />
                    things you can use<span className="title-dot">.</span>
                  </p>
                  <p className="muted">Browser tools. Desktop apps. Games.</p>
                </>
              )}
            </div>
            <a className="scroll-cue" href="#path">
              <ArrowDown size={15} />
              <span>
                {light ? "A little further down" : "Selected work, below"}
              </span>
            </a>
          </div>
          <div className="hero-visual">
            {!light && (
              <div
                className="certificates"
                aria-label="Nine school certificates"
              >
                <span className="certificate-label">09 certificates</span>
                {certificates.map((c, i) => {
                  const Icon = certificateIcons[i];
                  return (
                    <a
                      key={c.id}
                      href={c.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="certificate"
                      style={
                        {
                          "--i": i,
                          "--arc": Math.abs(i - 4),
                        } as React.CSSProperties
                      }
                      aria-label={`${c.title} — ${c.date}`}
                    >
                      <Icon size={16} strokeWidth={1.25} />
                      <span className="tooltip">
                        {c.title}
                        <small>{c.date}</small>
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
            <Portrait
              light={light}
              motion={motion}
              role="hero"
              onReady={(ok) => {
                setEngineReady(true);
                if (!ok) finishIntro();
              }}
            />
          </div>
          <Ribbon className="hero-ribbon" motion={motion} />
          <ParticleField className="hero-field" />
        </section>
        {!light && (
          <div className="experience" aria-label="Current experience">
            <span>
              Software Engineering <em>Provo CAPS</em>
            </span>
            <span>
              Intern <em>Doing Business Intelligently</em>
            </span>
            <span>
              Timpview High School <em>Graduating 2027</em>
            </span>
          </div>
        )}
        {light ? (
          <section id="path" className="journey" aria-label="My journey">
            <h2 className="sr-only">A little of how I got here.</h2>
            <nav className="chapter-nav" aria-label="Journey chapters">
              {journey.map((c, i) => (
                <a
                  key={c.year}
                  href={`#chapter-${i}`}
                  aria-current={chapterIndex === i ? "step" : undefined}
                >
                  {["2018", "2022", "2023—24", "Now"][i]}
                </a>
              ))}
            </nav>
            <div className="journey-layout">
              <div className="chapters">
                {journey.map((chapter, i) => (
                  <article
                    key={chapter.year}
                    id={`chapter-${i}`}
                    data-chapter={i}
                    className="chapter"
                  >
                    <span className="chapter-year">
                      {["2018", "2022", "2023—24", "now"][i]}
                    </span>
                    <span className="eyebrow">
                      0{i + 1} / {chapter.year}
                    </span>
                    <h3>{chapter.title}</h3>
                    <p>{chapter.text}</p>
                    {i === 1 && (
                      <div className="video-pair">
                        {videos.map((v) => (
                          <figure key={v.id}>
                            <video
                              controls
                              muted
                              playsInline
                              preload="none"
                              poster={v.poster}
                              aria-label={v.alt}
                            >
                              <source src={v.src} type="video/mp4" />
                            </video>
                            <figcaption>
                              {v.id === "chest"
                                ? "Made in Blender."
                                : "A little gameplay, captured."}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
              <div className="journey-portrait">
                <ParticleField />
                <Portrait light decorative role="journey" />
                <Ribbon className="journey-ribbon" />
              </div>
              <Gallery />
            </div>
          </section>
        ) : (
          <section
            id="path"
            className="work-section"
            aria-label="Selected projects"
          >
            <div className="work-edge" aria-hidden="true">
              <div className="work-edge-inner">
                <Portrait decorative />
              </div>
            </div>
            <div className="section-heading">
              <span className="eyebrow">Selected work / 01—11</span>
              <h2>Ideas, made useful.</h2>
              <p>A few things I’ve been building.</p>
            </div>
            <div className="opening-pair">
              <Ribbon className="opening-ribbon" motion={motion} />
              {projects.slice(0, 2).map((project, i) => (
                <article key={project.id}>
                  <Preview project={project} />
                  <ProjectInfo project={project} index={i} />
                </article>
              ))}
            </div>
            <div className="project-reel">
              <Ribbon className="reel-flow" continuous />
              {projects.slice(2).map((project, i) => (
                <article className="project-row" key={project.id}>
                  <ProjectInfo project={project} index={i + 2} />
                  <Preview project={project} />
                </article>
              ))}
            </div>
          </section>
        )}
        <section
          id="contact"
          className="contact"
          aria-labelledby="contact-title"
        >
          <Ribbon className="contact-ribbon" />
          <div className="contact-layout">
            <div className="contact-copy">
              <span className="eyebrow">
                {light ? "The story keeps going" : "Have something in mind?"}
              </span>
              <h2 id="contact-title" className="contact-heading">
                {light ? (
                  <>
                    Still curious<span className="title-dot">.</span>
                  </>
                ) : (
                  <>
                    Let’s build
                    <br />
                    something useful.
                  </>
                )}
              </h2>
              <p>
                {light
                  ? "Good people. New ideas. Things worth making."
                  : "Provo, Utah."}
              </p>
              <div className="socials">
                {[
                  { name: "GitHub", href: contact.github, Icon: Github },
                  { name: "Email", href: contact.email, Icon: Mail },
                  { name: "LinkedIn", href: contact.linkedin, Icon: Linkedin },
                  ...(light
                    ? [
                        {
                          name: "YouTube",
                          href: contact.youtube,
                          Icon: Youtube,
                        },
                        {
                          name: "VR YouTube",
                          href: contact.vr,
                          Icon: Gamepad2,
                        },
                      ]
                    : []),
                ].map(({ name, href, Icon }) => (
                  <a
                    href={href}
                    key={name}
                    aria-label={name}
                    target={href.startsWith("mailto") ? undefined : "_blank"}
                    rel="noopener noreferrer"
                  >
                    <Icon size={22} strokeWidth={1.5} />
                    <span className="tooltip">{name}</span>
                  </a>
                ))}
              </div>
            </div>
            <div className="contact-portrait">
              <ParticleField />
              <Portrait light={light} motion={motion} role="contact" />
            </div>
          </div>
        </section>
        <section
          className="return-scene"
          aria-label="The opening takes shape again"
        >
          <div className="return-type" aria-hidden="true">
            <span className="eyebrow">Always something to make.</span>
            <p>
              {light ? "The person behind the projects." : "Jeffrey Hamilton."}
            </p>
          </div>
          <FormationTitle motion={motion} returning />
          <div className="return-portrait">
            <Portrait light={light} decorative motion={motion} role="return" />
          </div>
          <Ribbon className="return-ribbon" />
        </section>
      </main>
      <footer>
        <span>Jeffrey Hamilton</span>
        <span>Provo, Utah / {new Date().getFullYear()}</span>
        <a
          href="#top"
          onClick={(event) => {
            event.preventDefault();
            home();
          }}
        >
          Back to top <ArrowUp size={12} />
        </a>
      </footer>
    </div>
  );
}
