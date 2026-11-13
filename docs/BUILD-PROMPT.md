# Build Jeffrey Hamilton's portfolio from this visual handoff

You are the design engineer implementing my portfolio. Build the actual working site, not another proposal, mood board or generated image. I will attach reference frames, screenshots, photos and videos alongside this prompt. Use them as the visual and content evidence. Start with the available materials and finish a cohesive working implementation. Do not repeatedly stop for confirmation. If a media file or destination is missing, use an intentional placeholder and record it in the asset checklist described below.

## 1. Goal and design judgment

Create a distinctive, exceptionally polished developer portfolio with two connected experiences:
- **Work**: near-black professional mode, fine white dots and alphanumeric glyphs, subtle red/cyan chromatic fringes during motion, readable white typography, selected projects and professional credentials.
- **Explore**: warm ivory personal mode, black dots and random glyphs, restrained vermilion accents, my real journey and one automatically changing photo area.

Both should feel like the same person and material changing tone. This is a designed experience, not a generic developer template, dashboard, card grid, neon cyberpunk scene, or collection of disconnected full-screen headings. Match the supplied compositions, negative space, project-preview shapes and typography closely. Add polish through transitions, timing, pointer response and consistent layout, not unrelated effects or invented content.

The frames are design references and scroll moments, not a requirement for a separate route or 100vh section per image. Projects must not feel crammed together. Build clear hierarchy, substantial breathing room and smooth continuity.

## 2. Resolve contradictions using this precedence

1. These written final requirements take precedence over any older frame.
2. My newly supplied photos, screenshots and videos take precedence over generated representations of them.
3. The latest `05-light-now` and `06-light-contact` frames define the corrected light backgrounds and header.
4. The latest dark opening with the small certificate orbit defines the Work hero.
5. The approved original preview-strip composition defines how projects look.
6. Earlier animation boards are motion references only; obsolete controls or text in them must not be implemented.

In particular, several older images show a dropdown chevron, photo pagination dots, pause buttons or next arrows. **Remove all of those.** There is no face dropdown and no visible gallery controls. Some older images show a full certificate screen: remove it. Some generated screenshots contain inaccurate product UI, repo names, numbers or statistics: never reproduce those details as facts. Use actual assets and verified content instead.

If I provide a video, inspect it to identify the relevant interaction before trying to match it. Do not claim to have watched a video you cannot access. Capture representative frames when possible. Explain an access failure briefly, then proceed using the other references.

## 3. Implementation approach

Use Next.js App Router with TypeScript unless the existing project already has a suitable working stack. Keep code componentized, content-driven and maintainable. Use CSS for layout, GSAP + ScrollTrigger or an equivalent coherent animation system for the scroll choreography, and a lightweight WebGL/canvas solution for the portrait and particle transitions. Use Three.js or shaders if needed for the visual result, but do not add a heavy 3D environment unrelated to the references. Register and clean up animation effects correctly; avoid duplicate event handlers and competing scroll libraries.

If there is an existing repository, inspect its instructions and structure first and adapt it. If this is a new project, set up a runnable app with documented commands. Do not replace a working project wholesale without understanding it. Build locally and provide a reviewable result; do not publish or deploy unless I request it.

Use semantic HTML for all meaningful text, buttons and links. Canvas can render decoration and visual effects but must not be the only place content exists. Main content must remain available if the particle effect fails. Avoid unnecessary libraries, fake loading delays and inaccessible custom scroll mechanisms.

## 4. Header — final decision

Every section and both modes share the same minimal header:
- My small real circular face on the left, acting as a home/start control.
- Work and Explore buttons immediately to the right of the face; clearly indicate the selected mode.
- **No dropdown, no chevron, no hidden menu.**
- No centered Work/Story/Contact nav and no repeated top-right social links.
- GitHub, email and LinkedIn live in the contact area as icon controls with accessible names and hover/focus labels.

