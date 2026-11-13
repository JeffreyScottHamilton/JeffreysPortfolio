const random = (n: number) => {
  let value = n | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
};
export default function ParticleField({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      className={`particle-field ${className}`}
      viewBox="0 0 1000 800"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {Array.from({ length: 390 }, (_, i) => {
        const x = random(i + 1) * 1000,
          y = random(i + 700) * 800,
          opacity = 0.12 + random(i + 300) * 0.4;
        return i % 16 === 0 ? (
          <text
            key={i}
            x={x}
            y={y}
            fontSize={7 + random(i + 400) * 5}
            opacity={opacity}
          >
            {"AqKz74%#?"[i % 9]}
          </text>
        ) : (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={random(i + 20) * 0.7 + 0.2}
            opacity={opacity}
          />
        );
      })}
    </svg>
  );
}
