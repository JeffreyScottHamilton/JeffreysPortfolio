# Jeffrey Hamilton portfolio

Next.js 16 (App Router) + TypeScript + GSAP ScrollTrigger + Canvas 2D. Static site, no backend, no environment variables.

Two modes share one header (round face = back to start, Work / Explore toggle):

- **Work** (near-black): hero with a still dot-and-glyph halftone portrait and a nine-certificate arc, the Plainkit / Bedulo pair, a vertical reel of perspective preview strips, contact, and a scroll reprise back into the opening.
- **Explore** (warm ivory): arrival, one continuous journey (2018 → Now) with a sticky colour cutout and ONE photo frame that cycles every photo with a random-glyph wave, contact, and reprise.

## Run

Node 20.9+:

```sh
npm ci
npm run dev        # http://localhost:3000
npm run build && npm start
```

## Verify

```sh
npm run typecheck
npm run build
npm test           # Playwright; starts `next start` itself, so build first
```

Tests use Playwright's bundled Chromium. To use another binary set `CHROMIUM_PATH=/path/to/chrome`.

## Where things live

| Path | What |
|---|---|
| `content/portfolio.ts` | Projects (exact order), certificates, contact links, journey copy |
| `content/media.ts` | Portrait, gallery photos, videos — alt text, focal point, status |
| `components/Portfolio.tsx` | Shell: header, mode state, intro, mode sweep, context mapping |
| `components/shared/` | Header, Portrait, Ribbon, GatherText, ModeSweep, context |
| `components/work/`, `styles/work.css` | Work mode |
| `components/explore/`, `styles/explore.css` | Explore mode |
| `lib/halftone.ts`, `lib/portrait-engine.ts` | Halftone builder and pointer-reveal renderer |
| `ASSETS-TO-ADD.md` | What still needs to be supplied |
| `docs/references/` | The visual handoff PDF and build prompt; `docs/review/` current screenshots |
