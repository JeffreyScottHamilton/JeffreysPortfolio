"use client";
import type { Mode } from "./context";

export default function Header({
  mode,
  onMode,
  disabled,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
  disabled?: boolean;
}) {
  return (
    <header className="site-header" data-intro="support">
      <nav className="mode-switch" aria-label="Portfolio mode">
        {(["work", "explore"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            disabled={disabled}
            onClick={() => onMode(m)}
          >
            {m === "work" ? "Work" : "Explore"}
          </button>
        ))}
      </nav>
    </header>
  );
}
