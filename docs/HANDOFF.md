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
- Branch claude/eloquent-volta-9j3y9d pushed; main last fast-forwarded at 7546999 — newer rounds not yet on main

## Next unfinished step
Owner feedback (2026-11-16), do in this order:

1. **Pointer stir pulls the face apart — looks bad.** Keep the cursor moving the
   dots, but every dot must spring back to where it belongs *for the current
   frame* (current scroll progress p), not stay smeared / dragged.
   - HalftoneMorph.ts: the wake (TRAIL samples, STIR_* consts, `stir()` in the
     vertex shader) displaces dots along pointer velocity with a vortex pair;
     STIR_CAP 16 px, STIR_TAU 420 ms. Make it a local, elastic nudge: smaller
     cap, shorter fade, push mostly radial (away from cursor) rather than
     dragged along the velocity / swirled, so it reads as "cursor parts the
     dots, they settle back" instead of pulling the face.
   - Apply the same change to the CPU twin `Wake` in TextDots.ts (added this
     session) and check the live Portrait's fluid reveal (lib/portrait-engine.ts,
     lib/fluid.ts) for the same "pulling" feel.
2. **Owner idea — split the morph to shorten scrolling:** hero *text* dots form
   the **Plainkit** card, and the *face* dots form the **Bedulo** card (instead
   of the face alone becoming both cards). Goal: less scroll distance and a
   better look.
   - Today: absorb.ts pulls the hero copy *into* the face (p 0–0.12), then the
     face lattice morphs into one combined Plainkit+Bedulo halftone
     (p 0.12–0.60); hero pin is `+=innerHeight*2.6` (WorkMode.tsx ~l.243).
   - Proposal: drop the absorb-into-face stage; run text→Plainkit (DotMorph /
     TextDots-style, from hero copy leaves to the Plainkit card halftone) and
     face→Bedulo (HalftoneMorph lattice, Bedulo half only) in parallel; then
     shorten the pin (try ~1.6–1.8 vh) and re-time the windows. Keep
     reversibility and the "text only enters/leaves via dots" rule.
   - Confirm with the owner after a first pass (one short description, no
     screenshot sheet unless asked).

## Open questions
- Morph canvas looks ~15% brighter/softer than the live portrait at hand-off — owner to judge
