# Refine the existing Jeffrey Hamilton portfolio: visual fidelity and motion

Work in the existing portfolio repository. This is a correction to the current implementation at https://jeffreys-portfolio-three.vercel.app/, not a request to generate another design or rebuild an unrelated template. Keep the verified content, real media, project order and final design decisions. Inspect repository instructions and the actual code before editing. I will handle GitHub push and Vercel deployment; do not push, merge or deploy unless I ask.

Use the original visual handoff and my uploaded videos as the visual target, with the final written decisions taking priority. Build and verify the changes, not just a plan. Continue with honest placeholders for missing assets and update ASSETS-TO-ADD.md.

## What needs fixing

The current page has much of the content and rough composition, but it feels static and disconnected. The portrait reads like a dense dithered photograph, not an expressive field of recognizable dots and characters. Pointer movement produces a conspicuous exposed photo patch and noisy scattering, rather than a smooth, cohesive liquid reveal. The background trails are too faint to connect scenes. The intro and section transitions do not communicate the intended choreography clearly enough.

A review of the deployed browser bundle found existing particle shaders, a canvas reveal, intro/session flags, ribbon animation and GSAP scroll triggers. Do NOT assume the code lacks all animation or install a second conflicting animation system. Find out which effects run, whether they are perceptible, and what prevents the intended result. Check hydration, sessionStorage, reduced-motion settings, pointer type, visibility gates, loading state and canvas readiness. Existing requestAnimationFrame calls or animation classes do not prove the experience looks right.

## 1. Establish a before/after baseline

Run the current app in a real browser. Inspect at desktop and phone widths. Record a fresh-session load, a slow and fast sweep over the face, a scroll through projects, mode switching, and the Explore photo transitions. Use a clean browser context or clear only the intro flag to test first visits; distinguish a deliberately skipped repeat intro from an actual failure.

Read the existing rendering and animation code. Identify shared loops, portrait crop/mask transforms, shader motion strength, reveal compositing, ribbon timing, GSAP triggers and responsive fallbacks. Fix within a coherent architecture instead of layering competing render loops or scroll handlers. Preserve working accessibility, semantic content and reduced-motion support.

## 2. Make the portrait look intentional

Use the actual portrait and its clean cutout. Remove the original outdoor photo background from every mode and contact portrait. Particle and real-photo layers MUST share the exact same source, crop, scale, position, object-fit transform and aspect ratio. One mapping should own both layers. Eyes, smile, teeth, nose, ears and jaw must not shift across the mask.

Improve the particle composition: a deliberate mixture of fine dots, readable random letters, numbers and symbols, with varied density based on the face. Preserve recognizability without a uniform carpet of tiny white static. The current all-over noisy dither is not the target. Let some regions breathe; use alpha and luminance thoughtfully. Avoid a jagged rectangular shoulder edge. Never generate a substitute face.

Add restrained but NOTICEABLE idle life. A few peripheral glyphs drift on coherent paths, fine trails flow, and the portrait has very subtle local breathing. Keep facial landmarks stable. Interior movement should be much smaller than the outer field; do not make the face melt or continuously shuffle every glyph like television noise. Verify motion visually at normal browser zoom, not only by reading a shader containing a tiny sine offset.

Character selection is random alphanumeric material, not just my name. Intentional title/date morphs can form words. Reading text stays crisp; chromatic red/cyan edges belong primarily to moving particles.

## 3. Replace the awkward pointer effect with a fluid local reveal

Do not approximate this by revealing a circular photo sticker under the cursor and independently blowing away unrelated dots. The revealed image must feel like it is underneath one connected surface of letters being parted.

Use one continuous local influence field for BOTH the photo mask and the particle displacement/opacity. A shader flow map, advected low-resolution mask or carefully tuned signed-distance field with low-frequency boundary deformation are valid approaches; choose what fits the existing engine. A full scientific fluid solver is not required, but the visual response must feel fluid.

