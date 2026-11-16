/**
 * Contact → opening, in place (motion allowed, all widths).
 *
 * The contact section is pinned; over the pin (q ∈ [0, 1], scrubbed,
 * reversible) the page turns back into its own opening without scrolling on:
 *
 * In order: the head goes home first, then the text turns over.
 *
 *   0.00–0.40  Provo, the rule, the floating letters and the link icons
 *              dissolve into dots that stream into the contact portrait's
 *              face; the contact ribbons fade.
 *   0.05–0.45  the contact portrait glides until its head sits exactly on the
 *              opening's head; 0.45–0.56 it hands over to the hero portrait
 *              (only once aligned, so there is never a double face).
 *   0.50–0.92  "Let's build something useful." dissolves into dots that
 *              travel and re-form as "Jeffrey Hamilton" in the hero title
 *              position (shared text ⇄ dots, components/shared/dotText.ts).
 *   0.56–1.00  the rest of the hero composition emerges from the dots: the
 *              copy and the icons (certificate arc, arrow) form from the
 *              face's dots; experience strip, ribbons.
 *
 * At q = 1 (max scroll) every inline style on the reprise is gone, so the
 * frame is the hero at scrollY 0 and the shell's loop jump is invisible.
 */
import { faceRegion, headOf, norm, type Head } from "./absorb";
import { DotMorph } from "@/components/shared/dotText";
import { snapProgress } from "./HalftoneMorph";

const smooth = (t: number) => t * t * (3 - 2 * t);
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const f2 = (x: number) => x.toFixed(2);
const f3 = (x: number) => x.toFixed(3);

/** reprise text that forms from the face's dots */
const HERO_TEXT = [
  ".wk-sub",
  ".wk-hero-copy > .wk-rule",
  ".wk-statement",
  ".wk-kinds",
  ".wk-selected > span",
  ".wk-orbit-label",
  ".wk-experience ul",
  ".wk-hero-field .wk-float",
  // icons form from dots too
  ".wk-selected > svg",
  ".wk-cert-btn",
].join(", ");

/* progress windows of the three text morphs */
const OUT: [number, number] = [0, 0.4];
const TITLE: [number, number] = [0.5, 0.92];
const IN: [number, number] = [0.56, 1];
/* the portrait: glide, then hand over */
const GLIDE: [number, number] = [0.05, 0.45];
const SWAP: [number, number] = [0.45, 0.56];
/* inline box of the contact portrait while live (see measure) */
const BOX = ["left", "top", "width", "height", "right", "bottom"];

export class Finale {
  private contact: HTMLElement;
  private rep: HTMLElement;
  private cWrap: HTMLElement;
  private cPortrait: HTMLElement;
  private rWrap: HTMLElement;
  private rPortrait: HTMLElement;
  private cRibbons: SVGElement[];
  private rRibbons: SVGElement[];
  private rBase: number[] = [];
  private orbitLine: SVGElement | null;
  private band: HTMLElement | null;
  private tOut: DotMorph;
  private tTitle: DotMorph;
  private tIn: DotMorph;
  private raw = 0;
  /** the faces at rest (read in measure, before any glide is applied) */
  private cFace = { x: 0, y: 0, rx: 1, ry: 1 };
  private rFace = { x: 0, y: 0, rx: 1, ry: 1 };
  private move = { tx: 0, ty: 0, s: 1 };

  constructor(root: HTMLElement) {
    const q = <T extends Element>(r: ParentNode, s: string) => r.querySelector<T>(s)!;
    const qa = <T extends Element>(r: ParentNode, s: string) => [...r.querySelectorAll<T>(s)];
    this.contact = q(root, ".wk-contact");
    this.rep = q(root, ".wk-reprise");
    this.cWrap = q(this.contact, ".wk-contact-portrait");
    this.cPortrait = q(this.cWrap, ".portrait");
    this.rWrap = q(this.rep, ".wk-hero-portrait");
    this.rPortrait = q(this.rWrap, ".portrait");
    this.cRibbons = qa(this.contact, ".wk-contact-field svg.ribbon");
    this.rRibbons = qa(this.rep, ".wk-hero-field svg.ribbon");
    this.orbitLine = this.rep.querySelector(".wk-orbit-line");
    this.band = this.rep.querySelector(".wk-experience");

    // the title's dots become the name; the rest of the contact text goes
    // into the contact face; the opening's copy comes out of the hero face
    this.tTitle = new DotMorph({
      from: { text: qa<HTMLElement>(this.contact, ".wk-contact-title") },
      to: { text: qa<HTMLElement>(this.rep, ".wk-title") },
      anchor: root,
      salt: 3,
    });
    this.tOut = new DotMorph({
      from: {
        text: qa<HTMLElement>(this.contact, ".wk-contact-copy > .wk-rule, .wk-contact-place, .wk-contact-field .wk-float, .wk-contact-links li"),
      },
      to: { region: () => this.cFace },
      anchor: root,
      salt: 5,
    });
    this.tIn = new DotMorph({
      from: { region: () => this.rFace },
      to: { text: qa<HTMLElement>(this.rep, HERO_TEXT) },
      anchor: root,
      salt: 9,
    });

  }

