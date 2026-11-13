"use client";
import { useId } from "react";
import { useVisibleMotion } from "@/hooks/useVisibleMotion";
export default function Ribbon({ className = "" }: { className?: string }) {
  const motionRef = useVisibleMotion<SVGSVGElement>();
  const id = useId().replace(/:/g, "");
  return (
    <svg
      ref={motionRef}
      className={`ribbon ${className}`}
      viewBox="0 0 1440 600"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <path
          id={`flow-${id}`}
          d="M90 570C40 405 505 568 724 354S1455 224 1250 126 383 153 576 296 1313 323 1485 198"
        />
      </defs>
      {Array.from({ length: 15 }, (_, i) => (
        <use
          key={i}
          href={`#flow-${id}`}
          transform={`translate(0 ${i * 2.7 - 20})`}
          fill="none"
          stroke="currentColor"
          strokeWidth={i % 4 === 0 ? 1.2 : 0.8}
          strokeDasharray={`${i % 3 === 0 ? ".2 5.5" : ".1 7.5"}`}
          strokeLinecap="round"
          opacity={0.15 + (i % 4) * 0.08}
        />
      ))}
      {["#bb422f", "#65adbb"].map((color, i) => (
        <use
          key={color}
          href={`#flow-${id}`}
          transform={`translate(0 ${i ? 11 : 6})`}
          fill="none"
          stroke={color}
          strokeWidth="1"
          strokeDasharray=".2 7"
          strokeLinecap="round"
          opacity=".5"
        />
      ))}
      {[0, 1, 2].map((i) => (
        <text
          key={i}
          dy={i * 13 - 12}
          fontSize="5"
          letterSpacing="16"
          opacity=".5"
        >
          <textPath href={`#flow-${id}`} startOffset={`${i * 7}%`}>
            {"A q K z 7 4 % # ? 0 1 + x : · ".repeat(4)}
          </textPath>
        </text>
      ))}
      <text fontSize="10" dy="-32" letterSpacing="10" opacity=".6">
        <textPath href={`#flow-${id}`} startOffset="8%">
          Jeffrey Hamilton
        </textPath>
      </text>
    </svg>
  );
}
