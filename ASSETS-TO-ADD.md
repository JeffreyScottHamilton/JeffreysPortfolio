# Assets to add

Drop the file at the path shown, set the manifest status to `"ready"` (where noted), rebuild. No layout changes are needed — every placeholder already has its final size and shape.

| Item | Where it appears | Format / ratio | Current placeholder | Replace at | What to supply | Priority |
|---|---|---|---|---|---|---|
| Bedulo journal screenshot | Work → opening pair, right card | PNG/WebP, ~4:5 portrait (≥1200 px tall) | Cream ruled card "Journal preview to add" | `public/previews/bedulo.png`; in `content/portfolio.ts` change the Bedulo `preview(...)` status `"missing"` → `"ready"` | Signed-in journal page: cream ruled paper + teal microphone. Not the sign-in page. | High |
| Bulletin screenshot | Work → reel row 05 | PNG/WebP, 16:9 desktop (≥1600 px wide) | Light strip "Preview pending" | `public/previews/bulletin.png`; Bulletin `preview(...)` status → `"ready"` | A working listings screen (the live site showed a database error) | Medium |
| Counterpoint in-app capture (optional) | Work → reel row 06 | PNG/WebP 16:9 | Current real capture | `public/previews/counterpoint.png` | Only if you want a signed-in conversation view | Low |
| Buddy in-app capture (optional) | Work → reel row 11 | PNG/WebP 16:9 | Real Buddy site page | `public/previews/buddy.png` | Optional real desktop orb/chat capture | Low |
| Certificate Google Drive URLs (optional) | Work → nine certificate icons | 9 share URLs | Links to the real PDFs on your original portfolio (all verified) | `content/portfolio.ts` → `certificates[].href` (keyed by id, e.g. `robotics-1`) | Only if you prefer Drive links | Low |
| Extra journey photos (optional) | Explore → photo frame | JPG, any ratio (faces near centre or set `focal`) | 14 real photos already cycle | `public/media/<name>.jpg` + one line in `content/media.ts` `gallery` | e.g. early Cedar Hills / Lindon, YouTube/Blender days, karate team, freshman year | Low |
| Signal surf | Work → reel row 09 | — | "[ Not built yet ]", no link | `content/portfolio.ts` Signal surf entry | Nothing until it exists | Future |

Already supplied and in use (do not resend): the portrait (`portrait-original.jpg`, new clean cutout `portrait-cutout.webp` + `portrait-alpha.png` made from it), 14 gallery photos, both videos, Plainkit / Slate / Pollly / Counterpoint / Violet Hour / Modrinth / Ultimatum / Buddy previews, the handoff PDF.
