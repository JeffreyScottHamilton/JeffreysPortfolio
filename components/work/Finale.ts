/**
 * Contact → opening, in place (motion allowed, all widths).
 *
 * The contact section is pinned; over the pin (q ∈ [0, 1], scrubbed,
 * reversible) the page turns back into its own opening without scrolling on.
 * The portrait does not move at all: while live, the contact portrait sits
 * in exactly the hero portrait's box, so the two are the same picture and
 * hand over invisibly at the start (phones, where it sits below the contact
 * copy: same size as the hero's, it only slides up, then hands over).
 * Everything else switches at once:
 *
 *   0–1  "Let's build something useful." → "Jeffrey Hamilton", and the rest
 *        of the contact (Provo, rule, floating letters, link icons) → the rest
 *        of the opening (copy, certificate icons, arrow, labels), dot for dot,
 *        directly (shared text ⇄ dots, components/shared/dotText.ts); ribbons,
 *        orbit line and experience band cross over on the same beat.
 *
 * At q = 1 (max scroll) every inline style on the reprise is gone, so the
 * frame is the hero at scrollY 0 and the shell's loop jump is invisible.
 */
import { layoutRect, norm } from "./absorb";
import { DotMorph } from "@/components/shared/dotText";
import { snapProgress } from "./HalftoneMorph";

const smooth = (t: number) => t * t * (3 - 2 * t);
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const f3 = (x: number) => x.toFixed(3);

/** the opening's text and icons (form from the contact's dots) */
const HERO_TEXT = [
  ".wk-sub",
  ".wk-hero-copy > .wk-rule",
  ".wk-statement",
  ".wk-kinds",
  ".wk-selected > span",
  ".wk-orbit-label",
  ".wk-experience ul",
  ".wk-selected > svg",
  ".wk-cert-btn",
].join(", ");
/** the contact's text and icons besides the title (become the above) */
const CONTACT_REST =
  ".wk-contact-copy > .wk-rule, .wk-contact-place, .wk-contact-links li";

/* the portrait hand-over (identical pictures in the same box) */
const SWAP: [number, number] = [0, 0.12];
/* phones (portrait in the contact's flow, below the copy): it slides up at
   its final size, then hands over */
const SLIDE: [number, number] = [0, 0.5];
const SWAP_SLIDE: [number, number] = [0.5, 0.62];
/* inline box of the contact portrait while live (see measure) */
const BOX = ["left", "top", "width", "height", "right", "bottom", "flex", "transform"];

export class Finale {
  private contact: HTMLElement;
  private rep: HTMLElement;
  private cWrap: HTMLElement;
  private rWrap: HTMLElement;
  private cRibbons: SVGElement[];
  private rRibbons: SVGElement[];
  private rBase: number[] = [];
  private orbitLine: SVGElement | null;
  private band: HTMLElement | null;
  private tTitle: DotMorph;
  private tRest: DotMorph;
  private raw = 0;
  /** phones only: the slide onto the hero portrait (0 on wider screens) */
  private move = { x: 0, y: 0 };

  constructor(root: HTMLElement) {
    const q = <T extends Element>(r: ParentNode, s: string) => r.querySelector<T>(s)!;
    const qa = <T extends Element>(r: ParentNode, s: string) => [...r.querySelectorAll<T>(s)];
    this.contact = q(root, ".wk-contact");
    this.rep = q(root, ".wk-reprise");
    this.cWrap = q(this.contact, ".wk-contact-portrait");
    this.rWrap = q(this.rep, ".wk-hero-portrait");
    this.cRibbons = qa(this.contact, ".wk-contact-field svg.ribbon");
    this.rRibbons = qa(this.rep, ".wk-hero-field svg.ribbon");
    this.orbitLine = this.rep.querySelector(".wk-orbit-line");
    this.band = this.rep.querySelector(".wk-experience");

    // straight across, all at once: the title's dots become the name, the
    // rest of the contact's dots become the rest of the opening
    this.tTitle = new DotMorph({
      from: { text: qa<HTMLElement>(this.contact, ".wk-contact-title") },
      to: { text: qa<HTMLElement>(this.rep, ".wk-title") },
      anchor: root,
      salt: 3,
    });
    this.tRest = new DotMorph({
      from: { text: qa<HTMLElement>(this.contact, CONTACT_REST) },
      to: { text: qa<HTMLElement>(this.rep, HERO_TEXT) },
      anchor: root,
      salt: 9,
    });
  }

