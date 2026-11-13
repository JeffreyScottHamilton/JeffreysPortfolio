"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Heading lines with the trailing period rendered as the red accent. */
export function AccentLines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((l, i) => {
        const dot = l.endsWith(".");
        return (
          <span className="x-line" key={i}>
            {dot ? l.slice(0, -1) : l}
            {dot ? <span className="dot-accent">.</span> : null}
          </span>
        );
      })}
    </>
  );
}

/**
 * Large outlined italic numeral drawn with a dotted stroke (SVG text with a
 * round-capped zero-length dash). The viewBox is fitted to the measured text
 * so it scales inside its column without clipping.
 */
export function DottedYear({
  text,
  arrow,
  label,
}: {
  /** e.g. ["2023", "2024"] renders 2023 → 2024 with a red arrow */
  text: string[];
  arrow?: boolean;
  label: string;
}) {
  const ref = useRef<SVGTextElement>(null);
  const chars = text.join("").length + (arrow ? 1.4 : 0);
  const [box, setBox] = useState({ x: -4, y: -100, w: chars * 64 + 12, h: 128 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      try {
        const b = el.getBBox();
        if (b.width > 0)
          setBox({ x: b.x - 6, y: b.y - 6, w: b.width + 12, h: b.height + 12 });
      } catch {}
    };
    fit();
    document.fonts?.ready.then(fit).catch(() => {});
  }, []);
  return (
    <p className="x-year">
      <span className="sr-only">{label}</span>
      <svg
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        style={{ aspectRatio: `${box.w} / ${box.h}` }}
        aria-hidden="true"
        focusable="false"
      >
        <text ref={ref} x="0" y="0" className="x-year-text">
          {text.map((t, i) => (
            <tspan key={i}>
              {i > 0 && arrow ? (
                <tspan className="x-year-arrow" dx="10">
                  {"→"}
                </tspan>
              ) : null}
              <tspan dx={i > 0 ? 10 : 0}>{t}</tspan>
            </tspan>
          ))}
        </text>
      </svg>
    </p>
  );
}

export function YouTubeIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * 0.72}
      viewBox="0 0 28 20"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0" y="0" width="28" height="20" rx="5" fill="currentColor" />
      <path d="M11 5.5v9l8-4.5z" fill="var(--bg)" />
    </svg>
  );
}

export function ExternalLink({
  href,
  children,
  className = "",
  label,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <a
      href={href}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
    >
      {children}
    </a>
  );
}

export function YouTubeLinks({
  links,
  className = "",
}: {
  links: { href: string; name: string }[];
  className?: string;
}) {
  return (
    <ul className={`x-yt ${className}`}>
      {links.map((l) => (
        <li key={l.href}>
          <ExternalLink
            href={l.href}
            className="x-yt-link"
            label={`${l.name} on YouTube (opens in a new tab)`}
          >
            <YouTubeIcon />
            <span className="x-yt-name">{l.name}</span>
            <span className="x-yt-arrow" aria-hidden="true">
              {"↗"}
            </span>
          </ExternalLink>
        </li>
      ))}
    </ul>
  );
}