Activating the face returns to the beginning in a predictable accessible way; do not restart a long intro or reset the mode. Work is the initial default for a new visitor. Mode switching must remain discoverable without opening anything. Preserve the chosen mode through normal navigation in the same visit.

## 5. Portrait — the most important visual detail

Use my actual supplied portrait. Do not generate a replacement person, alter my facial features or approximate the face with a generic model.

The portrait is made from fine dots and letters, with the real photo underneath. **The photo and particle layers must use one shared image crop, transform and coordinate system.** Eyes, eyebrows, nose, teeth, smile, hairline, ears and jaw must align exactly across the reveal. The mask moves; the image beneath does not move independently. There must never be a second face, shifted-down mouth, different expression, different scale, or an image patch pasted on top.

On pointer movement, a soft organic liquid-shaped area parts/displaces the dots and glyphs, revealing the real image beneath. Use the earlier local cursor-reveal behavior in the references. It should follow the cursor naturally, deform slightly in the direction of movement and leave a short fading particle wake. It is a reveal through a mask, not a pink shape or sticker. The particles gradually reform behind the pointer.

It is not a fixed half-photo/half-particle split, a diagonal wipe left permanently across the face, a hard geometric hole, or a click-to-activate effect. Desktop interaction responds to pointer movement without requiring a click or drag. On touch use a restrained tap/reveal or still portrait fallback; do not block content behind hover.

Use a cutout of me so the original outdoor/green photo background does not appear around my hair, ears, neck or shoulders. In light mode the person and glyph edges sit against the same warm ivory page, with no green haze, blurred photo rectangle, full photographic background or hard cutout halo. In dark mode the same principle applies against near-black. Preserve authentic hair edges.

If a suitable clean cutout is unavailable, use a clearly documented temporary treatment and list the required asset. Do not quietly ship an obvious halo or misregistered reveal as finished. Use an alpha image or mask asset; preserve the original photo as well.

## 6. Character material and visual style

The field can use **random letters, numbers and symbols**: for example A, q, K, z, 7, 4, %, # and ?. It is not restricted to the characters in Jeffrey Hamilton. Only intentionally spell my name, a date, heading or project title when that is the planned transformation.

Use smaller glyphs and varied density to form recognizable shapes. Keep the visual field deliberate and calm at rest. Red/cyan chromatic separation belongs mostly to moving particle edges, not all reading text. Body copy, project labels and controls stay sharp. No constant glitching, flashing, obnoxious bloom or rainbow gradients.

Background ribbons and curved trails should carry the same visual material between scenes. Avoid having everything float or orbit at once. Prioritize the portrait, the hovered control or the current project as appropriate.

## 7. Intro and mode transition

A short intro, about 1.85 seconds as a starting point:
- 0.00 s: sparse quiet field.
- 0.35 s: letters gather into the opening type.
- 0.85 s: the portrait takes shape.
- 1.35 s: supporting content and header settle.
- 1.85 s: finished hero, live pointer interaction takes over.

Work opens with Jeffrey Hamilton and my professional introduction. Explore opens with The person behind the projects. Keep final title placement stable as the intro finishes. An immediately available Skip intro control disappears once the hero is ready. Play once per visit, never on each mode change. Do not hide content behind a fake loading counter. Reduced motion displays the finished hero immediately.

Work/Explore transition is a proposed 700 ms particle sweep, adjustable after testing: dark becomes ivory, white dots become black, content changes gracefully. Keep the portrait crop and header geometrically stable. When switching mid-page, preserve equivalent context where reasonable: portrait to portrait, Work contact to Explore contact. Define a sensible mapping for projects versus journey without jarring scroll jumps. Do not use the transition to permanently leave the face half dark and half light.

## 8. Work mode: complete flow

Arrival/portrait -> opening project pair -> vertically extending preview-strip project reel -> contact -> opening reforms on continued scroll.

### Hero
Jeffrey Hamilton
Software developer / Provo, Utah
I turn ideas into things you can use.
Browser tools. Desktop apps. Games.

