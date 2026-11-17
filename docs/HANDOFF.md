# Handoff — 2026-11-16 (session 5)

<!-- ult: branch=claude/elegant-gauss-vfguxm -->

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

## Session 5 (branch claude/elegant-gauss-vfguxm)
- Intro rebuilt (Portfolio.tsx, introDots.ts, globals.css, INTRO in context.tsx, ~2.35 s): a red seed dot pulses in at the title's centre; the name bursts out of it (title morph pre-measured so it fires on the cue) while the seed glides into the accent rule (`data-intro="rule"` on .wk-rule, hidden until it lands); the support copy pours out of the name's baseline. The page stays covered until the name has formed. Drifting FIELD_DOTS removed.
- Hero hold + scroll snap (WorkMode.tsx): the first HOLD = 0.14 of the pin keeps the hero untouched (pin lengthened to 1.7/(1-HOLD) vh so the morph keeps its length); ScrollTrigger snap: inside the hold → back to the hero, past it → finishes in the scroll direction (hero ⇄ board).
- Favicon: app/icon.svg is now a dot-matrix "JH" + red dot (legible at 16 px).
- Gallery: 8 new owner photos in public/media (classroom, nerf-war, IMG_9432, watermelon, colonial, IMG_2254, hot-tub-night, IMG_9737), HEIC converted with pillow-heif; 19 photos total.
- Evidence: `npm run build` exit 0; playwright 16/16 passed.

- About ending (Contact.tsx): arrival window is now "top bottom" → "top top" (starts as the journey's pin releases). The last chapter's copy + photo caption/hint dissolve (hide) and their dots form "Still curious" (LAST_CHAPTER); the current photo becomes coloured halftone dots that build the reprise portrait (new DotMorph side `{ picture, pick }` in dotText.ts: samples an <img> (cover-fit) or <canvas>, two-pass pitch so kept dots fill maxDots; face morph maxDots 16000). Contact run 220 → 165dvh, SWAP [0.06, 0.86], exit pin snaps (past 0.08 → finishes, loop jumps); loop hold releases at p ≥ 0.92. One wheel notch at "Still curious" → back at the top in ~2 s.

## Next unfinished step (session 4, still awaiting owner review)
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

Cursor (owner: "swirl everywhere"): components/shared/swirl.ts is one
viewport-wide fluid (lib/fluid.ts, portrait's stroke constants) fed by the
mouse; swirl.at(x, y) = soft-capped displacement (SWIRL_T 0.05 s, cap 10 px),
swirl.on(fn) redraws subscribers while it moves. Used by the HalftoneMorph
shader (field uploaded as a texture, replaces the radial stir), TextDots
(replaces Wake), DotMorph, chapterDots and yearField. Portrait engine keeps
its own fluid (same feel). SignalSurf now links to https://signal-surf.vercel.app/.
Certificate test de-flaked (waits for the intro to settle; 6/6).

Later / optional: hero pin length & TAU tuning; Bedulo lands slightly before
Plainkit; 

## Open questions
- Morph canvas looks ~15% brighter/softer than the live portrait at hand-off — owner to judge
- Finale portrait sizes probed at 5 desktop sizes; phones not re-checked visually

### Session 5b
- Work hero hold/snap slowed: snap duration 2.4–3.2 s, `sine.inOut` (WorkMode.tsx) so the copy visibly flies into the board.
- Ultimatum preview retaken from the repo's `main` branch (v0.3.0). Note: GitHub's *default* branch is still `claude/vigilant-hamilton-mit6dq` (0.2.6) — switch it to `main` in GitHub settings.
- Added `.claude/settings.json` with `CLAUDE_CODE_AUTO_COMPACT_WINDOW=200000` (Ultimatum's recommended auto-compact window).
- Contact (Work) no longer repeats "Provo, Utah" — rule then icons. The end reprise still matches the hero (loop must be pixel-identical).
- Hero pin: snap only at the ends (HOLD 0.1 springs back; last 8% finishes); the morph is scrubbed over 2.8 vh, no auto-play.
- Portrait glyphs/letters and floating characters are now code symbols (GLYPHS in context.tsx, LETTERS in lib/halftone.ts, SPARSE in HeroScene/Contact).
- Intro is now "compile" (Portfolio.tsx intro effect, INTRO/INTRO_CODE/TYPE_* in context.tsx, .intro-code/.intro-seed.is-caret in globals.css): a red caret types `new Developer("Jeffrey Hamilton");`, the typed line is the dot source for the title (IntroDots Beat.buildAt measures it once typed), the caret glides into the accent rule, and the `.wk-float` symbols spray out of the line at the portrait cue. Pre-hydration, `main` is hidden on intro boots (no ribbon flash).
- Intro v2: the code line is typed centred on screen (slower, ~4.6 s total, INTRO in context.tsx) and its dots fly up into the title; the Work/About tabs (`data-intro="nav"` in Header.tsx) form from dots on a third IntroDots beat (`form(..., nav)`), hidden by CSS until then except on mode switches. `.wk-float` symbols drift on a CSS loop (`translate`/`rotate`, vars from components/work/floatStyle.ts — deterministic per index so hero and reprise stay in lockstep; off for reduced motion).
- Removed all loose floating characters: the `.wk-float` symbols (hero + contact, their intro spray and drift, floatStyle.ts) and the portrait's ring of loose letters (halftone `letters` is now always empty; the glyph cells inside the face stay).
- About (explore) is now dark like Work: same night tokens in globals.css, portraits/halftones built with tone "dark", photo frame bg --night-2, mode sweep always fills night (ModeSweep lost `toLight`). The ivory tokens remain only for Work's paper-like accents.
