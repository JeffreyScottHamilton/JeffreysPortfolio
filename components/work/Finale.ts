/**
 * Contact → opening, in place (motion allowed, all widths).
 *
 * The contact section is pinned; over the pin (q ∈ [0, 1], scrubbed,
 * reversible) the page turns back into its own opening without scrolling on:
 *
 *   0.00–0.42  Provo, the rule and the floating letters dissolve into dots
 *              that stream into the contact portrait's face; the link icons
 *              are absorbed into it; the contact ribbons fade.
 *   0.06–0.85  "Let's build something useful." dissolves into dots that
 *              travel and re-form as "Jeffrey Hamilton" in the hero title
 *              position (shared text ⇄ dots, components/shared/dotText.ts).
 *   0.18–0.86  the contact portrait glides onto the hero portrait and hands
 *              over to it.
 *   0.45–1.00  the rest of the hero composition emerges from the dots: the
 *              copy forms from the face's dots; certificate arc, experience
 *              strip, ribbons.
 *
 * At q = 1 (max scroll) every inline style on the reprise is gone, so the
 * frame is the hero at scrollY 0 and the shell's loop jump is invisible.
 */
import { Absorb, faceRegion, headOf, norm, type Head } from "./absorb";
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
].join(", ");
/** reprise pieces (not text) that emerge from the face */
const HERO_PIECES = [".wk-selected > svg", ".wk-cert-btn"].join(", ");

/* progress windows of the three text morphs */
const OUT: [number, number] = [0, 0.42];
const TITLE: [number, number] = [0.06, 0.85];
const IN: [number, number] = [0.45, 1];

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
  private out: Absorb;
  private inn: Absorb;
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
        text: qa<HTMLElement>(this.contact, ".wk-contact-copy > .wk-rule, .wk-contact-place, .wk-contact-field .wk-float"),
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

    this.out = new Absorb(
      qa<HTMLElement>(this.contact, ".wk-contact-links li"),
      () => headOf(this.cPortrait),
      { from: 0, to: 0.42, dur: 0.2, salt: 5 },
    );
    this.inn = new Absorb(
      qa<HTMLElement>(this.rep, HERO_PIECES),
      () => headOf(this.rPortrait),
      { from: 0, to: 1, dur: 0.42, salt: 9 },
    );
  }

  private reset() {
    const clr = (e: HTMLElement | SVGElement, ...k: string[]) => k.forEach((x) => e.style.removeProperty(x));
    clr(this.rep, "visibility");
    clr(this.contact, "visibility");
    clr(this.cWrap, "transform", "transform-origin", "opacity");
    clr(this.rWrap, "opacity");
    for (const r of [...this.cRibbons, ...this.rRibbons]) clr(r, "opacity");
    if (this.orbitLine) clr(this.orbitLine, "opacity");
    if (this.band) clr(this.band, "--band");
  }

  /** Read the rest layout (clears all inline state first). */
  measure() {
    this.reset();
    this.rBase = this.rRibbons.map((r) => parseFloat(getComputedStyle(r).opacity) || 1);
    // portrait glide: map the contact head onto the hero head
    const ch: Head = headOf(this.cPortrait);
    const rh: Head = headOf(this.rPortrait);
    const cr = this.cWrap.getBoundingClientRect();
    const s = rh.r / Math.max(1, ch.r);
    this.move = {
      s,
      tx: rh.x - cr.left - s * (ch.x - cr.left),
      ty: rh.y - cr.top - s * (ch.y - cr.top),
    };
    this.out.measure();
    this.inn.measure();
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

    // contact pieces go into the dots; the hero pieces come out of them
    this.out.update(q);
    this.inn.update(1 - norm(q, 0.45, 1));
    this.tOut.update(norm(q, ...OUT));
    this.tTitle.update(norm(q, ...TITLE));
    this.tIn.update(norm(q, ...IN));

    // ribbons, orbit line and the experience band
    const cOut = 1 - ease(norm(q, 0, 0.3));
    for (const r of this.cRibbons)
      if (q <= 0) r.style.removeProperty("opacity");
      else r.style.opacity = f3(cOut);
    const rIn = ease(norm(q, 0.55, 0.95));
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
      else this.band.style.setProperty("--band", f3(norm(q, 0.5, 0.9)));
    }

    // portrait: glide onto the hero portrait, then hand over
    const cw = this.cWrap.style;
    const m = ease(norm(q, 0.18, 0.7));
    if (q <= 0) {
      for (const k of ["transform", "transform-origin", "opacity"]) cw.removeProperty(k);
    } else {
      const { tx, ty, s } = this.move;
      cw.transformOrigin = "0 0";
      cw.transform = `translate(${f2(tx * m)}px,${f2(ty * m)}px) scale(${f3(lerp(1, s, m))})`;
      cw.opacity = f3(1 - smooth(norm(q, 0.6, 0.86)));
    }
    if (done) this.rWrap.style.removeProperty("opacity");
    else this.rWrap.style.opacity = f3(smooth(norm(q, 0.55, 0.85)));
  }

  destroy() {
    this.reset();
    this.out.destroy();
    this.inn.destroy();
    this.tOut.destroy();
    this.tTitle.destroy();
    this.tIn.destroy();
  }
}
