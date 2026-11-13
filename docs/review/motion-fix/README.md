# Motion review

`before/` records commit 2a27c3a before this correction. `after/` records the current local production build, with ordinary motion enabled, in real Chromium. Desktop viewport: 1280×800; touch viewport: 390×844. Files are H.264 MP4, yuv420p, with fast-start metadata.

| Clip | What to inspect |
| --- | --- |
| `intro.mp4` | Fresh session; actual title and face particle formation, then live settled hero |
| `cursor.mp4` | No mouse button; slow/fast/direction changes, settling and leave |
| `scroll.mp4` | Hero departure, opening previews, middle/lower reel, contact |
| `mode.mp4` | Work → Explore → Work, header retained over covering curtain |
| `photos.mp4` | Two normal-speed automatic changes through the random glyph curtain |
| `photos-wrap.mp4` (after only) | Final two natural changes, including last → first; excerpt of the full capture |
| `photos-loop.mp4` (after only) | Full natural fourteen-photo cycle, including last → first; no clock acceleration |
| `return.mp4` | Contact → sampled opening typography/portrait formation, then reverse scroll |
| `phone-intro.mp4` | Fresh touch-emulated intro ending on the still portrait fallback |

There are no public debug controls or fabricated personal photographs. `scripts/record-motion.mjs` reproduces the captures against localhost:3000. Before clips retain their original navigation lead-in; after interaction clips trim the initial load wait. The fresh intro intentionally includes loading/readiness.

A downloadable archive includes this viewer and both recording sets. Open `index.html` after extracting, or serve this directory with Python as described in the project README.