Required response:
- Pointer movement works without pressing a mouse button. Clicking or dragging is not required.
- The reveal follows closely with a small, controlled lag; no rubber-band overshoot or detached trail.
- The boundary is soft and irregular, smoothly deforming with velocity. It must not be a perfect disk, sharp blob sticker, triangle, starburst or constantly changing jagged noise.
- Faster movement gently elongates the region in the travel direction. Slower movement produces a compact organic shape.
- Nearby glyphs flow around the boundary with a subtle tangential component and then settle back. The mask and displaced particles agree spatially.
- As the pointer moves on, the previous area closes smoothly. Do not paint a permanent scratch-off trail or leave several separate exposed photo circles.
- At rest the interaction settles rather than oscillates endlessly. On pointer leave it returns gently to the particle portrait.
- Keep the reveal LOCAL, following the earlier small reveal reference, not permanently half the face or a huge hole across the whole head.

Starting tuning suggestions, not hard-coded acceptance by numbers: at a portrait width around 650px, try an influence radius roughly 55–85px, a short wake about 150–300ms, a fast critically damped pointer follower, and a controlled recovery over a few hundred milliseconds. Scale these in portrait-local CSS pixels, not raw canvas backing pixels. Cap velocity and dt after pauses. Check pointer coordinates after resize and scroll, and account for device pixel ratio only once. Avoid a large radius plus a long lag that makes the exposed patch feel detached.

Do not reveal the whole colored photo before the effect is ready. The particle image and photo must never jump between different crops or expressions. Use a still/tap fallback for touch and a still treatment for reduced motion. Do not require hover for essential content.

Build a small local development test harness if helpful, but no debug controls in the public design. First make this interaction look right in isolation, then reuse it in the hero and contact rather than implementing inconsistent versions.

## 4. Implement a visible, deliberate intro

The first visit needs the short sequence we designed, not just text fading in while the finished portrait is already present:
- sparse dots/characters;
- letters gather toward the opening title;
- portrait points travel from dispersed positions to their face positions;
- supporting text and small header settle;
- the same particle field continues into live pointer interaction without swapping to another portrait or flashing.

Use an approximately 1.8–2.2 second coherent timeline as a starting point. The visual formation must be visible during a fresh load. If you use GSAP for timing, feed the timeline progress into the actual portrait renderer; do not animate a DOM wrapper while the field itself remains static. Intro state should wait for the actual asset/engine readiness without a fake loading delay or a blank screen if assets fail.

Immediate Skip intro and reduced-motion bypass are required. Show the complete hero instantly on repeat visits if that is the chosen behavior. Do not replay it on Work/Explore changes. Keep the final headline placement stable. Test in a genuinely fresh session and record the result. An intro flag in code is not enough.

## 5. Connect the scroll scenes

Preserve the two opening previews, followed by the approved vertical list with wide slightly perspectival screenshot strips. Do not redesign it into unrelated cards. The list extends down to fit all eleven projects without compressing their rows.

Give transitions clear choreography:
- The hero letter ribbon travels toward the opening previews as the hero leaves.
- Preview panels settle into place with restrained movement; the caption and corresponding preview stay attached.
- A continuous particle trail guides the upper and lower rows. Prior rows leave as subsequent rows enter; the same graphic language persists.
- The cropped edge portrait is deliberate and can fade out when no longer useful; do not repeat a large complete face decoratively in every project row.
- Contact inherits the existing letter field. It should feel like arriving at the person again.
- Continuing beyond contact visibly reforms the opening typography. Do not substitute an extra static footer reading my name for the actual transformation. Preserve reversible, predictable scrolling and keyboard behavior; no infinite scroll trap or forced focus reset.

Subtle rotateY and a few pixels of translate on a preview are not sufficient by themselves. Use coordinated scroll progress and meaningful particle/ribbon evolution, not generic fade-in on every section. Do not pin everything or introduce huge empty scroll distances. Make the art visible enough to read as a connection without compromising the content.

