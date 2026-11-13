"use client";
import type { Mode } from "./context";

export default function Header({
  mode,
  onMode,
  onHome,
  disabled,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
  onHome: () => void;
  disabled?: boolean;
}) {
  return (
    <header className="site-header" data-intro="support">
      <button
        type="button"
        className="home-face"
        onClick={onHome}
        aria-label="Back to the start"
        title="Back to the start"
      >
        <img src="/media/avatar.jpg" alt="" width={44} height={44} />
      </button>
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