Use the latest dark hero reference for hierarchy and the flowing dot-letter ribbon. Current experience sits in a compact readable strip beneath the hero rather than a dedicated extra screen:
- Software Engineering — Provo CAPS
- Intern — Doing Business Intelligently
- Timpview High School — Graduating 2027

Do not invent role duties, employment history, performance metrics, user counts or skills ratings. Do not add the removed stack panel or What comes next section.

### Certificates: small orbit above the portrait

Nine small restrained icon links on a loose arc above my head, integrated with the fine letter field. The orbit must not take over the hero, obscure hair or resemble an oversized dashboard. A small 09 certificates label can make it discoverable.

Hover or keyboard focus displays the exact certificate name. Activating opens its real destination. No certificate page, document viewer, modal preview or Google Drive logo. The buttons can eventually point to my Google Drive URLs, but do not invent them.

Exact titles:
1. Computer Programming 1 — May 12, 2025
2. Computer Programming 2 Java — December 18, 2025
3. Game Development Fundamentals — December 12, 2024
4. Digital Media 1 — December 5, 2024
5. Digital Media 2 — May 4, 2026
6. Robotics 1 — December 15, 2025
7. Unmanned Aerial Systems — December 18, 2025
8. CAD Architectural Design I — December 19, 2023
9. Architectural Design 2 — May 9, 2025

These are school certificates. Do not describe Unmanned Aerial Systems as an FAA license. Ensure icons are usable by keyboard, touch and screen readers. On narrow viewports use a compact accessible arrangement instead of shrinking nine targets into unreadable dots. They still belong near the portrait rather than becoming a large extra page.

### Project presentation: preserve the approved composition

Start with Plainkit and Bedulo as two generous previews, titles and short descriptions beneath them, joined by the letter trail. Below, projects continue in a **vertical list** with names and descriptions at left and wide cropped slightly perspectival preview strips at right. Preserve the original reference geometry and breathing room. Scrolling reveals more rows; do not squeeze all projects onto a single screen. Keep each preview attached to its title as it moves. Preview effects must not make the actual product screenshot unreadable.

Do not turn the entire section into a generic equal-size card grid, disconnected giant project pages, overlapping clutter, a text-only table or tiny rounded badges. The upper and lower project frames are successive positions in one continuous list. A narrow cropped portion of the portrait and particle field may continue along its edge.

Exact featured order:
1. Plainkit — Browser tools that process files on your device. Use its actual current dark workspace screenshot; it is not a project management or notes app. Avoid an outdated fixed tool count unless verified against the current product.
2. Bedulo — Talk for a few minutes each night; Bedulo writes a page in your book. Use the supplied cream ruled journal and teal microphone view, **not the sign-in page**.
3. Slate — Collaborative whiteboard and 3D editor. Use the original editor screenshot from my portfolio with the purple perspective grid, white mesh and sidebars, **not the sign-in page**.
4. Pollly — A social app where every post is a question. Use its actual feed screenshot.
5. Bulletin — Local classifieds with private replies. Its live site had a database error during capture; use an intentional preview placeholder until I supply a working screenshot.
6. Counterpoint — Sharpen your thinking through different perspectives. Use the actual supplied screenshot; if only the public entry view exists, identify it honestly rather than inventing a chat.
7. Violet Hour — An editor theme for Visual Studio and VS Code. Use the actual code-theme preview.
8. Minecraft Mods — Fabric projects. Use the actual Modrinth collection or real mod screenshots. It is not a factory-building game. Do not use made-up landscape screenshots as evidence of a mod.
9. Signal surf — Planned/unbuilt project. Keep an intentional placeholder and label it as planned. Do not imply it is live or silently replace it with Signalwatch.
10. Ultimatum — Free, open-source developer skill/plugin for Claude Code. Use the correct repository or a real supplied demonstration. It is not a game.
11. Buddy — Offline AI desktop companion. Use the real supplied orb/chat/desktop screenshot, placed later in the reel rather than as the opening showcase.

