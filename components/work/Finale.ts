/**
 * Contact → opening, in place (motion allowed, all widths).
 *
 * The contact section is pinned; over the pin (q ∈ [0, 1], scrubbed,
 * reversible) the page turns back into its own opening without scrolling on:
 *
 *   0.00–0.42  Provo, the rule, the link icons, the floating letters and the
 *              title letters that aren't needed are absorbed into the
 *              contact portrait's dots; the contact ribbons fade.
 *   0.06–0.85  the remaining letters of "Let's build something useful." fly
 *              (each on its own curve, resizing) into "Jeffrey Hamilton" in
 *              the hero title position.
 *   0.18–0.86  the contact portrait glides onto the hero portrait and hands
 *              over to it.
 *   0.45–1.00  the rest of the hero composition emerges from the dots:
 *              copy, certificate arc, experience strip, ribbons.
 *
 * At q = 1 (max scroll) every inline style on the reprise is gone, so the
 * frame is the hero at scrollY 0 and the shell's loop jump is invisible.
 */
import { Absorb, headOf, norm, type Head } from "./absorb";
import { hash01 } from "@/lib/halftone";
import { snapProgress } from "./HalftoneMorph";

const smooth = (t: number) => t * t * (3 - 2 * t);
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const f2 = (x: number) => x.toFixed(2);
const f3 = (x: number) => x.toFixed(3);

type Pair = {
  src: HTMLElement;
  dst: HTMLElement;
  // measured
  sx: number;
  sy: number;
  dx: number;
  dy: number;
  k: number; // src height / dst height
  cx: number;
  cy: number;
  t0: number;
  t1: number;
};

const HERO_PIECES = [
  ".wk-sub .wk-w",
  ".wk-hero-copy > .wk-rule",
  ".wk-statement .wk-w",
  ".wk-kinds .wk-w",
  ".wk-selected .wk-w",
  ".wk-selected > svg",
  ".wk-orbit-label .wk-w",
  ".wk-cert-btn",
  ".wk-experience .wk-w",
  ".wk-slash",
  ".wk-sep-dot",
  ".wk-hero-field .wk-float",
].join(", ");

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
  private pairs: Pair[] = [];
  private out: Absorb;
  private inn: Absorb;
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

    // which contact letter becomes which title letter: same letter where
    // possible, otherwise the free letter at the most similar position
    const src = qa<HTMLElement>(this.contact, ".wk-contact-title .gather-ch");
    const dst = qa<HTMLElement>(this.rep, ".wk-title .gather-ch");
    const used = new Set<number>();
    const ch = (e: HTMLElement) => (e.textContent ?? "").toLowerCase();
    const pick = (i: number) => {
      const want = ch(dst[i]);
      const at = (i / Math.max(1, dst.length - 1)) * (src.length - 1);
      let best = -1;
      let bestD = Infinity;
      for (let pass = 0; pass < 2 && best < 0; pass++)
        src.forEach((s, j) => {
          if (used.has(j) || (pass === 0 && ch(s) !== want)) return;
          const d = Math.abs(j - at);
          if (d < bestD) {
            bestD = d;
            best = j;
          }
        });
      return best;
    };
    dst.forEach((d, i) => {
      const j = pick(i);
      if (j < 0) return;
      used.add(j);
      this.pairs.push({ src: src[j], dst: d, sx: 0, sy: 0, dx: 0, dy: 0, k: 1, cx: 0, cy: 0, t0: 0, t1: 1 });
    });
    const spare = src.filter((_s, j) => !used.has(j));

    this.out = new Absorb(
      [
        ...spare,
        ...qa<HTMLElement>(
          this.contact,
          ".wk-contact-title .dot-accent, .wk-contact-copy > .wk-rule, .wk-contact-place .wk-w, .wk-contact-links li, .wk-contact-field .wk-float",
        ),
      ],
      () => headOf(this.cPortrait),
      { from: 0, to: 0.42, dur: 0.2, salt: 5 },
    );
    this.inn = new Absorb(
      qa<HTMLElement>(this.rep, HERO_PIECES),
      () => headOf(this.rPortrait),
      { from: 0, to: 1, dur: 0.42, salt: 9 },
    );
    for (const p of this.pairs)
      for (const e of [p.src, p.dst]) e.style.transition = "none";
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
    for (const p of this.pairs)
      for (const e of [p.src, p.dst]) clr(e, "transform", "opacity", "visibility");
  }

  /** Read the rest layout (clears all inline state first). */
  measure() {
    this.reset();
    this.rBase = this.rRibbons.map((r) => parseFloat(getComputedStyle(r).opacity) || 1);
    const box = (e: Element) => {
      const r = e.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height || 1 };
    };
    const n = this.pairs.length;
    this.pairs.forEach((p, i) => {
      const s = box(p.src);
      const d = box(p.dst);
      p.sx = s.x;
      p.sy = s.y;
      p.dx = d.x;
      p.dy = d.y;
      p.k = s.h / d.h;
      const vx = d.x - s.x;
      const vy = d.y - s.y;
      const bend = (0.1 + 0.16 * hash01(i, 3, 21)) * (i % 2 ? 1 : -1);
      p.cx = vx * 0.5 - vy * bend;
      p.cy = vy * 0.5 + vx * bend;
      p.t0 = 0.06 + 0.34 * (i / Math.max(1, n - 1)) + 0.05 * hash01(i, 3, 22);
      p.t1 = p.t0 + 0.4;
    });
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
  }

  update(raw: number) {
    const q = snapProgress(raw);
    const rs = this.rep.style;
    rs.visibility = q <= 0 ? "hidden" : "";
    this.contact.style.visibility = q >= 1 ? "hidden" : "";

    // contact pieces go into the dots; the hero pieces come out of them
    this.out.update(q);
    this.inn.update(1 - norm(q, 0.45, 1));

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

    // the letters rearrange into the name
    for (const p of this.pairs) {
      const t = norm(q, p.t0, p.t1);
      const ss = p.src.style;
      const ds = p.dst.style;
      if (t <= 0) {
        for (const k of ["transform", "opacity", "visibility"]) ss.removeProperty(k);
        ds.opacity = "0";
        ds.removeProperty("transform");
        continue;
      }
      if (t >= 1) {
        ss.visibility = "hidden";
        ss.opacity = "0";
        for (const k of ["transform", "opacity", "visibility"]) ds.removeProperty(k);
        continue;
      }
      const e = ease(t);
      const vx = p.dx - p.sx;
      const vy = p.dy - p.sy;
      const bx = 2 * (1 - e) * e * p.cx + e * e * vx;
      const by = 2 * (1 - e) * e * p.cy + e * e * vy;
      const x = smooth(norm(t, 0.3, 0.7));
      const sk = lerp(1, 1 / p.k, e); // src scale
      ss.removeProperty("visibility");
      ss.transform = `translate(${f2(bx)}px,${f2(by)}px) scale(${f3(sk)})`;
      ss.opacity = f3(1 - x);
      ds.transform = `translate(${f2(bx - vx)}px,${f2(by - vy)}px) scale(${f3(sk * p.k)})`;
      ds.opacity = f3(x);
    }
  }

  destroy() {
    this.reset();
    this.out.destroy();
    this.inn.destroy();
    for (const p of this.pairs)
      for (const e of [p.src, p.dst]) e.style.removeProperty("transition");
  }
}
