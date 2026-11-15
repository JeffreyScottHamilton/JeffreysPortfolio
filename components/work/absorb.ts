/**
 * "Absorb into the dots": a set of small DOM pieces (letters, words, icons)
 * each travel along a gentle curve into the face of a portrait, shrinking to
 * a dot and turning into a dot-coloured disc as they arrive. A pure function
 * of a scrubbed progress p (reversible; p ≤ start of a piece = its exact
 * rest state with no inline transform). Run it backwards to make pieces
 * emerge from the dots instead.
 *
 * CSS side (styles/work.css): `[data-ab]::after` is the disc, sized by
 * `--ab-d` and shown by `--disc`; element children fade with `--disc`.
 */
import { computeLayout, hash01 } from "@/lib/halftone";

export type Piece = HTMLElement | SVGElement;
export type Head = { x: number; y: number; r: number };

type Unit = {
  el: Piece;
  dx: number;
  dy: number;
  cx: number;
  cy: number;
  t0: number;
  t1: number;
  base: string;
  ink: string | null; // text colour (faded to the disc)
  fill: string | null; // background colour of plain boxes (rules)
  on: boolean;
};

export type AbsorbOpts = {
  /** progress window the whole set spans */
  from: number;
  to: number;
  /** each piece's own flight, in progress units */
  dur: number;
  salt?: number;
  /** final scale of a piece (≈ one dot) */
  scale?: number;
  /** on-screen disc diameter at arrival, px */
  disc?: number;
  /** spread of the landing points, × the head radius */
  spread?: number;
};

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const norm = (x: number, a: number, b: number) =>
  clamp((x - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);
const f2 = (x: number) => x.toFixed(2);
const f3 = (x: number) => x.toFixed(3);

const PROPS = [
  "transform",
  "opacity",
  "color",
  "background-color",
  "pointer-events",
  "visibility",
  "--disc",
  "--ab-d",
];

/** The head of a bust Portrait (root element), in viewport px. */
export function headOf(portraitRoot: HTMLElement): Head {
  const r = portraitRoot.getBoundingClientRect();
  const L = computeLayout(
    Math.max(1, Math.round(portraitRoot.clientWidth)),
    Math.max(1, Math.round(portraitRoot.clientHeight)),
    "bust",
  );
  return { x: r.left + L.headX, y: r.top + L.headY, r: L.headR };
}

/** The face of a bust Portrait as an ellipse (dots dissolve into / form out of it). */
export function faceRegion(portraitRoot: HTMLElement) {
  const h = headOf(portraitRoot);
  return { x: h.x, y: h.y, rx: h.r * 0.72, ry: h.r * 0.9 };
}

export class Absorb {
  private units: Unit[] = [];
  private els: Piece[];
  private head: () => Head;
  private o: Required<AbsorbOpts>;

  constructor(els: Piece[], head: () => Head, o: AbsorbOpts) {
    this.els = els;
    this.head = head;
    this.o = { salt: 1, scale: 0.08, disc: 3.4, spread: 0.85, ...o };
  }

  private clear(el: Piece) {
    for (const k of PROPS) el.style.removeProperty(k);
  }

  /** Back to the untouched DOM (no inline styles at all). */
  destroy() {
    for (const el of this.els) {
      this.clear(el);
      el.style.removeProperty("transition");
      el.style.removeProperty("position");
      delete el.dataset.ab;
    }
    this.units = [];
  }

  /** Read rest positions (clears every inline style first). */
  measure() {
    for (const el of this.els) this.clear(el);
    const { from, to, dur, salt, spread } = this.o;
    const h = this.head();
    const raw = this.els
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { el, x: r.left + r.width / 2, y: r.top + r.height / 2, ok: r.width > 0 && r.height > 0 };
      })
      .filter((u) => u.ok);
    let far = 1;
    for (const u of raw) far = Math.max(far, Math.hypot(u.x - h.x, u.y - h.y));
    this.units = raw.map(({ el, x, y }, i) => {
      // landing point: somewhere in the face, seeded
      const a = hash01(i, salt, 11) * Math.PI * 2;
      const rr = Math.sqrt(hash01(i, salt, 12)) * h.r * spread;
      const tx = h.x + Math.cos(a) * rr * 0.8;
      const ty = h.y + Math.sin(a) * rr;
      const dx = tx - x;
      const dy = ty - y;
      // a gentle curve: control point off the chord, a little upwards
      const bend = (0.12 + 0.18 * hash01(i, salt, 13)) * (hash01(i, salt, 14) < 0.5 ? -1 : 1);
      const cx = dx * 0.5 - dy * bend;
      const cy = dy * 0.5 + dx * bend - Math.hypot(dx, dy) * 0.08;
      // nearest pieces go first, with a little seeded jitter
      const k = clamp(0.72 * (Math.hypot(dx, dy) / far) + 0.28 * hash01(i, salt, 15));
      const t0 = from + (to - from - dur) * k;
      const cs = getComputedStyle(el);
      const hasEls = el.childElementCount > 0;
      const text = !hasEls && (!!el.textContent?.trim() || el.hasAttribute("data-text"));
      // a containing block for the disc (never for pieces with offsets of
      // their own, which would start to apply)
      if (cs.position === "static" && cs.left === "auto" && cs.top === "auto")
        el.style.position = "relative";
      el.style.transition = "none";
      el.dataset.ab = "";
      const fill = !hasEls && !text ? cs.backgroundColor : null;
      return {
        el,
        dx,
        dy,
        cx,
        cy,
        t0,
        t1: t0 + dur,
        base: cs.transform && cs.transform !== "none" ? cs.transform : "",
        ink: fill ? null : cs.color,
        fill,
        on: false,
      };
    });
  }

  update(p: number) {
    const { scale, disc } = this.o;
    for (const u of this.units) {
      const t = norm(p, u.t0, u.t1);
      const s = u.el.style;
      if (t <= 0) {
        if (u.on) {
          this.clear(u.el);
          u.on = false;
        }
        continue;
      }
      u.on = true;
      const e = smooth(t);
      const bx = 2 * (1 - e) * e * u.cx + e * e * u.dx;
      const by = 2 * (1 - e) * e * u.cy + e * e * u.dy;
      const k = 1 + (scale - 1) * Math.pow(e, 0.85);
      const d = smooth(norm(t, 0.42, 0.82));
      s.transform = `translate(${f2(bx)}px,${f2(by)}px) ${u.base} scale(${f3(k)})`;
      s.opacity = f3(1 - norm(t, 0.84, 1));
      s.visibility = t >= 1 ? "hidden" : "";
      s.pointerEvents = "none";
      s.setProperty("--disc", f3(d));
      // the disc keeps one on-screen size whatever the piece's scale
      s.setProperty("--ab-d", `${f2(disc / k)}px`);
      const keep = `${f2((1 - d) * 100)}%`;
      if (u.ink) s.color = `color-mix(in srgb, ${u.ink} ${keep}, transparent)`;
      if (u.fill) s.backgroundColor = `color-mix(in srgb, ${u.fill} ${keep}, transparent)`;
    }
  }
}
