# Handoff — 2026-11-16 19:26

<!-- ult: branch=claude/eloquent-volta-9j3y9d head=4b1cd98 -->

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
Ask owner whether to fast-forward main to this branch (still pending). Done since: phones get a timed contact DotMorph (IntersectionObserver + play(1100); scroll scrub only ≥721px), Portrait/portrait-engine/handoff DPR capped via dprCap() (now in lib/halftone.ts, re-exported from dotText.ts). TextDots board-text dots now stir with the pointer (CPU wake mirroring HalftoneMorph's, mouse/pen only). No code items left; await owner's visual feedback

## Open questions
- Morph canvas looks ~15% brighter/softer than the live portrait at hand-off — owner to judge
