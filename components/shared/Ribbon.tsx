import { type CSSProperties } from "react";

/**
 * Flowing dotted ribbon of fine particles with red/cyan chromatic strands and
 * optional italic letters riding the curve (e.g. "jeffrey Hamilton").
 * Pure SVG: crisp at any DPR, zero JS per frame. Decorative only.
 *
 * `path` is an SVG path in `viewBox` coordinates. The SVG fills its
 * positioned parent (position:absolute; inset:0) unless className overrides.
 */
export default function Ribbon({
  path,
  viewBox = "0 0 1440 900",
  text,
  textStart = "8%",
  tone = "dark",
  strands = 7,
  spread = 3.2,
  className = "",
  flow = true,
  style,
}: {
  path: string;
  viewBox?: string;
  text?: string;
  textStart?: string;
  tone?: "dark" | "light";
  strands?: number;
  spread?: number;
  className?: string;
  flow?: boolean;
  style?: CSSProperties;
}) {
  const id = `rb-${hash(path + (text ?? ""))}`;
  const ink = tone === "dark" ? "var(--ink)" : "var(--ink)";
  const offsets = Array.from(
    { length: strands },
    (_, i) => (i - (strands - 1) / 2) * spread,
  );
  return (
    <svg
      className={`ribbon ${flow ? "ribbon-flow" : ""} ${className}`}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <defs>
        <path id={id} d={path} />
      </defs>
      {offsets.map((o, i) => {
        const edge = Math.abs(i - (strands - 1) / 2) / ((strands - 1) / 2 || 1);
        const color =
          i === 0
            ? "var(--fringe-red)"
            : i === strands - 1
              ? "var(--fringe-cyan)"
              : ink;
        return (
          <use
            key={i}
            href={`#${id}`}
            transform={`translate(${o * 0.35} ${o})`}
            fill="none"
            stroke={color}
            strokeWidth={i === 0 || i === strands - 1 ? 1.9 : 1.6 - edge * 0.7}
            strokeLinecap="round"
            strokeDasharray={`0 ${5 + (i % 3) * 2}`}
            opacity={
              i === 0 || i === strands - 1 ? 0.95 : 0.25 + (1 - edge) * 0.55
            }
            className="ribbon-strand"
            style={{ "--rb-speed": `${18 + i * 3}s` } as CSSProperties}
          />
        );
      })}
      {text ? (
        <text className="ribbon-text" fill="var(--ink)">
          <textPath href={`#${id}`} startOffset={textStart}>
            {[...text].join("  ")}
          </textPath>
        </text>
      ) : null}
    </svg>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
