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

## Look and motion correction (current local pass)

This section supersedes the earlier motion implementation description. Scope follows `docs/FIX-LOOK-AND-MOTION.md`; no push or deployment is part of this pass.

- Inspected the existing portrait canvases, GPU shader, GSAP triggers, visibility hook, intro/session flags and gallery before changing them. Before recordings are preserved under `docs/review/motion-fix/before/`.
- `InfluenceField` replaces the separate brush history and shader pointer forces. A critically damped follower drives one low-resolution coverage surface, with velocity-dependent elongation and gentle low-frequency deformation. The photo composites the field canvas; the GPU reads the exact same RGBA buffer (coverage plus gradient). The Canvas fallback samples that same buffer. There is no independently timed photo brush, permanent scratch trail, or click requirement.
- Both portrait layers use the unchanged original photo, alpha cutout and single `portraitGeometry` crop. The photo itself never translates with the cursor. Soft coverage and restrained tangential displacement avoid the bright rim seen in the first review capture.
- Particle density now varies between landmarks and peripheral regions; larger random glyphs breathe around a stable face. Point home coordinates stay immutable. Time-based idle motion, local influence and scene formation run within the existing portrait rendering loop. Pixel ratio, frame rate, offscreen suspension, touch/reduced-motion stills and GPU cleanup remain bounded.
- A shared `SceneMotion` object receives GSAP progress. On a fresh visit, actual sampled title characters gather and actual portrait points travel from dispersed positions into the live portrait. The 1.88-second timeline waits for font/title and portrait readiness; supporting elements settle late in that same timeline. Skip completes immediately. Repeat visits and reduced motion bypass formation. Mode switching does not replay the intro.
- Hero particles disperse toward the opening preview region as the ribbon travels down. Opening captions and panels settle as attached articles. A single continuous ribbon now spans the extended reel instead of duplicating a loop in every row. Contact and the return portrait receive reversible formation progress; the return typography is reconstructed from sampled title pixels rather than only fading a static footer.
- The curved mode curtain uses the existing Canvas renderer, driven by the same GSAP scene clock. Theme/content swap at 47% of its 840ms duration while the broad curtain covers the page; the header stays above it. Section context mapping is retained.
- Gallery holds remain six seconds with a 900ms random-character covering wave on every change. Next-photo preload continues after every transition, including wraparound. Focus/manual pause, failures, offscreen pausing and reduced motion remain supported.

Review commands (run with the production server on port 3000):

```sh
node scripts/record-motion.mjs after
# Optional single clip, including a full normal-speed gallery loop:
node scripts/record-motion.mjs after photos-loop
```

Browser recordings use real system Chromium through Playwright. Touch is browser emulation, not a physical phone; headless Chromium uses the environment's graphics implementation, so these captures are not a hardware FPS benchmark. The supplied PDFs include generated design imagery; this pass preserves the approved content/layout rather than claiming a pixel-identical recreation of those frames.

During capture review, the return endpoint was clamped to the available page length so typography finishes forming before the footer. The old return-wrapper fade was removed. Offscreen title canvases now suspend drawing, and GSAP lag smoothing is disabled so scene durations follow elapsed time rather than stretching after a slow software-rendered frame. The portrait's physics integration retains its independent dt cap. A no-JavaScript style fallback keeps the opening copy and masked photo visible.

The mode capture also exposed the inherited 700ms CSS color/background crossfade competing with the curtain; it is removed. The portrait now retints/resamples through its existing decoded source and renderer on mode changes, preserving the GPU context and crop. The curtain caches its random-glyph raster and moves clipped strips of that raster, replacing thousands of per-frame text draws with inexpensive image draws. This remains the original Canvas curtain driven by the shared scene clock.

### Executed correction validation

