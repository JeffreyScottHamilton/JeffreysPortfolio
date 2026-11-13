# Jeffrey Hamilton portfolio

Next.js App Router + TypeScript, GSAP ScrollTrigger, WebGL point sprites, and a Canvas 2D fallback. Work and Explore share a persistent minimal header, a masked, registered photo/particle portrait, and a finite scroll return. Quiet particle drift and spring-following pointer motion pause offscreen; touch and reduced motion show the real still portrait. No database or environment variables.

## Run

Node 20.9+ (Node 22 or 24 recommended):

```sh
npm ci
npm run dev
```

Open http://localhost:3000. For production: `npm run build` then `npm start`.

## Verify

```sh
npm run typecheck
npm test
npm run build
```

Browser tests use system Chromium at `/usr/bin/chromium`. On another system set `CHROMIUM_PATH` to its executable; alternatively install Playwright Chromium and adapt `playwright.config.ts`. Tests start the app automatically if needed.

## Content and assets

- `content/portfolio.ts`: exact featured order, copy, project links, certificate destinations, contacts, journey.
- `content/media.ts`: typed media provenance, alt text, focal points, status, gallery and videos.
- `ASSETS-TO-ADD.md`: precise replacement checklist.
- `IMPLEMENTATION-NOTES.md`: design decisions, limitations, and executed validation.
- `docs/review/`: updated production browser screenshots and recording.
- `docs/references/COMPLETE-VISUAL-HANDOFF-SMALL.pdf`: the supplied 18-page visual reference.

A missing image gets a stable intentional placeholder. A missing link is omitted. Signal surf stays explicitly planned. Certificate icons link directly to the nine verified original PDF files; replace their URLs if Drive destinations are preferred.

## Vercel

Import this repository and select **Next.js**. Root directory: repository root. Install: `npm ci`. Build: `npm run build`. Output: Next.js default. No environment variables or external services required. Deployment is owner-managed; importing and deploying the repository in Vercel is not performed by the project setup.

`AGENTS.md` is automatically created by the installed Next.js development server; the repository was empty when inspected. The original Git remote remains `https://github.com/JeffreyScottHamilton/JeffreysPortfolio.git`.