Other projects can appear behind a quiet More experiments link in a secondary compact list. Only include additional projects I actually provide or verify from my original portfolio; do not invent them. Excluded projects do not rejoin the featured list automatically just because their screenshot is in the attachment bundle.

Use applicable live and source links from verified data. Do not assign a generic GitHub homepage as a pretend repository link. Missing sources become a recorded task, not a broken action.

## 9. Explore mode: complete flow and copy

Portrait introduction -> continuous journey with one automatically cycling photo area -> personal contact -> opening reforms.

Opening: The person behind the projects.
Jeffrey Hamilton / Provo, Utah
A little of how I got here.

Journey content comes from my original portfolio. Use concise natural prose with editorial spacing, not many unrelated full-height title screens. Maintain the actual chronology without implying the COVID move happened in 2018.

- **Early days / 2018 onward:** An egg business was the beginning. I lived in Cedar Hills, played soccer and sold eggs. Later, COVID brought a move to Lindon; making friends after a move took time.
- **2022 / creating:** Started a YouTube channel, taught myself Blender and editing, built little games and learned to finish something and put it out. Lindon friends, swimming and VR/Unity experiments were part of this stretch.
- **2023–24 / new place, new people:** Move to Provo, karate through a Lindon friend, high school in 2024 and the friends I still spend time with. Minecraft mods and SmartChat were a place to learn to delegate to AI and check what came back. Do not conflate that history with every current Modrinth project.
- **Now:** Friends and group dances, keeping in touch with Lindon friends, still making videos and building ideas. Karate is a past chapter. Calisthenics is something I want to start, not an established current activity.

Do not invent life events or fill the page with generic motivational copy. No need for the full professional project list or certificate screen in Explore. Let the story and real photos carry personality.

### Photo behavior — final decision, overrides older frames

There is ONE photo area, not a series of separate photo screens. It automatically cycles through every photo in its collection over time. The frame stays in place while the image changes. Journey frames illustrate successive states of this one area.

**No visible pagination dots. No play/pause button. No next or previous arrow.** They are obsolete even if still shown in an older mockup.

For EVERY photo change:
1. Let the current image remain clearly visible for a few seconds (start around 6 seconds).
2. A flowing wave of random letters, numbers and symbols sweeps over it, obscuring and visually breaking up the current image.
3. The next image is revealed as the characters disperse.
4. Repeat the same effect for every transition, then loop all supplied photos.

Start with a 900 ms transition and refine by eye. This is not a normal crossfade or hard cut. Do not animate only the first transition and then switch images abruptly. Keep a stable aspect ratio and no layout shift. Random characters are not restricted to my name. The gallery image uses contain/cover and focal-point metadata as appropriate so faces are not accidentally cropped.

The gallery may be sticky beside changing story text on wide screens; on mobile it can become an ordinary in-flow stable component. Do not make the same gallery appear as four independent widgets. If it is not visible or the document is hidden, pause its timer. With reduced motion, present a still image or a simple non-disruptive fallback. Provide an unobtrusive keyboard/focus-accessible way to pause automatic changes if needed for accessibility, without reinstating the rejected visible carousel controls in the normal design. Do not announce every automatic image through a live region.

Suggested slots: early Cedar Hills/Lindon, early YouTube/Blender, friends/swimming, karate team, freshman year, friends/group dances, favorite days and making something. Use my actual photos. Do not generate strangers, fake childhood images or placeholder stock friends. Treat subjects respectfully and use images I provide for this purpose.

## 10. Contact and return

Work ending: Let’s build something useful. / Provo, Utah.
Explore ending: Still curious. / Good people. New ideas. Things worth making.

GitHub, email and LinkedIn are icon links, clearly labeled to assistive technology and on hover/focus. Explore can also include the two real YouTube links. No need to print a long email address as a huge heading.

