# Handoff — 2026-11-16 (session 4)

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
- Session 4 (branch claude/wonderful-volta-apox1j): components/work/{Finale.ts,WorkMode.tsx,absorb.ts,HalftoneMorph.ts}, components/shared/{dotText.ts,inertia.ts}, components/explore/{Contact.tsx,yearField.ts}, components/Portfolio.tsx, styles/work.css

## Evidence (commands run, exit codes)
- Session 4 final: `npm run build` exit 0; playwright 16/16 passed
- Session 3 final: `npm run build` exit 0; `CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npx playwright test --trace off` → 16/16 passed
- Fresh container needs `npm ci` first (next not found otherwise). Kill stale `next start` before re-probing after a rebuild (old server serves 404 CSS).
- Certificate test (`certificate: click opens it…`) is flaky independent of session-3 changes: 1/6 fails on pre-change code; orbiting button moves between boundingBox and click.

## Next unfinished step
Session 4 did items 1–3 of the owner's 2026-11-16 feedback (awaiting owner review):

1. Loop end size: the Finale glide scaled the contact portrait (×0.79–0.97
   depending on viewport), shrinking its dots. Finale.measure now gives the
   contact portrait the hero portrait's box (same bottom-centre), so the glide
   is a pure whole-pixel translation at scale 1 (checked 1280×720 … 1920×1080).
2. Icons → dots: Absorb is gone. Hero icons (`.wk-selected > svg`,
   `.wk-cert-btn`) are a DotMorph into the face (p 0–0.08); contact link icons
   join Finale's tOut, reprise icons join tIn. dotText samples an svg passed
   directly and draws small framed boxes' borders as dots.
3. Shared deceleration: components/shared/inertia.ts (TAU 0.35 s, snap on big
   jumps) drives the hero pin, contact arrival, Finale pin and About contact
   (arrival + exit timeline, was scrub 0.4); yearField's default tau = TAU
   (chapter dots / handoff follow it). The loop jump waits for the reprise to
   land: `data-loop-hold` on [data-loop-end] (Portfolio.tsx).

Owner follow-up (same day): ending too long, face moved/grew, icons went
into the face. Now: Finale has no face detour. Two DotMorphs over the whole
pin, title→title and rest of contact (text + link icons)→rest of opening
(text + icons), all at once. The contact portrait sits in the hero portrait's
exact box (desktop: zero motion; phones: same size, slides up 0–0.5, then
swaps). Finale pin 0.7→0.45×innerHeight. Loop test threshold 2000→1500 px
(page is shorter).

Later / optional: hero pin length & TAU tuning; Bedulo lands slightly before
Plainkit; SignalSurf live URL; de-flake the certificate test.

## Open questions
- Morph canvas looks ~15% brighter/softer than the live portrait at hand-off — owner to judge
- Finale portrait sizes probed at 5 desktop sizes; phones not re-checked visually
