"use client";
import type { ReactNode } from "react";

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
