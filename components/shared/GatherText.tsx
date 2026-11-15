"use client";
import { Fragment, type CSSProperties } from "react";

/**
 * Renders text as real DOM letter spans (layout hooks for the titles; the
 * letters never move on their own: titles form from / dissolve into dots,
 * see components/shared/dotText.ts). Screen readers get the plain string via
 * aria-label on the wrapper.
 */
export default function GatherText({
  text,
  className,
  seed = 1,
}: {
  text: string;
  className?: string;
  seed?: number;
}) {
  let s = seed * 9301 + 49297;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const words = text.split(" ");
  let i = 0;
  return (
    <span className={`gather ${className ?? ""}`} aria-label={text} role="text">
      {words.map((w, wi) => (
        <Fragment key={wi}>
          <span className="gather-word" aria-hidden="true">
            {[...w].map((ch) => {
              const k = i++;
              const style = {
                "--gx": `${(rnd() - 0.5) * 360}px`,
                "--gy": `${(rnd() - 0.5) * 260}px`,
                "--gr": `${(rnd() - 0.5) * 110}deg`,
                "--gd": `${k * 26 + Math.round(rnd() * 60)}ms`,
              } as CSSProperties;
              return (
                <span className="gather-ch" style={style} key={k}>
                  {ch}
                </span>
              );
            })}
          </span>
          {wi < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </span>
  );
}