## 6. Work/Explore transition and photo changes

Mode switch: implement the curved particle sweep, roughly 700–900ms initially. Keep the header and portrait geometrically stable. Work dark becomes Explore ivory with white characters becoming black. Content changes within the transition, not an abrupt theme-class flip that exposes mismatched layouts. Preserve section context where possible. No dropdown: only face home control plus Work/Explore. Contact owns the social icons.

Explore photos: ONE stable photo area automatically cycles through the supplied collection. EVERY image change must use a moving wave of RANDOM letters, numbers and symbols to cover/disassemble the current photo and reveal the next. Hold each photo long enough to see it, start around 6 seconds, with a transition around 900ms. Preload the next image and handle failures. No visible pagination dots, play/pause or next arrows. No additional photo pages. If real photos are still absent, keep an honest placeholder and provide a developer-only way to verify the animation without publishing fabricated personal photos. Pause work offscreen and respect reduced motion.

## 7. Keep the final design decisions and content

- Dark Work / ivory Explore; use the same visual identity.
- Certificate links remain nine small icons above the portrait with accessible hover/focus titles, not a separate page.
- Experience strip: Software Engineering / Provo CAPS; Intern / Doing Business Intelligently; Timpview High School / Graduating 2027.
- Featured order: Plainkit, Bedulo, Slate, Pollly, Bulletin, Counterpoint, Violet Hour, Minecraft Mods, Signal surf, Ultimatum, Buddy.
- Plainkit uses its real current tools workspace, not an invented app UI.
- Bedulo needs the supplied cream journal and teal microphone screenshot; the live build currently has a placeholder. Locate that upload or list the exact missing asset instead of inventing it.
- Slate uses the original actual purple-grid editor view, not a sign-in screen.
- Signal surf stays planned. Bulletin preview stays pending until supplied. Ultimatum is the Claude Code developer skill at https://github.com/JeffreyScottHamilton/Ultimatum, not a game.
- No original outdoor photo background behind the cutout, no dropdown, no visible gallery controls, no separate certificate screen, no stack panel or What comes next section.

Also review typographic hierarchy and density against the original approved frames. The current hero heading is readable; preserve that strength. Improve fine-text legibility, certificate icon readability and preview-strip spacing without introducing clutter. Scale the effect and layout intentionally for mobile; do not shrink the desktop screenshot.

## 8. Performance and proof

Keep time-based motion, cap pixel ratio and scale particle counts for weaker devices. Avoid React state updates per pointer frame, duplicate RAF loops and expensive per-frame getImageData. Pause rendering when hidden or offscreen; clean up listeners and GPU resources. A smooth convincing effect matters more than maximum point density. Verify mobile and WebGL fallback rather than assuming a desktop shader works everywhere.

Before declaring finished, run build/type checks and test in a real browser with normal motion enabled AND reduced motion enabled. Provide short before/after recordings of:
1. A fresh load showing the intro.
2. Slow, fast and direction-changing pointer movement over the face, plus settling/leave.
3. Scroll from hero into opening projects and through the extended vertical reel.
4. Work/Explore switching.
5. At least two automatic photo transitions, including loop wraparound when media exists.
6. Contact-to-opening transition.

Inspect the recordings yourself. Fix obvious mismatches such as an imperceptible intro, nearly stationary characters, jagged/exploding particles, misregistered face, abrupt mode changes or a gallery that only crossfades. Do not claim fluid behavior on the strength of passing type checks or the existence of shader code. If a recording/tool is unavailable, state the specific limitation and what was actually tested.

Deliver the working changes, precise local run instructions, validation results and grouped missing-asset checklist. Summarize what changed visually and in behavior. Do not stop after saying the animation systems already exist, do not merely add documentation, and do not deploy without my instruction.
