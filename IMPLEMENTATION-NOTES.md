# Implementation notes

## Repository and scope

Confirmed the connected GitHub repository `JeffreyScottHamilton/JeffreysPortfolio` through GitHub metadata and contents APIs, then cloned that exact remote. It was empty; no pre-existing instructions or application existed. Next.js generated `AGENTS.md` on first dev startup; its relevant installation and client/server guides were read. The implementation and reference refinements were prepared locally. The owner subsequently authorized pushing the completed project to this repository’s `main` branch. Vercel deployment remains owner-managed; no deployment or merge was requested.

The explicit user request controls scope. BUILD-PROMPT.md was used as the requested build specification; its request to work locally and leave deployment to the owner matches the direct instruction. No additional account access or publishing was inferred from the attachments.

## Design and interaction

- Near-black Work and warm ivory Explore, common face/home and mode controls. Original contact GitHub is retained after the owner confirmed both accounts belong to them and asked to continue.
- All eleven featured projects retain the written order. Plainkit and Bedulo open in a spacious pair, followed by nine vertical title/preview-strip rows. Screenshots show real verified products; Bulletin and Bedulo have explicit placeholders. Counterpoint is labeled a public entry view. Buddy uses the original real promotional page, not an invented desktop capture.
- The portrait uses one unchanged source photograph and crop, with a Canvas 2D photo layer beneath independently moving WebGL point sprites and glyphs. A cached Canvas 2D rendering with a smaller set of moving motes is used when WebGL is unavailable. The soft organic reveal follows the pointer; nearby glyphs displace with restrained moving-edge chromatic accents and a short fading wake. DPR is capped; quiet ambient movement is capped at 24 fps and pauses offscreen or in a hidden tab. Decorative portraits in the project rail remain still. Resize, visibility, pointer and motion listeners are cleaned up. WebGL is optional; its absence uses the animated 2D fallback, and lack of Canvas leaves the actual photo visible. Touch and reduced motion use the still photograph.
- **Portrait refinement:** the temporary oval is removed. `portrait-alpha.png` supplies an alpha-only silhouette, produced by background removal and reduced to a 68 KB mask. Only its transparency is used; every visible RGB pixel still comes from the unchanged original photograph. One explicit crop (`portraitGeometry`) drives the SVG fallback and Canvas rasterization, so features cannot shift between glyphs and photo. Cached halftone layers improve facial detail and reduce pointer-frame work. Touch/reduced motion get the same masked original photo.
- Nine restrained certificate icon links retain exact titles/dates and verified real PDF URLs. Focus/hover names; phones use two rows of 44px targets. There is no certificate screen, modal, dropdown or chevron.
- One gallery contains all nine uploaded HEICs (converted to JPEG) plus distinct recovered original portfolio photos, including the supplied karate image. Every change uses the same 900ms letter/number/symbol curtain around a six-second hold. The curtain fully covers the photo before switching. Next image is preloaded; errors have a stable fallback. Offscreen/hidden and keyboard focus pause changes; reduced motion stays still. A focus-only pause button is intentionally absent from the normal visual composition.
- Both real supplied MP4s remain local, muted, with inline playback, posters, native video controls, and no automatic audio/playback. Representative frames were extracted and inspected. The chest video is a Blender animation; the other is television gameplay, not a reference of the requested portrait interaction.
- GSAP owns scroll choreography and cleans up via scoped contexts. Native page scrolling; no competing smooth-scroll library. Contact disperses with scroll into a finite opening reprise. Reverse scroll works normally; there is no programmatic teleport, focus jump or infinite loop.
- Mode switching maps contact to contact, hero to hero and reel to journey. Mode is retained in session storage, and the intro plays once per visit with an immediate skip. Intro timing starts after hydration; meaningful server-rendered HTML is available beforehand.

## Asset/reference access

The original PDF exceeded the attachment reader limit. The owner subsequently provided the smaller 18-page handoff, now stored at `docs/references/COMPLETE-VISUAL-HANDOFF-SMALL.pdf`. All 18 pages were rendered and inspected. D01, D02, D03/D04, L01, L05 and L06 now directly guide the typography, proportions, mask, project strips and journey/contact compositions. Windows image paths in the message cannot be opened from this Linux workspace. Inline images were visually available, but their binaries were not exposed as downloadable attachments. The karate photo was recovered from the original site; the other inaccessible originals are listed by filename. No supplied HEIC or MP4 is missing.

Recovered and inspected original Slate editor, Pollly feed, Counterpoint entry, Violet Hour theme, Modrinth collection and Buddy page screenshots. The outdated light tools capture is unused. Captured the current dark Plainkit workspace and actual Ultimatum GitHub repository in Chromium. Bedulo was rechecked during refinement and resolves to its sign-in page. No sign-in image was substituted for the required journal. All nine certificate URLs returned HTTP 200 and `%PDF-` file signatures.

## Runtime

Next.js App Router, TypeScript, React, GSAP and lucide icons. Static prerendered page. No secrets, backend, database or environment variables. DM Sans and Manrope fonts are served locally, with their SIL Open Font Licenses in `public/fonts/`. No Google Fonts request occurs at runtime; system fallbacks remain available.

## Validation

See the final validation log appended below. Review screenshots/recording are in `docs/review/`.

### Executed validation (November 12, 2026, America/Denver)

