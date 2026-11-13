"use client";
import Arrival from "./Arrival";
import Contact from "./Contact";
import Journey from "./Journey";

/**
 * Explore mode (warm ivory): arrival → one pinned journey stage where a
 * particle year builds and morphs 2018 → 2022 → 2024 → now beside the single
 * auto-cycling photo frame → contact → the opening re-forms and loops.
 */
export default function ExploreMode() {
  return (
    <div className="explore">
      <Arrival />
      <Journey />
      <Contact />
    </div>
  );
}
