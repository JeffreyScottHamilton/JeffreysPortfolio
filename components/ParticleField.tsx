import ParticleSurface from "./ParticleSurface";
export default function ParticleField({
  className = "",
}: {
  className?: string;
}) {
  return <ParticleSurface className={`particle-field ${className}`} />;
}
