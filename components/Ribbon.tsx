import type { SceneMotion } from "@/lib/scene-motion";
import ParticleSurface from "./ParticleSurface";
export default function Ribbon({
  className = "",
  continuous = false,
  motion,
}: {
  className?: string;
  continuous?: boolean;
  motion?: SceneMotion;
}) {
  return (
    <ParticleSurface
      className={`ribbon ${className}`}
      ribbon
      continuous={continuous}
      motion={motion}
    />
  );
}
