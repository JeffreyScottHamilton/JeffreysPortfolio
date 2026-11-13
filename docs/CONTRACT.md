# Rebuild contract (shared by all workers)

Source of truth for visuals: `docs/references/ref/p-NN.png` (rendered pages of the handoff PDF) and the written spec `docs/references/BUILD-PROMPT.md`. Written spec wins over images. **Match the reference compositions closely** — the previous version was rejected because it looked generic and nothing like the frames.

Key frames: p-01 Work hero (D01), p-02 Plainkit+Bedulo pair (D02), p-03/p-04 project reel (D03/D04), p-05 Work contact (D05), p-06 Explore arrival (L01), p-07..p-10 Explore journey (L02–L05, **L05/p-10 is authoritative for journey look**), p-11 Explore contact (L06), p-15/p-16 mode switch, p-17 photo wave.

Obsolete in references, never build: header chevron/dropdown, gallery dots/pause/arrows, "01 → 02 / 11" counters are allowed only as quiet labels (optional), certificate page.

## Stack
Next 16 App Router, React 19, TypeScript, GSAP + ScrollTrigger (already registered by the shell), lucide-react icons. Fira Sans (300–700 + italics) is loaded globally as `var(--font)`. No new dependencies.

## Files & ownership
| Owner | Files |
|---|---|
| Manager (done) | `components/Portfolio.tsx`, `components/shared/{context.tsx,Header.tsx,GatherText.tsx,Ribbon.tsx,ModeSweep.tsx}`, `app/*`, `content/*` |
| Portrait worker | `components/shared/Portrait.tsx`, `lib/halftone.ts` (new), `styles/portrait.css`, `public/media/portrait-alpha.png` |
| Work worker | `components/work/**`, `styles/work.css` |
| Explore worker | `components/explore/**`, `styles/explore.css` |

Never edit another owner's files. If you need a change there, report it.

## Tokens (app/globals.css)
`--bg --ink --ink-2 --ink-3 --rule --accent --dot` switch per mode (`.mode-work` / `.mode-explore` on the root div). Also `--night --ivory --vermilion --fringe-red --fringe-cyan --font --gutter --header-h --ease-out --ease-io` and the type scale `--t-display --t-h2 --t-h3 --t-lead --t-sub --t-body --t-small --t-label`. Helpers: `.dot-accent` (red period), `.rule-accent` (64×3 red rule), `.sr-only`.

## Shell behaviour (already implemented)
- Fixed header top-left: round face button (home) + Work / Explore toggle with underline. Leave ~`var(--header-h)` (96px) clear at the top of each mode's first section; don't render another header.
- `<main key={mode}>` renders `<WorkMode/>` or `<ExploreMode/>` (default exports, no props). They remount on mode change → clean up all GSAP via `gsap.context()`/`useGSAP`-style revert in effects.
- Each mode MUST render sections tagged `data-map="hero"` (with `id="top"`), `data-map="middle"` (projects / journey) and `data-map="contact"` (with `id="contact"`). The hero `h1` has `id="hero-title" tabIndex={-1}`.
- `usePortfolio()` from `components/shared/context` → `{ mode, introPlaying, introStart, reducedMotion, hydrated }`.
- Intro: the root carries `data-intro-stage = field|title|portrait|support|done`. Put `data-intro="title"` on the title, `data-intro="portrait"` on the portrait wrapper, `data-intro="support"` on supporting copy/certificates/experience. CSS handles fade/rise. Wrap the hero title text in `<GatherText text="..."/>` so letters gather.

## Shared components
```tsx
import Ribbon from "@/components/shared/Ribbon";
<Ribbon path="M-20,700 C300,620 ..." viewBox="0 0 1440 900" text="jeffrey Hamilton" textStart="10%" tone="dark" strands={7} spread={3.2} className="..."/>
```
Absolutely fills its positioned parent; dotted strands + red/cyan edge strands + optional italic letters along the path. Compose several for the flowing trails seen in the frames.

```tsx
import Portrait from "@/components/shared/Portrait";
<Portrait tone="dark"|"light" variant="halftone"|"cutout" framing="bust"|"face" interactive assemble decorative className="..."/>
```
- Fills its parent box (width/height 100%); the parent decides size/position. Image is anchored bottom-centre, "contain".
- `halftone`: dense dot + small-glyph rendering of the real photo, white-on-night (`tone="dark"`) or black-on-ivory (`tone="light"`), scattered random glyphs around the head, soft liquid pointer reveal of the registered real colour photo underneath (when `interactive`, default true for halftone; false for decorative).
- `cutout`: the real colour photo with alpha cutout (no background) and a fine stippled dotted halo/outline of black dots + a few glyphs around the silhouette (Explore journey, p-07..p-10).
- `framing="face"`: tight crop of the face side, used as the cropped portrait slice at the left edge of the project reel (p-03/p-04).
- `assemble`: dots gather in when the intro reaches the `portrait` stage.
- `decorative`: aria-hidden, no pointer interaction.

## Content
`content/portfolio.ts` (projects in exact order, certificates, contact, journey) and `content/media.ts` (portrait, gallery photos, videos). Use these; never hard-code project facts. Preview `status` is `ready|missing|planned|needs-replacement`; show honest designed placeholders for non-ready ("Preview pending", "[ Not built yet ]" for Signal surf, "Journal preview to add" for Bedulo).

## Quality bar
- Semantic HTML: sections, headings, real links (`target="_blank" rel="noopener noreferrer"` for external), buttons for actions.
- Responsive: designed at 1440×900, adapt at ≤1024 and ≤720 (stack, no horizontal overflow, 44px targets).
- `prefers-reduced-motion`: no scroll-scrubbed motion, finished states shown.
- No `transition: all`; animate transform/opacity. No React state per pointer frame.
- No console errors, no hydration warnings (no `Math.random()` during render; use seeded values).
- Don't print implementation notes in the page.

## Verify
Dev server: `npx next dev -p <your port>`; Playwright is global: `import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'`. Screenshot at 1440×900 and 390×844 and compare side by side with the reference frames. `npx tsc --noEmit` must pass.

## Round 2 additions (user feedback, Nov 13)
- **Loop (shell, done):** `components/Portfolio.tsx` jumps to `scrollY = 0` instantly when the page is scrolled to the very bottom and an element `main [data-loop-end]` exists. Each mode MUST put `data-loop-end` on its reprise and make the reprise's final frame (what's visible at max scroll) **pixel-identical to the opening at scrollY 0**: same hero layout, same positions, same portrait, so the jump is invisible. The reprise must end exactly at the document bottom (nothing after it: no footer).
- **lib/halftone.ts public exports are frozen** (`computeLayout`, `buildHalftone`, `drawSource`, `loadCutout`, `palette`, `drawField`, `Field`, `Layout`, ...). Other slices may import them read-only to build the same dot field as the portrait (e.g. Work's face→ribbon stream). The portrait slice may add exports but must not change existing signatures.
- **Motion budget is now bigger by request:** scroll-scrubbed set pieces are wanted (face → ribbon → projects; journey year built from particles). Keep everything scrubbed and reversible, with reduced-motion fallbacks showing the finished states.
