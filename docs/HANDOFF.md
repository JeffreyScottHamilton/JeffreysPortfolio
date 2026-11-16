# Handoff — 2026-11-16 (session 3)

<!-- ult: branch=claude/practical-keller-1v2o25 head=366e3aa (main = 366e3aa) -->

## Goal
Jeffrey Hamilton portfolio (Next 16 + GSAP + canvas/WebGL halftone). Two modes: Work (dark) and About (light, internal id 'explore'). Iterate on owner's visual feedback.

## Decisions (with why)
- Text never fades/slides: all text enters/leaves via dots — components/shared/dotText.ts (DotMorph, play)
- Work hero→board (HalftoneMorph.ts, driven from WorkMode.tsx): hero copy dissolves into dots that fly into the **Plainkit** card (DotMorph `to: { points: morph.cardPoints() }`, re-aimed via `onBuilt`); the face's lattice becomes **Bedulo**; Plainkit's lattice dots grow in on a front from the copy (PK0 0.625 → p ≈ 0.22–0.40). absorb.ts only pulls certificates/experience into the face (p 0–0.08). TextDots.ts forms board text from dots.
- Hero timeline (HalftoneMorph consts + header): morph 0.04–0.40, resolve 0.40–0.52, glide 0.52–0.64, rows 0.66–0.95. Pin `innerHeight * 1.7` (was 2.6) in WorkMode.tsx.
- Hero inertia: WorkMode.tsx follows pin progress with an exponential approach (TAU 0.35 s); jumps > 0.6 (loop to top, focus jump, refresh) snap so the loop never plays backwards.
- Pointer stir (HalftoneMorph shader `stir()` + TextDots `Wake`): radial parting only, STIR_R 70, STIR_MAX 12, STIR_CAP 8, STIR_TAU 200 ms; per-frame offset so dots settle back. Portrait fluid (lib/portrait-engine.ts) left as is.
- Loop end (Finale.ts): head glides onto the opening head first (q 0.05–0.45), portraits swap only once aligned (0.45–0.56), then "Let's build something useful." re-forms as "Jeffrey Hamilton" (0.50–0.92), rest of hero 0.56–1. Portfolio.tsx jumps to top at page bottom ([data-loop-end]); end frame must match the opening.
- Mode switch always restarts at top (dot-dissolve ModeSweep + short intro replay); first-visit intro ~3 s
- Portrait: lib/halftone.ts (static dots, computeLayout head mapping), lib/portrait-engine.ts + lib/fluid.ts
- About: yearField.ts, chapterDots.ts, handoff.ts, PhotoWave.tsx. Photo click (or hidden "Next photo" button) advances now; one-time hint "Click/Tap the photo for the next one →" forms from dots when first in view, dissolves on first click (localStorage `photo-wave-hint-seen`).
- Content: content/portfolio.ts (12 projects, 11 certificates). Bulletin and SignalSurf now have owner-supplied previews (public/previews/bulletin.png, signalsurf.png); SignalSurf is "built" (no live URL yet, title not linked).
- Owner preferences: no videos/screenshot sheets unless asked; short reports; one helper at a time; save tokens

## Changed files
- (working tree clean; everything merged to main at 366e3aa)

## Evidence (commands run, exit codes)
- Session 3 final: `npm run build` exit 0; `CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npx playwright test --trace off` → 16/16 passed
- Fresh container needs `npm ci` first (next not found otherwise). Kill stale `next start` before re-probing after a rebuild (old server serves 404 CSS).
- Certificate test (`certificate: click opens it…`) is flaky independent of session-3 changes: 1/6 fails on pre-change code; orbiting button moves between boundingBox and click.

## Next unfinished step
Owner feedback (2026-11-16, end of session 3), do in this order:

1. **Loop end/beginning still don't match: the end (dark) frame is smaller
   than the big opening.** At 1440×900 the reprise portrait/title rects match
   the opening exactly (probe: hero portrait [504,172,806,664] = reprise), so
   it is probably viewport-dependent. First probe other sizes (1920×1080,
   1536×864, 1366×768, 1280×720): compare `.wk-hero:not(.wk-hero-reprise)`
   portrait/title rects at scrollY 0 vs `.wk-hero-reprise` at max scroll, and
   the contact portrait at Finale q≈0.5 (after glide). Also check whether
   "smaller" means the contact bust (Finale glide maps head centre + radius
   only; the contact box aspect differs, 864×729 vs 806×664) and fix so the
   whole end frame is the same size as the opening before the loop jump.
2. **Icons turn into dots.** Icons (certificate orbit buttons `.wk-cert-btn`
   / `.wk-selected > svg` in the hero, contact link icons
   `.wk-contact-links li` in Finale) are moved as whole pieces by absorb.ts.
   Owner wants them to dissolve into / form from a bunch of dots instead.
   sampleText (dotText.ts) already samples inline SVG icons, so likely swap
   the Absorb pieces for DotMorph (text side = the icon elements, other side =
   faceRegion). Keep reversibility. Applies in WorkMode hero (p 0–0.08) and
   Finale (out 0–0.38, inn 0.56–1).
3. **Whole site gets the opening's deceleration.** The hero pin uses an
   inertial follow (WorkMode.tsx `follow`/`jump`, TAU 0.35 s, snap on jumps
   > 0.6). Apply the same to every other scroll-scrubbed piece: Finale pin,
   About (ExploreMode/Journey stages, yearField, chapterDots, handoff.ts),
   board TextDots, etc. Best: factor a shared helper (e.g.
   components/shared/inertia.ts) and use it in each ScrollTrigger onUpdate.
   Keep the loop jump and mode switch instant (snap).

Later / optional: hero pin length & TAU tuning; Bedulo lands slightly before
Plainkit; SignalSurf live URL; de-flake the certificate test.

## Open questions
- Morph canvas looks ~15% brighter/softer than the live portrait at hand-off — owner to judge
- Finale re-sequencing only checked at 1440×900