  private reset() {
    const clr = (e: HTMLElement | SVGElement, ...k: string[]) => k.forEach((x) => e.style.removeProperty(x));
    clr(this.rep, "visibility");
    clr(this.contact, "visibility");
    clr(this.cWrap, "transform", "transform-origin", "opacity", ...BOX);
    clr(this.rWrap, "opacity");
    for (const r of [...this.cRibbons, ...this.rRibbons]) clr(r, "opacity");
    if (this.orbitLine) clr(this.orbitLine, "opacity");
    if (this.band) clr(this.band, "--band");
  }

  /** Read the rest layout (clears all inline state first). */
  measure() {
    this.reset();
    this.rBase = this.rRibbons.map((r) => parseFloat(getComputedStyle(r).opacity) || 1);
    // the contact portrait takes the hero portrait's box (same bottom-centre
    // as its own), so the bust is drawn at the hero's scale and dot pitch and
    // the glide below is a pure translation (no shrink at any viewport)
    const c = this.cWrap;
    const rw = this.rWrap.offsetWidth;
    const rh0 = this.rWrap.offsetHeight;
    const cs = c.style;
    cs.left = `${Math.round(c.offsetLeft + (c.offsetWidth - rw) / 2)}px`;
    cs.top = `${c.offsetTop + c.offsetHeight - rh0}px`;
    cs.width = `${rw}px`;
    cs.height = `${rh0}px`;
    cs.right = "auto";
    cs.bottom = "auto";
    // portrait glide: map the contact head onto the hero head
    const ch: Head = headOf(this.cPortrait);
    const rh: Head = headOf(this.rPortrait);
    const cr = this.cWrap.getBoundingClientRect();
    const s = rh.r / Math.max(1, ch.r);
    this.move = {
      s,
      tx: Math.round(rh.x - cr.left - s * (ch.x - cr.left)),
      ty: Math.round(rh.y - cr.top - s * (ch.y - cr.top)),
    };
    this.cFace = faceRegion(this.cPortrait);
    this.rFace = faceRegion(this.rPortrait);
    for (const m of [this.tOut, this.tTitle, this.tIn]) m.measure().then(() => this.update(this.raw));
  }

  update(raw: number) {
    this.raw = raw;
    const q = snapProgress(raw);
    const rs = this.rep.style;
    rs.visibility = q <= 0 ? "hidden" : "";
    this.contact.style.visibility = q >= 1 ? "hidden" : "";

    // contact text and icons go into the dots; the hero's come out of them
    this.tOut.update(norm(q, ...OUT));
    this.tTitle.update(norm(q, ...TITLE));
    this.tIn.update(norm(q, ...IN));

    // ribbons, orbit line and the experience band
    const cOut = 1 - ease(norm(q, 0, 0.3));
    for (const r of this.cRibbons)
      if (q <= 0) r.style.removeProperty("opacity");
      else r.style.opacity = f3(cOut);
    const rIn = ease(norm(q, 0.6, 0.95));
    const done = q >= 1;
    this.rRibbons.forEach((r, i) => {
      if (done) r.style.removeProperty("opacity");
      else r.style.opacity = f3(rIn * (this.rBase[i] ?? 1));
    });
    if (this.orbitLine) {
      if (done) this.orbitLine.style.removeProperty("opacity");
      else this.orbitLine.style.opacity = f3(ease(norm(q, 0.6, 0.95)));
    }
    if (this.band) {
      if (done) this.band.style.removeProperty("--band");
      else this.band.style.setProperty("--band", f3(norm(q, 0.6, 0.92)));
    }

    // portrait: glide onto the hero portrait, then hand over
    const cw = this.cWrap.style;
    const m = ease(norm(q, ...GLIDE));
    if (q <= 0) {
      for (const k of ["transform", "transform-origin", "opacity"]) cw.removeProperty(k);
    } else {
      const { tx, ty, s } = this.move;
      cw.transformOrigin = "0 0";
      cw.transform = `translate(${f2(tx * m)}px,${f2(ty * m)}px) scale(${f3(lerp(1, s, m))})`;
      // the hero portrait is fully in before the contact one leaves (no dip)
      cw.opacity = f3(1 - smooth(norm(q, SWAP[0] + 0.03, SWAP[1])));
    }
    if (done) this.rWrap.style.removeProperty("opacity");
    else this.rWrap.style.opacity = f3(smooth(norm(q, SWAP[0], SWAP[1] - 0.03)));
  }

  destroy() {
    this.reset();
    this.tOut.destroy();
    this.tTitle.destroy();
    this.tIn.destroy();
  }
}
