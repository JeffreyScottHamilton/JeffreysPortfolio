# Implementation notes

## November 13, 2026 — visual rebuild

The previous version was rejected as not looking like the reference frames. The presentation layer was rebuilt; content (`content/*`) and real media were kept.

**Portrait.** The face is now a *still*, dense halftone (≈2.2–3 px pitch, radius by luminance with local-contrast boost) drawn once to an offscreen canvas — nothing drifts at rest, matching D01/L01/L06. Tiny glyphs appear only in flat mid-tones so eyes/teeth/brows stay intact. Pointer movement opens a soft metaball "liquid" reveal of the real photo; photo and dots are drawn through one shared `drawSource` mapping, so registration is exact (block-correlation peak at zero offset). Dots at the blob edge are pushed outward with red/cyan fringes and re-settle in ~600 ms. Touch: one brief reveal per tap. Reduced motion: no reveal. No canvas: masked `<img>` fallback. New cutout matte from the original photo (BiRefNet); the finest flyaway hairs are a bit softer than in the photo.

**Motion budget.** Only: intro (~1.85 s, once per visit, skippable, off under reduced motion), slow dash flow on dotted ribbons, subtle reel row reveal, certificate hover, pointer reveal, 900 ms photo glyph wave, 700 ms mode sweep, and the scroll reprise (scrubbed, reversible, no programmatic jump).

**Mode switch.** Sweep paints the new tone behind a glyph band; content swaps at the midpoint; the shell then scrolls to the equivalent `data-map` section (hero / middle / contact). Mode persists in sessionStorage for the visit.

**Copy.** Project one-liners use the reference wording (`components/work/Projects.tsx` SHORT map); full descriptions remain in content and in preview alt text. Journey headings follow the frames but only state facts from the spec.

**Typeface.** Fira Sans (OFL, via @fontsource, self-hosted at build) — closest available match to the frames' humanist sans and italics.

**Obsolete reference details not built:** header chevron/dropdown, gallery dots / pause / arrows, certificate screen, generated app UI redraws.

## Verification (this pass)
- `npm run typecheck` → 0; `npm run build` → 0 (static `/`).
- `npm test` → 10 passed: header, 11-project order, 9 certificates + focus labels, contact links, no `href="#"`, mode switch + persistence + home, gallery cycles all 14 photos and wraps with one gallery, no overflow at 390/768/1440 in both modes, intro once + skip + reduced motion, no-canvas fallback.
- Screenshots compared against the handoff frames: `docs/review/`.