  private reset() {
    const clr = (e: HTMLElement | SVGElement, ...k: string[]) => k.forEach((x) => e.style.removeProperty(x));
    clr(this.rep, "visibility");
    clr(this.contact, "visibility");
    clr(this.cWrap, "opacity", ...BOX);
    clr(this.rWrap, "opacity");
    for (const r of [...this.cRibbons, ...this.rRibbons]) clr(r, "opacity");
    if (this.orbitLine) clr(this.orbitLine, "opacity");
    if (this.band) clr(this.band, "--band");
  }

  /** Read the rest layout (clears all inline state first). */
  measure() {
    this.reset();
    this.rBase = this.rRibbons.map((r) => parseFloat(getComputedStyle(r).opacity) || 1);
    // the contact portrait takes exactly the hero portrait's box (both live
    // in the pinned finale, so their offset is fixed): same picture, same
    // place, so the face never moves or resizes through the loop
    const c = this.cWrap;
    const cs = c.style;
    const rr = layoutRect(this.rWrap);
    this.move = { x: 0, y: 0 };
    if (getComputedStyle(c).position === "absolute") {
      const host = (c.offsetParent as HTMLElement | null) ?? this.contact;
      const hr = layoutRect(host);
      cs.left = `${rr.left - hr.left - host.clientLeft}px`;
      cs.top = `${rr.top - hr.top - host.clientTop}px`;
      cs.width = `${rr.width}px`;
      cs.height = `${rr.height}px`;
      cs.right = "auto";
      cs.bottom = "auto";
    } else {
      // in flow (phones): same size as the hero portrait, so it only slides
      cs.flex = "none";
      cs.width = `${rr.width}px`;
      cs.height = `${rr.height}px`;
      const cr = layoutRect(c);
      this.move = { x: rr.left - cr.left, y: rr.top - cr.top };
    }
    for (const m of [this.tTitle, this.tRest]) m.measure().then(() => this.update(this.raw));
  }

  update(raw: number) {
    this.raw = raw;
    const q = snapProgress(raw);
    this.rep.style.visibility = q <= 0 ? "hidden" : "";
    this.contact.style.visibility = q >= 1 ? "hidden" : "";
    const done = q >= 1;

    // everything switches on one beat
    this.tTitle.update(q);
    this.tRest.update(q);

    // ribbons, orbit line and the experience band cross over
    const cOut = 1 - ease(norm(q, 0, 0.6));
    for (const r of this.cRibbons)
      if (q <= 0) r.style.removeProperty("opacity");
      else r.style.opacity = f3(cOut);
    const rIn = ease(norm(q, 0.3, 0.95));
    this.rRibbons.forEach((r, i) => {
      if (done) r.style.removeProperty("opacity");
      else r.style.opacity = f3(rIn * (this.rBase[i] ?? 1));
    });
    if (this.orbitLine) {
      if (done) this.orbitLine.style.removeProperty("opacity");
      else this.orbitLine.style.opacity = f3(rIn);
    }
    if (this.band) {
      if (done) this.band.style.removeProperty("--band");
      else this.band.style.setProperty("--band", f3(norm(q, 0.3, 0.92)));
    }

    // portrait: the same picture in the same box; the hero one fades in
    // over the contact one, which then steps away (nothing moves)
    const cw = this.cWrap.style;
    const slides = this.move.x !== 0 || this.move.y !== 0;
    const sw = slides ? SWAP_SLIDE : SWAP;
    if (q <= 0) {
      cw.removeProperty("opacity");
      cw.removeProperty("transform");
    } else {
      cw.opacity = f3(1 - smooth(norm(q, sw[1], sw[1] + 0.04)));
      if (slides) {
        const m = ease(norm(q, ...SLIDE));
        cw.transform = `translate(${(this.move.x * m).toFixed(2)}px,${(this.move.y * m).toFixed(2)}px)`;
      }
    }
    if (done) this.rWrap.style.removeProperty("opacity");
    else this.rWrap.style.opacity = f3(smooth(norm(q, ...sw)));
  }

  destroy() {
    this.reset();
    this.tTitle.destroy();
    this.tRest.destroy();
  }
}