- Production build and TypeScript compilation pass. The sixteen browser checks have been exercised: the complete suite passed fifteen checks, then focused reruns passed the corrected return/mode check and the affected intro/shared-field, palette/background and mode-context checks. Final affected-check run: **4 passed (45.0s)**. The separate Canvas fallback rerun also passed after the fallback adjustments.
- Checks include real changing GPU pixels at rest, input/settling/leave, exact original-photo registration at three positions, identical field-buffer identity for photo/GPU, actual intro formation uniforms, reduced motion, touch emulation, no-Canvas/GPU fallbacks, offscreen suspension, project ordering, responsive geometry, keyboard/focus handling and all fourteen gallery changes plus wraparound.
- Inspected extracted frames from the final fresh intro, local pointer reveal, extended project scroll, contact/return formation and ordinary gallery changes. Mode-specific issues discovered in recording were corrected and recaptured. The photo-loop source capture reached indices 1–13 and then 0 with the ordinary timers, without clock acceleration. `photos-wrap.mp4` is an excerpt of its final two changes.
- Recordings and the standalone local viewer are in `docs/review/motion-fix/`. The browser runs reported no page exceptions. Real-device touch performance and a particular production hosting environment are not represented by headless Chromium captures.
- No push, merge or deployment was performed. Existing verified content, assets and project order are retained. Missing product captures remain grouped in `ASSETS-TO-ADD.md`.

Final paint-order correction: palette updates run before the new theme paints, keeping the portrait visible during the covered swap. The final mode recording was inspected through both switches and ends back in Work with the portrait present. Final mode/background browser rerun: **2 passed (33.2s)**. The midpoint test observes the actual click-to-class-change interval rather than assuming Playwright returns from a click before the swap. Test readiness waits allow for a cold software-rendered browser.

## Particle transport correction — supersedes the reveal implementation

The owner's latest direction explicitly rejects the photo-reveal behavior. `InfluenceField`, its photo compositor, radial alpha removal and shader-boundary force are removed. Desktop pointer interaction never displays the color photograph. The photo remains only as the image source used to seed points and as the touch/reduced-motion/no-Canvas fallback.

`particle-fluid.ts` supplies a shared viewport velocity grid with semi-Lagrangian advection, twelve pressure-projection iterations, a moving-pointer velocity/vorticity impulse and decay. Each point has its own displacement and velocity, driven by the fluid and a damped spring to its original position. The GPU receives an offset buffer; point count and opacity are conserved during pointer motion. The Canvas fallback uses the same point dynamics. This is particle transport with momentum, rather than a photo mask with a changed outline.

Static SVG ribbon/ambient dots are replaced by `ParticleSurface`, which uses the same solver and point dynamics. Ribbon homes follow cached path samples continuously; the red/cyan strands and random glyphs flow along those paths and are deflected by the cursor. Visible renderers advance the single fluid clock, with no additional standalone solver RAF. Observers suspend offscreen drawing, reduced motion supplies stills, dt/velocity/displacement are bounded and all listeners are reference-counted and cleaned up.

The reference's portrait-to-project continuity is now one live portrait: its existing canvas stays pinned while it travels from the hero's right side to the cropped left edge next to the opening previews and extended reel. It leaves before contact; scrolling back reverses the same transform. The old duplicate edge portrait is hidden on desktop. Opening articles enter from depth with attached captions; reel rows also move in perspective. Hero title/head positioning, dot density and ribbon contrast were adjusted against pages 1–4 of the supplied handoff, retaining real project captures, content and order.

Browser tests now directly inspect actual offset buffers for displacement, retained momentum, spring recovery and constant point count, and confirm the photo canvas stays empty during desktop interaction. They also verify that the same portrait DOM canvas travels between scenes and returns, and that ribbon particles receive momentum and stop under reduced motion. Earlier tests requiring a colored photo reveal or static SVG dash animation were replaced because the requested behavior changed.

The final portrait seed is a tighter shared bust crop `(100,245,900,900)` of the unchanged original image. Desktop sizing is bounded by the available hero height; the head aligns with the title and the certificate arc stays in the viewport. This also shortens the torso to match the supplied reference composition. Reel transforms now use explicit perspective, making their Z movement visible rather than only changing opacity/translation.

The complete browser run passed fourteen checks and identified one short-viewport certificate-label clipping issue. After correcting framing, the opening/content/certificate test passed; the final physical-momentum/conserved-point-count/no-color-patch and same-canvas reversible handoff tests also passed. All three dedicated fluid tests had already passed, including ribbon momentum and reduced-motion suspension. The broader run retained gallery wrap/focus pause, mode context, three responsive widths, touch stills, no-Canvas fallback and animated Canvas fallback checks. Final production build and TypeScript compilation passed. Latest recordings are under `docs/review/motion-fix/fluid/`; the earlier `after/` set describes the superseded photo-reveal behavior.