- `npm run build`: passed, static prerendered `/` and standard not-found route.
- `npm run typecheck`: passed.
- Full Playwright production suite: **9 passed** (2.0 minutes). Validated exact eleven-project order; available preview loading; nine certificate labels and destinations; focus tooltips; contact link identity; mode mapping/persistence/home focus; no overflow at 390/768/1440px; 44px phone certificate targets; every gallery photo and wraparound; focus/offscreen pause; reduced motion; no Canvas support; failed photo fallback; touch behavior; pixel registration of the photo reveal at three pointer positions.
- Review capture: desktop/tablet/phone screenshots and actual WebM recording, no captured browser page errors.
- Certificate HTTP verification: all nine returned 200 and real PDF signatures.
- Shared Desktop browser startup failed; automated Chromium testing and recording succeeded.

The final idle-loop optimization was followed by another production build, typecheck, and focused portrait registration test.

## Reference refinement pass

- Replaced the thin oversized opening with the reference's bold Work name, italic professional statement, small red rule and compact experience line. Explore keeps the lighter headline, ivory field and red punctuation. The shared header now uses the reference's underline selection, with no chevron.
- Added the framed nine-certificate arc, a larger high-contrast masked halftone portrait, restrained random glyphs and curved white/red/cyan particle ribbons. Pointer reveal remains local, soft and registered; the source photograph has not been regenerated or retouched.
- Matched the opening pair's common height and flattened subsequent previews into wide perspectival strips with left-aligned titles, thin dividers, a cropped portrait at the reel edge, and breathing room across the continuous list.
- Explore now has an in-page date path, concise continuous chapters, a sticky original-color cutout and one sticky gently skewed photo frame. Phone layouts keep normal in-flow content and one gallery.
- Contact now pairs the appropriate copy and icon links with the same portrait material. Continued scrolling still reversibly reforms the opening without teleporting or trapping focus.
- A real canvas character sweep replaces the sparse CSS mode overlay. Photo waves vary their glyphs and flowing edge on every change. A manual keyboard pause now persists after focus leaves; focus alone also pauses automatic changes.
- Decorative field uses an integer-seeded PRNG so server and browser SVG attributes match exactly.

### Reference interpretation

The PDF includes generated app redraws and obsolete chevrons/gallery controls. Per the written precedence, these are not copied as product facts or controls. Actual project captures and exact written project order remain authoritative. Bedulo/Bulletin remain honest placeholders; the handoff's generated journal is not passed off as an actual app screenshot.

### Final reference-pass verification

- Production `npm run build` and `npm run typecheck` passed.
- Full production Playwright suite: **11 passed in 2.0 minutes**. The suite now also catches hydration console errors, verifies transparent portrait surroundings in both modes even under the moving reveal, and verifies that manual gallery pause survives focus leaving the photo area.
- Registered reveal pixel checks compare the three visible sample positions directly with the unchanged original photograph through the final shared crop (x=100, y=245, width=900, height=1080).
- All current project-preview files loaded successfully. Plainkit was recaptured from its actual current workspace at a taller desktop size to fit D02's proportions.
- Decorative ribbons use compact dotted SVG paths with a few real glyph trails, avoiding expensive large text-on-path fields. Offscreen portraits postpone rasterization until visible; pointer frames composite cached layers.
- Desktop, tablet and mobile review artifacts were refreshed from the production server. No remote push, merge, hosting creation or deployment was performed.

## GitHub handoff

The owner explicitly authorized the GitHub push after reviewing the implementation. The initial repository was confirmed empty, and this finished project is committed on `main` for import into Vercel. No force push, pull-request merge or Vercel deployment is part of this handoff.

## Particle-motion update

The owner asked for dots that actually move and a floatier cursor response.

- The interactive portrait now draws independently moving point sprites from immutable original photo sample positions. Most dots breathe by less than a pixel; a small set of letters drifts farther. A curl field pushes points around a damped, spring-following pointer and its fading wake. The source photograph stays perfectly registered.
- Photo visibility is painted through a feathered directional brush/wake; there is no colored cursor sticker, fixed ring, or independently transformed photo patch. Integration uses elapsed time and small physics steps to remain stable at different frame rates.
- GPU buffers and a glyph atlas are uploaded once on resize. Ambient rendering is capped at 24 fps (up to 60 fps during pointer interaction), paused offscreen/when hidden, and disabled for touch and reduced-motion users. WebGL context loss switches to a cached 2D portrait with a smaller animated mote set. GPU resources, observers and listeners are disposed on unmount.
- Dots now travel slowly along background ribbon paths. Intersection/visibility/reduced-motion handling pauses these CSS animations when they cannot be seen.
- Targeted checks cover actual changing GPU pixels at rest, settling pointer motion, automatic pause offscreen, animated 2D fallback, and ribbon motion/reduced motion. The existing original-photo registration and clear-background checks are retained.

### Motion-update validation

Production build and TypeScript checks passed. All **14 Playwright tests passed (2.4 minutes)**, including the existing layout/content/gallery suite and new checks for changing rendered GPU pixels, spring settling, particle pause offscreen, animated 2D fallback, moving ribbon dots and reduced motion. Tests also retain direct original-photo registration checks at three pointer positions and verify clear surroundings in both themes. No new media or user assets are required for this update.

A fresh `docs/review/particle-motion.mp4` demonstrates the effect in both themes; the earlier walkthrough remains available for the overall page structure.