After enough scroll space for contact, continuing scroll should carry its letters into the opening typography and portrait. No Back to beginning button. The transition must be reversible when scrolling backward and must not cause an infinite-scroll trap, jump focus or break browser navigation. Preserve predictable behavior for reduced-motion and keyboard users. Choose an implementation that looks continuous without secretly teleporting the viewport while someone is interacting with a link.

## 11. Assets, placeholders and what to ask me for

Before editing, inventory supplied files and create a typed manifest (for example `content/portfolio.ts` and `content/media.ts`) mapping each asset to its role, alt text, source, focal point, optional poster, and status. Inspect filenames AND content; do not guess from a name alone. Do not install a plugin or access personal accounts unless the task actually requires it and access is available.

Use explicit states such as `ready`, `missing`, `planned`, and `needs-replacement`. Keep these distinctions in the content, not as scattered hard-coded checks. Preload the next gallery image and handle failures with a stable fallback rather than empty image boxes or broken icons.

If a file is missing:
- Use a well-designed neutral placeholder at the final aspect ratio and size. Label it honestly, such as Photo to add, Preview coming soon or Planned project.
- Do not use unrelated stock images, fabricated screenshots, guessed URLs or `href="#"` pretending to be a working action.
- If a link is missing, disable the action meaningfully or omit it while preserving the intended layout. Record the requirement. Planned Signal surf should not have a fake Launch action.
- Keep missing assets out of the way of implementing and testing the rest of the app.

Maintain `ASSETS-TO-ADD.md` with an actionable table: item / where it appears / preferred format and aspect ratio / current placeholder / exact path or manifest key to replace / what I need to supply / priority. Also maintain `IMPLEMENTATION-NOTES.md` for decisions and remaining limitations. Do not print internal development notes or implementation jargon in the public page flow.

Tell me early if an essential asset blocks visual fidelity—especially the portrait cutout or a required video. Otherwise proceed with placeholders. At the end give me ONE grouped checklist of exactly what I still need to add, with concrete filenames and replacement instructions. Do not vaguely say add your images or ask for every file one at a time. When I later send assets, replace the corresponding placeholders and update the checklist; do not redesign the site.

Expected outstanding items may include final personal photos, final nine certificate Drive URLs, a working Bulletin preview, any preferred signed-in app captures, and a clean portrait cutout. Determine what is actually missing after inspecting my attachments. Do not request items already supplied.

Videos should use my real files, appropriate poster images, muted inline playback if used as background previews, no unexpected audio, sensible lazy loading and reduced-motion behavior. A video upload does not authorize publishing it to an external service.

## 12. Verified content destinations

Original portfolio: https://jeffrey-hamilton-portfolio.vercel.app/
Plainkit: https://plain-kit.vercel.app/
Bedulo: https://bedulo.com/
Slate: https://slate-client.vercel.app/
Pollly: https://pollly-eosin.vercel.app/
Bulletin: https://bulletin-classifieds.vercel.app/
Counterpoint: https://counterpoint-six.vercel.app/
Violet Hour: https://marketplace.visualstudio.com/items?itemName=jeffreyhamilton.violet-hour
Minecraft Mods: https://modrinth.com/user/JeffreyHamilton
Ultimatum: https://github.com/JeffreyScottHamilton/Ultimatum
Buddy: https://jeffreyhamilton6399.github.io/buddy-desktop
LinkedIn: https://www.linkedin.com/in/jeffrey-s-hamilton/
Email: mailto:jeffreyscotthamilton6399@gmail.com
YouTube: https://www.youtube.com/@Jeffrey_Creates/videos
VR YouTube: https://www.youtube.com/@JeffreyVR6399/videos

Original GitHub contact is https://github.com/JeffreyHamilton6399 while Ultimatum uses JeffreyScottHamilton. Treat these as distinct verified destinations and ask which account I want for the contact icon if it remains unclear; do not rewrite all project owners to match one username. No final live URL is available for Signal surf.

