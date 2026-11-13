"use client";
/**
 * STUB — the portrait worker replaces the internals. The props API below is
 * the contract (see docs/CONTRACT.md) and must not change.
 */
import { portrait } from "@/content/media";

export type PortraitProps = {
  tone: "dark" | "light";
  variant?: "halftone" | "cutout";
  framing?: "bust" | "face";
  interactive?: boolean;
  assemble?: boolean;
  decorative?: boolean;
  className?: string;
};

export default function Portrait({
  tone,
  variant = "halftone",
  framing = "bust",
  decorative = false,
  className = "",
}: PortraitProps) {
  return (
    <div
      className={`portrait portrait-${variant} portrait-${tone} portrait-${framing} ${className}`}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : portrait.alt}
      aria-hidden={decorative || undefined}
    >
      <img
        src={portrait.src}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: "50% 100%",
          filter: variant === "halftone" ? "grayscale(1) contrast(1.3)" : undefined,
          WebkitMaskImage: `url(${portrait.maskSrc})`,
          maskImage: `url(${portrait.maskSrc})`,
          maskSize: "contain",
          maskPosition: "50% 100%",
          maskRepeat: "no-repeat",
        }}
      />
    </div>
  );
}