Capture tuning reduced an initially excessive vortex: pointer impulses now blend toward a bounded target velocity instead of accumulating on every mouse event, and the outward pressure is restrained. Springs integrate elapsed time through small substeps, retaining a 120ms pause cap, so recovery does not stretch indefinitely at lower software-rendered frame rates. The final three dedicated fluid checks pass (**3 passed, 39.2s**), including visible displacement, inertial continuation, recovery, constant point count, an empty desktop photo canvas, reversible same-canvas scene travel and ribbon interaction/reduced motion. The portrait and field recordings were recaptured after this tuning.

Final capture inspection confirmed a small passing wake and recovery to the recognizable face, without the earlier large-vortex behavior. The experience strip now leaves with the hero instead of crossing the pinned face during the handoff. The updated scroll clip was recaptured after that adjustment. Production build/type checks pass; the final cursor/field recordings and scene recordings report no page exceptions. No push or deployment was performed.

## Rightward work entrance and cursor color

The owner's follow-up restores color under the cursor and asks for the work to arrive from the right. Opening previews now move from right to left with their captions attached, and reel rows have horizontal entry rather than a vertical lift. The hero copy leaves left; the portrait continues its existing leftward handoff.

A new `workLine` progress value in the existing shared GSAP scene controller straightens the hero ribbon, then gathers the opening ribbon's same points into outlines around the two real preview bounds. The frame targets come from layout offsets, so they match the final cards independently of their animated transforms. Particle inertia remains active during the morph. The ribbon canvas extends around all sides of the previews so its top edges are not clipped.

Original RGB is sampled once with each portrait point. The GPU adds one color attribute and blends that point's own color near the cursor and within its displacement wake; the Canvas fallback applies the same blend. The point moves with its color. There is no separate photo reveal, alpha removal or photo/particle registration layer. Physics and original point count are unchanged.

Validation for this follow-up: right-entry/morph and rendered warm-RGB tests **2 passed (15.1s)**; momentum/recovery/conserved-particle-count/no-photo-canvas check **1 passed (8.0s)**; mode-context and Canvas fallback checks **2 passed (30.3s)**. Final production build/TypeScript compilation pass. The color test reads actual GPU pixels and confirms warm original-portrait colors, rather than only checking shader uniforms. No new assets, push or deployment are required/performed.

Color brightness is normalized by the source RGB peak before blending into particle ink, because point size already encodes portrait luminance. This avoids applying the source darkness twice and keeps the colored particles legible instead of creating a dark cavity. GPU and Canvas use the same chromaticity treatment. The cursor recording was recaptured after that shading adjustment.

## Minimal header and full-color Explore portrait

Removed the top-left portrait/home button. The header now contains only Work and Explore. The existing footer's upward affordance is now a keyboard-accessible “Back to top” link, retaining the return/focus behavior without another header icon.

Explore uses permanent original RGB on the existing portrait point renderer, without requiring hover. The point source, positions, particle dynamics, glyph atlas and Canvas/GPU pipeline are reused. Work retains monochrome points with localized cursor color. The Explore journey portrait now also uses this live colored particle renderer instead of switching to a smooth decorative photograph; touch, reduced-motion and unsupported-Canvas still fallbacks remain available.

A dedicated browser test reads actual GPU pixels before any portrait hover, verifies Work starts monochrome and Explore contains color, confirms the particle canvas DOM instance and point count are unchanged, and checks the header has exactly its two mode controls. Navigation tests now use the footer return link.

The continuity check exposed viewport-dependent reseeding during the palette change. Portrait sampling now uses a canonical original-image grid, with stable normalized point identities and glyphs independent of theme. Matching-size dynamics buffers are reused, preserving momentum through a palette update. Final browser test passes: the same canvas and exact particle count remain after switching Work → Explore, with color present before hover. Production build and TypeScript compilation pass. Mode context/footer return, 390px layout and the Canvas fallback checks also passed. A rendered Explore screenshot is saved at `/workspace/outputs/explore-colored-particles.png`. No push or deployment was performed.

For full-color Explore, dot coverage carries the original RGB directly, rather than combining photographic luminance with the old monochrome brightness inversion twice. This keeps skin and clothing color legible against ivory while retaining the same canonical point identities, random letters and live dynamics. Work keeps its established monochrome point shading and cursor tint.