## 13. Responsiveness, accessibility and performance

Design desktop first to match the references, then intentionally adapt to tablet and mobile. Do not shrink the desktop screenshot to fit a phone. Keep text readable, touch targets usable, certificate names accessible, and preview strips meaningful. The portrait may recompose vertically on mobile. No horizontal overflow, overlapping labels, tiny tooltip-only controls or scroll locking that prevents normal navigation.

Honor `prefers-reduced-motion`. Keep DOM content meaningful, visible focus states, contrast and semantic structure. Use a real button for mode changes and correct link/button behavior for actions. Ensure certificate tooltips work on focus and can be read on touch. Avoid rapid flashing. No visual effect should be the only way to discover or access a project.

Cap device pixel ratio appropriately, reduce particle counts on weaker devices, pause offscreen work, avoid React renders on every pointer frame, dispose canvas resources on unmount and keep a single coherent animation loop. Use requestAnimationFrame and time-based motion. Load assets intelligently and show the finished content even if WebGL is unsupported. Avoid a background that drains resources while the user reads.

## 14. Build sequence and verification

Proceed with implementation after inspecting attachments and repository instructions. Suggested sequence:
1. Inventory content and assets; create manifest and missing-asset checklist.
2. Build the responsive semantic content and layout, with correct project order and real previews.
3. Implement and verify the registered portrait/cursor reveal as an isolated component before making it the visual foundation.
4. Add project scroll continuity, the compact certificate orbit and the contact return.
5. Add Explore journey and the single automatically transitioning photo area.
6. Add the short intro and explicit Work/Explore mode transition.
7. Refine spacing, typography, color, motion and responsive behavior against my references.
8. Run the app in a real browser and inspect the result, not only the source code.

Validate at representative desktop, tablet and mobile widths. Check pointer reveal registration at multiple cursor positions, touch fallback, all eleven featured projects, the long vertical reel, both modes, every photo change and wraparound, the nine certificate states, contact links, intro skip, reduced motion, resizing and no WebGL fallback. Check for errors, broken assets, layout shifts, stuck scrolling or animations that keep running when hidden. Run the project build/type checks and relevant targeted tests. Do not claim success without executing the checks. If browser tools are unavailable, attempt the available route, state the actual blocker, and provide a concrete review path.

Use screenshots or recordings to compare the implementation with the supplied frames. Fix meaningful mismatches instead of declaring a rough generic layout finished. Add a small review recording of the face reveal, gallery transition and mode switch if the environment supports it.

## 15. Definition of done and final handoff

The result should be runnable, responsive and visually consistent, with both complete modes, smooth deliberate transitions and honest placeholders. No dropdown, no visible gallery controls, no separate certificate page, no misaligned face, no invented project screenshots, no missing content silently replaced with generic filler.

Final response should include how to run and view the app, what was implemented, actual validation results, any material limitations, and a grouped list of assets/links I still need to supply with exact replacement keys or paths. Include screenshots/recordings where available. Do not stop at a plan, promise, bare scaffold or advice. Make the best complete working result the available materials allow, then tell me precisely what remains for me to add.

## 16. Repository and hosting context

Work in my existing Jeffrey Hamilton portfolio GitHub repository when available. Inspect the connected checkout and repository instructions, and confirm its identity before making changes. If the correct repository is not accessible, ask for its URL rather than choosing a similarly named repo. Do not confuse the portfolio repository with any showcased project's repository.

Use Next.js and TypeScript, plus appropriate animation tools, and keep the app ready for Vercel. Inspect existing configuration rather than overwriting it. Document build commands, runtime requirements and environment variable NAMES; put example placeholders in `.env.example` and never commit secrets. A static portfolio should not require an unnecessary database or backend. The user will handle pushing the finished changes and connecting/deploying to Vercel. Do not push, merge, create remote changes or deploy unless explicitly asked.
