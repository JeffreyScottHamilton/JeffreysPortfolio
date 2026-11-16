# Handoff — 2026-11-16 (session 2)

<!-- ult: branch=claude/handoff-continuation-t4flaa head=5b8f73f (main fast-forwarded to 5b8f73f) -->

## Goal
Jeffrey Hamilton portfolio (Next 16 + GSAP + canvas/WebGL halftone). Two modes: Work (dark) and About (light, internal id 'explore'). Iterate on owner's visual feedback.

## Decisions (with why)
- Text never fades/slides: all text enters/leaves via dots — components/shared/dotText.ts (DotMorph, play)
- Work hero→board: HalftoneMorph.ts (WebGL face→cards morph, pointer-reactive), absorb.ts (hero text into dots), TextDots.ts (board text from dots), Finale.ts (contact→opening in place)
- Loop: Portfolio.tsx jumps to top at page bottom when main [data-loop-end] exists; end frame must match the opening
- Mode switch always restarts at top (dot-dissolve ModeSweep + short intro replay); first-visit intro ~3 s
- Portrait: lib/halftone.ts (static dots, cropFade edge dissolve), lib/portrait-engine.ts + lib/fluid.ts (fluid-sim reveal, aura)
- About: journey stage with yearField.ts year sculpture, chapterDots.ts, handoff.ts (face→2018), PhotoWave.tsx sand/rain photo transition, 11 gallery photos
- Content in content/portfolio.ts (12 projects incl. SprintDeck, 11 certificates; Claude 101/Claude Code 101 PDFs in public/certificates/) and content/media.ts
- Owner preferences: no videos/screenshot sheets unless asked; short reports; one helper at a time; save tokens

## Changed files
- (working tree clean)

## Evidence (commands run, exit codes, log refs)
- `npm run build` → exit 0 (log `run-20261115-025038-ffed`)
- `npm run build` → exit 0 (log `run-20261116-190417-41df`)
- `npx playwright test` → exit 0 (log `run-20261116-190432-e44c`)
- `npm run build` → exit 0 (log `run-20261116-191851-b8d1`)
- `npm run build` → exit 0 (log `run-20261116-192508-273f`)
- `npx playwright test` → exit 0 (log `run-20261116-192513-4d51`)
- npm run build exit 0; Playwright 15/15 passed (CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npx playwright test, after npm run build)
- 2026-11-16: build exit 0; Playwright 15/15 (one flaky certificate test passed on rerun) on claude/handoff-continuation-t4flaa; again 15/15 after TextDots pointer stir
- 2026-11-16 (session 3, branch claude/practical-keller-1v2o25): step 1 done — build exit 0, Playwright 15/15
- session 3: step 2 first pass — build exit 0, tsc clean, Playwright 14/15 then the certificate test (known flaky, popup timeout) failed 1 of 3 isolated reruns, passed 2
- Branch claude/eloquent-volta-9j3y9d pushed; main last fast-forwarded at 7546999 — newer rounds not yet on main

## Next unfinished step
Owner feedback (2026-11-16), do in this order:

1. ~~Pointer stir pulls the face apart~~ — DONE (session 3): stir is now a radial
   parting only (no velocity drag / vortex), STIR_R 70, STIR_MAX 12, STIR_CAP 8,
   STIR_TAU 200 ms, in HalftoneMorph.ts shader and TextDots.ts Wake. Offset is
   per-frame, so dots settle to their position at current p. Portrait fluid left
   as is (4.5 px soft cap, dye-tail only). Owner to judge feel.
2. Split morph — FIRST PASS DONE (session 3), awaiting owner's verdict:
   hero copy → DotMorph `to: { points: morph.cardPoints() }` (Plainkit's ink
   dots, re-aimed via `onBuilt` once the lattice is built); face → Bedulo on
   the lattice; Plainkit lattice dots get a front from the copy's centroid,
   delay in [PK0 0.625, 1] so they grow in at p ≈ 0.22–0.40. Absorb now only
   pulls certificates/experience into the face (p 0–0.08). Pin 2.6 → 1.7 vh.
   Timeline: morph 0.04–0.40, resolve 0.40–0.52, glide 0.52–0.64, rows
   0.66–0.95 (HalftoneMorph.ts consts + header). Next: tune with the owner
   (pin length, Plainkit growing in later than Bedulo finishes).

3. About photos (session 3, done): clicking the photo (or hidden "Next photo"
   button) advances now (PhotoWave.tsx advanceRef / s.want); a one-time hint
   "Click/Tap the photo for the next one →" forms from dots when the frame is
   first in view and dissolves on the first click (localStorage
   photo-wave-hint-seen). New Playwright test covers it (16 tests now).
   Certificate test is flaky independent of these changes (1/6 fails on the
   pre-step-2 code too): the orbiting button moves between boundingBox and click.

4. Hero morph inertia (session 3, done): WorkMode.tsx follows pin progress
   with an exponential approach (TAU 0.35 s) instead of 1:1; jumps > 0.6
   (loop to top, focus jump, refresh) snap. Build 0, Playwright 16/16.

5. Loop end lines up (session 3, done): Finale.ts re-sequenced — contact head
   glides onto the opening head (q 0.05–0.45), portraits swap only once
   aligned (0.45–0.56, no double face), then "Let's build something useful."
   re-forms as "Jeffrey Hamilton" (0.50–0.92), rest of hero 0.56–1.

## Open questions
- Morph canvas looks ~15% brighter/softer than the live portrait at hand-off — owner to judge
