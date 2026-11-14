/**
 * Work hero → project board set piece (desktop ≥1025, motion allowed).
 *
 * One crisp SVG "pen line" in the hero ribbon's material, driven by a single
 * scrubbed progress p ∈ [0, 1] (pure function of p: reversible, still at rest):
 *
 *   0.00–0.25  the bottom "jeffrey Hamilton" ribbon rises and closes into a
 *              circle around the portrait; the letters end up riding the
 *              outside of the ring, upright across the top. Copy, certificates
 *              and the experience strip fade out to the left.
 *   0.25–0.40  the portrait softly fades and settles inside the ring, which
 *              tightens a little.
 *   0.40–0.60  the ring unspools: like a pen the line leaves it and traces the
 *              Plainkit outline, then the Bedulo outline, at featured size.
 *              Each card wipes in (top → bottom) as its outline closes, then
 *              its title fades up.
 *   0.67–0.79  the pair glides into its slot at the top of the board; the
 *              outline strokes cross-fade into the cards' real borders.
 *   0.80–0.98  the other nine rows pop in one by one, each with a quick stroke
 *              around its preview strip; then "More experiments".
 *
 * The line is drawn as several pieces (ring, connector, outline, connector,
 * outline, 9 strip outlines). Each piece is a set of dotted strands revealed
 * through a solid mask stroke (pathLength = 1, dash window), so the dots never
 * crawl while the line draws. Geometry is measured from the DOM on refresh.
 */
import { computeLayout } from "@/lib/halftone";

export type PenEls = {
  host: HTMLElement; // where the fixed SVG overlay is appended
  stage: HTMLElement; // pinned wrapper; hero sits at its top-left
  portraitWrap: HTMLElement; // .wk-hero-portrait
  portrait: HTMLElement; // the .portrait root inside it
  ribbon: SVGSVGElement | null; // main hero ribbon (with letters)
  ribbon2: SVGSVGElement | null;
  slideOut: HTMLElement[]; // copy, orbit, experience, floating letters
  board: HTMLElement; // section#projects
};

type Pt = [number, number];
type Rect = { x: number; y: number; w: number; h: number };

const NS = "http://www.w3.org/2000/svg";
const N = 240; // samples along the ribbon → ring morph
// spaced like the hero ribbon; the word gap opens up as the ring closes
const WORD1 = "j e f f r e y ";
const WORD2 = "H a m i l t o n";
const RAD = 12; // card corner radius
const SKEW = Math.tan((-9 * Math.PI) / 180);
const ROT = (-12 * Math.PI) / 180;
const PERSP = 1200;

/* timeline */
const MORPH0 = 0.015;
const MORPH1 = 0.25;
const FADE0 = 0.25;
const FADE1 = 0.4;
const PEN0 = 0.4;
const PEN1 = 0.6;
const WIPE = 0.035;
const GLIDE0 = 0.67;
const GLIDE1 = 0.79;
const ROW0 = 0.8;
const ROW_STEP = 0.0165;
const ROW_DUR = 0.04;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const norm = (x: number, a: number, b: number) => clamp((x - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const sine = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2;
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const f1 = (x: number) => x.toFixed(1);
const f3 = (x: number) => x.toFixed(3);

/** Strands of the ribbon material: [offset, colour, width, dash, opacity]. */
const STRANDS: [number, string, number, string, number][] = [
  [-4.4, "var(--fringe-red)", 1.5, "0 5", 0.85],
  [-2, "var(--ink)", 1.1, "0 7", 0.4],
  [0, "var(--ink)", 2.2, "0 6", 1],
  [2, "var(--ink)", 1.1, "0 5", 0.4],
  [4.4, "var(--fringe-cyan)", 1.5, "0 5", 0.85],
];
const ROW_STRANDS = [STRANDS[0], STRANDS[2], STRANDS[4]];

/** One drawable piece: dotted strands revealed through a mask window. */
class Piece {
  g: SVGGElement;
  mask: SVGPathElement;
  strands: SVGPathElement[] = [];
  len = 1;
  private d = "";
  private win = "";

  constructor(svg: SVGSVGElement, defs: SVGDefsElement, id: string, row = false) {
    const m = document.createElementNS(NS, "mask");
    m.setAttribute("id", id);
    m.setAttribute("maskUnits", "userSpaceOnUse");
    m.setAttribute("x", "-200");
    m.setAttribute("y", "-200");
    m.setAttribute("width", "6000");
    m.setAttribute("height", "6000");
    this.mask = document.createElementNS(NS, "path");
    this.mask.setAttribute("fill", "none");
    this.mask.setAttribute("stroke", "#fff");
    this.mask.setAttribute("stroke-width", "16");
    this.mask.setAttribute("pathLength", "1");
    m.appendChild(this.mask);
    defs.appendChild(m);
    this.g = document.createElementNS(NS, "g");
    this.g.setAttribute("mask", `url(#${id})`);
    for (const [o, c, w, dash, op] of row ? ROW_STRANDS : STRANDS) {
      const s = document.createElementNS(NS, "path");
      s.setAttribute("fill", "none");
      s.setAttribute("stroke", c);
      s.setAttribute("stroke-width", String(row ? w * 0.85 : w));
      s.setAttribute("stroke-linecap", "round");
      s.setAttribute("stroke-dasharray", dash);
      s.setAttribute("opacity", String(op));
      if (o) s.setAttribute("transform", `translate(${o * 0.35} ${o})`);
      this.g.appendChild(s);
      this.strands.push(s);
    }
    svg.appendChild(this.g);
  }

  setD(d: string, measure = true) {
    if (d === this.d) return;
    this.d = d;
    this.mask.setAttribute("d", d);
    for (const s of this.strands) s.setAttribute("d", d);
    if (measure) this.len = this.strands[2 % this.strands.length].getTotalLength() || 1;
  }

  /** Show the fraction window [a, b] of the piece (0..1). */
  show(a: number, b: number, opacity = 1) {
    const vis = b - a > 0.0005 && opacity > 0.002;
    const w = vis ? `0 ${f3(a)} ${(b - a).toFixed(4)} 2` : "none";
    if (w !== this.win) {
      this.win = w;
      if (vis) this.mask.setAttribute("stroke-dasharray", w);
      this.g.style.display = vis ? "" : "none";
    }
    this.g.style.opacity = opacity >= 0.999 ? "" : f3(opacity);
  }

  set transform(t: string) {
    if (t) this.g.setAttribute("transform", t);
    else this.g.removeAttribute("transform");
  }
}

const polyD = (pts: Pt[]) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${f1(x)},${f1(y)}`).join("");

/** Rounded rect starting on the right edge just above the bottom-right corner, clockwise. */
function rectFromRight(r: Rect) {
  const x0 = r.x + 0.75;
  const y0 = r.y + 0.75;
  const x1 = r.x + r.w - 0.75;
  const y1 = r.y + r.h - 0.75;
  const q = Math.min(RAD, r.w / 2, r.h / 2);
  const a = `A${q},${q} 0 0 1`;
  return (
    `M${f1(x1)},${f1(y1 - q)}${a} ${f1(x1 - q)},${f1(y1)}L${f1(x0 + q)},${f1(y1)}` +
    `${a} ${f1(x0)},${f1(y1 - q)}L${f1(x0)},${f1(y0 + q)}${a} ${f1(x0 + q)},${f1(y0)}` +
    `L${f1(x1 - q)},${f1(y0)}${a} ${f1(x1)},${f1(y0 + q)}Z`
  );
}

/** Rounded rect starting on the left edge just above the bottom-left corner, clockwise. */
function rectFromLeft(r: Rect) {
  const x0 = r.x + 0.75;
  const y0 = r.y + 0.75;
  const x1 = r.x + r.w - 0.75;
  const y1 = r.y + r.h - 0.75;
  const q = Math.min(RAD, r.w / 2, r.h / 2);
  const a = `A${q},${q} 0 0 1`;
  return (
    `M${f1(x0)},${f1(y1 - q)}L${f1(x0)},${f1(y0 + q)}${a} ${f1(x0 + q)},${f1(y0)}` +
    `L${f1(x1 - q)},${f1(y0)}${a} ${f1(x1)},${f1(y0 + q)}L${f1(x1)},${f1(y1 - q)}` +
    `${a} ${f1(x1 - q)},${f1(y1)}L${f1(x0 + q)},${f1(y1)}${a} ${f1(x0)},${f1(y1 - q)}Z`
  );
}

type Geo = {
  base: Pt[]; // hero ribbon, stage px, resampled by arc length
  baseLen: number;
  cx: number;
  cy: number;
  R: number;
  fs: number; // ribbon letter size
  textLen: number;
  featY: number;
  featH: number;
  wx: number; // portrait wrapper at rest (stage px)
  wy: number;
  slot: Rect[]; // pair media in the finished board (stage px)
  rows: { pts: Pt[]; cx: number; cy: number }[];
};

export class PenLine {
  private els: PenEls;
  private svg: SVGSVGElement;
  private textPathEl: SVGTextPathElement;
  private text: SVGTextElement;
  private gapEl: SVGTSpanElement;
  private ribbonText: SVGTextElement | null;
  private ringRef: SVGPathElement;
  private ring: Piece;
  private conn1: Piece;
  private rectP: Piece;
  private conn2: Piece;
  private rectB: Piece;
  private rowPieces: Piece[];
  private pairMedia: HTMLElement[];
  private pairText: HTMLElement[];
  private rowEls: HTMLElement[];
  private head: HTMLElement | null;
  private foot: HTMLElement | null;
  private g: Geo | null = null;
  private p = 0;
  private destroyed = false;

  constructor(els: PenEls) {
    this.els = els;
    const uid = `pen${Math.floor(performance.now() % 1e6)}`;
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "wk-pen");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const defs = document.createElementNS(NS, "defs");
    svg.appendChild(defs);
    this.svg = svg;
    this.ringRef = document.createElementNS(NS, "path");
    this.ringRef.setAttribute("id", `${uid}-ring`);
    defs.appendChild(this.ringRef);
    this.ring = new Piece(svg, defs, `${uid}-m0`);
    this.conn1 = new Piece(svg, defs, `${uid}-m1`);
    this.rectP = new Piece(svg, defs, `${uid}-m2`);
    this.conn2 = new Piece(svg, defs, `${uid}-m3`);
    this.rectB = new Piece(svg, defs, `${uid}-m4`);
    this.text = document.createElementNS(NS, "text");
    this.text.setAttribute("class", "ribbon-text");
    this.text.setAttribute("fill", "var(--ink)");
    this.textPathEl = document.createElementNS(NS, "textPath");
    this.textPathEl.setAttribute("href", `#${uid}-ring`);
    const w1 = document.createElementNS(NS, "tspan");
    w1.textContent = WORD1;
    this.gapEl = document.createElementNS(NS, "tspan");
    this.gapEl.textContent = WORD2;
    this.textPathEl.append(w1, this.gapEl);
    this.text.appendChild(this.textPathEl);
    svg.appendChild(this.text);

    const b = els.board;
    const all = (s: string) => [...b.querySelectorAll<HTMLElement>(s)];
    this.pairMedia = all(".wk-pair-media");
    this.pairText = all(".wk-pair-text");
    this.rowEls = all(".wk-row");
    this.head = b.querySelector(".wk-board-head");
    this.foot = b.querySelector(".wk-board-foot");
    this.ribbonText = els.ribbon?.querySelector("text") ?? null;
    this.rowPieces = this.rowEls.map((_, i) => new Piece(svg, defs, `${uid}-r${i}`, true));
    els.host.appendChild(svg);
  }

  /** Remove every inline style the set piece writes on the board. */
  private resetBoard() {
    const { board } = this.els;
    for (const v of ["--bd-frame", "--bd-head", "--bd-foot", "pointer-events"])
      board.style.removeProperty(v);
    for (const m of this.pairMedia)
      for (const k of ["height", "bottom", "transform", "--wipe"]) m.style.removeProperty(k);
    for (const t of this.pairText)
      for (const k of ["transform", "--bd-text"]) t.style.removeProperty(k);
    for (const r of this.rowEls)
      for (const k of ["--pop", "--bd-img", "pointer-events"]) r.style.removeProperty(k);
  }

  /** Measure everything from the DOM (call on ScrollTrigger refresh). */
  measure() {
    if (this.destroyed) return;
    const { stage, portrait, ribbon, portraitWrap } = this.els;
    // measure at rest
    for (const k of ["transform", "opacity", "filter", "mask-image", "transition", "visibility"])
      portraitWrap.style.removeProperty(k);
    this.resetBoard();

    const sr = stage.getBoundingClientRect();
    const rel = (el: Element): Rect => {
      const r = el.getBoundingClientRect();
      return { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
    };
    const VW = innerWidth;
    const VH = innerHeight;
    this.svg.setAttribute("viewBox", `0 0 ${VW} ${VH}`);

    // the ring: around the head and shoulders of the portrait
    const pr = rel(portrait);
    const L = computeLayout(pr.w, pr.h, "bust");
    let R = L.headR * 1.95;
    R = Math.max(80, Math.min(R, (VH - 200) / 2));
    const cx = pr.x + L.headX;
    let cy = pr.y + L.headY + L.headR * 0.5;
    cy = clamp(cy, 120 + R, VH - 40 - R);

    // the hero ribbon in stage px (its middle strand)
    const src = ribbon?.querySelector<SVGPathElement>("defs path") ?? null;
    const m = ribbon?.getScreenCTM();
    const base: Pt[] = [];
    let baseLen = 1;
    let fs = 26;
    if (src && m) {
      baseLen = src.getTotalLength();
      for (let i = 0; i < N; i++) {
        const q = src.getPointAtLength((baseLen * i) / (N - 1));
        base.push([m.a * q.x + m.c * q.y + m.e - sr.left, m.b * q.x + m.d * q.y + m.f - sr.top]);
      }
      baseLen *= m.a;
      fs = 26 * m.a;
    } else {
      for (let i = 0; i < N; i++) base.push([lerp(-20, VW * 0.6, i / (N - 1)), VH - 60]);
      baseLen = VW * 0.6;
    }

    // featured pair: the slot width (≈44 vw each), ≈55 vh tall, centred
    const slot = this.pairMedia.map((el) => rel(el));
    const textH = this.pairText[0] ? this.pairText[0].offsetHeight + 10 : 40;
    const featH = Math.round(Math.min(VH * 0.55, VH - 220));
    const featY = Math.round(Math.max(110, (VH - featH - textH) / 2));

    // preview strips: their on-screen parallelograms (rotateY + skewX, origin
    // right centre, parent perspective about the wrapper centre)
    const cosR = Math.cos(ROT);
    const sinR = Math.sin(ROT);
    const rows = this.rowEls.map((row) => {
      const wrap = row.querySelector<HTMLElement>(".wk-row-strip");
      const strip = wrap?.querySelector<HTMLElement>(".wk-strip");
      const lr = rel(row);
      const out = { pts: [] as Pt[], cx: lr.x + lr.w / 2, cy: lr.y + lr.h / 2 };
      if (!wrap || !strip) return out;
      const wr = rel(wrap);
      const x = wr.x + strip.offsetLeft;
      const y = wr.y + strip.offsetTop;
      const w = strip.offsetWidth;
      const h = strip.offsetHeight;
      const px = wr.x + wr.w / 2;
      const py = wr.y + wr.h / 2;
      const ox = x + w;
      const oy = y + h / 2;
      const proj = (u: number, v: number): Pt => {
        const lx = u - ox + SKEW * (v - oy);
        const ly = v - oy;
        const rz = -lx * sinR;
        const f = PERSP / (PERSP - rz);
        return [px + (ox + lx * cosR - px) * f, py + (oy + ly - py) * f];
      };
      // start at the bottom-left corner, up the left edge, clockwise
      out.pts = [proj(x, y + h), proj(x, y), proj(x + w, y), proj(x + w, y + h), proj(x, y + h)];
      return out;
    });

    const wr = rel(portraitWrap);
    this.g = { base, baseLen, cx, cy, R, fs, textLen: 0, featY, featH, wx: wr.x, wy: wr.y, slot, rows };
    this.text.style.fontSize = `${f1(fs)}px`;
    this.textPathEl.setAttribute("startOffset", "0");
    this.ringRef.setAttribute("d", polyD(base));
    this.gapEl.setAttribute("dx", f1(fs * 0.55));
    this.g.textLen = this.text.getComputedTextLength() || 300;
    this.gapEl.setAttribute("dx", "0");
    this.rowPieces.forEach((pc, i) => pc.setD(polyD(rows[i].pts)));
    this.update(this.p);
  }

  /** Ring radius at progress p (tightens a little while the portrait fades). */
  private radius(p: number) {
    return this.g!.R * (1 - 0.1 * ease(norm(p, FADE0, FADE1)));
  }

  /** Ribbon → circle (clockwise from the bottom of the ring), morph t ∈ [0, 1]. */
  private ringPts(t: number, R: number): Pt[] {
    const { base, cx, cy } = this.g!;
    const out: Pt[] = [];
    for (let i = 0; i < N; i++) {
      const th = Math.PI / 2 + (i / (N - 1)) * Math.PI * 2;
      const x = cx + R * Math.cos(th);
      const y = cy + R * Math.sin(th);
      if (t >= 1) out.push([x, y]);
      else {
        // the far end of the ribbon arrives a little later: it reads as rising
        const k = ease(clamp(t * 1.25 - (i / (N - 1)) * 0.25));
        out.push([lerp(base[i][0], x, k), lerp(base[i][1], y, k)]);
      }
    }
    return out;
  }

  /** Featured ↔ slot blend for the pair (1 = featured, 0 = in the board). */
  private cardRect(i: number, k: number): Rect {
    const { slot, featY, featH } = this.g!;
    const s = slot[i];
    return { x: s.x, y: lerp(s.y, featY, k), w: s.w, h: lerp(s.h, featH, k) };
  }

  /** Sync DOM state for progress p (called from the ScrollTrigger). */
  update(p: number) {
    if (this.destroyed) return;
    this.p = p;
    const { slideOut, ribbon, ribbon2, portraitWrap, board } = this.els;
    const g = this.g;
    const rest = p <= 0;
    const done = p >= 1;

    // hero copy, certificates and experience: quick fade to the left
    const a = ease(norm(p, 0, 0.12));
    for (const el of slideOut) {
      if (rest) {
        for (const k of ["transform", "opacity", "transition", "visibility"])
          el.style.removeProperty(k);
      } else {
        el.style.transition = "none";
        el.style.transform = `translate3d(${f3(-a * 10)}vw,0,0)`;
        el.style.opacity = f3(1 - a);
        el.style.visibility = a >= 1 ? "hidden" : "";
      }
    }

    // the hero ribbons hand over to the pen line
    const hand = norm(p, 0, 0.03);
    if (ribbon) {
      if (rest || !g) ribbon.style.removeProperty("opacity");
      else ribbon.style.opacity = f3(1 - hand);
    }
    if (this.ribbonText) {
      if (rest || !g) this.ribbonText.style.removeProperty("visibility");
      else this.ribbonText.style.visibility = "hidden";
    }
    if (ribbon2) {
      if (rest || !g) ribbon2.style.removeProperty("opacity");
      else ribbon2.style.opacity = f3(0.55 * (1 - norm(p, 0, 0.1)));
    }

    // portrait: masked into the ring, then a soft fade inside it
    const pw = portraitWrap.style;
    if (rest || !g) {
      for (const k of ["transform", "opacity", "filter", "mask-image", "transition", "transform-origin", "visibility"])
        pw.removeProperty(k);
    } else {
      const R = this.radius(p);
      const ox = g.cx - g.wx;
      const oy = g.cy - g.wy;
      const mk = ease(norm(p, 0.03, MORPH1));
      const far = Math.hypot(innerWidth, innerHeight);
      const rr = lerp(far, R - 6, mk);
      const f = ease(norm(p, FADE0, FADE1));
      pw.transition = "none";
      pw.transformOrigin = `${f1(ox)}px ${f1(oy)}px`;
      pw.transform = f > 0 ? `scale(${(1 - 0.08 * f).toFixed(4)})` : "";
      pw.opacity = f3(1 - f);
      pw.filter = f > 0.001 ? `blur(${f1(f * 2)}px)` : "";
      pw.maskImage = `radial-gradient(circle at ${f1(ox)}px ${f1(oy)}px, #000 ${f1(Math.max(0, rr - 46))}px, transparent ${f1(rr)}px)`;
      pw.visibility = f >= 1 ? "hidden" : "";
    }

    const live = !!g && !rest && !done;
    this.svg.style.visibility = live ? "visible" : "hidden";

    // ------------------------------------------------------------ the line
    let wipe = [0, 0];
    let textAt = [PEN1, PEN1 + 0.04];
    let k = 0; // featured (1) → slot (0)
    if (g && live) {
      const R = this.radius(p);
      const ringT = norm(p, MORPH0, MORPH1);
      const pts = this.ringPts(ringT, R);
      const ringD = polyD(pts);
      this.ring.setD(ringD);
      this.ringRef.setAttribute("d", ringD);

      k = 1 - ease(norm(p, GLIDE0, GLIDE1));
      const P = this.cardRect(0, k);
      const B = this.cardRect(1, k);
      const bx = g.cx;
      const by = g.cy + R;
      const pex = P.x + P.w - 0.75;
      const pey = P.y + P.h - 0.75 - RAD;
      const c1 = Math.max(60, (bx - pex) * 0.55);
      this.conn1.setD(
        `M${f1(bx)},${f1(by)}C${f1(bx - c1)},${f1(by)} ${f1(pex)},${f1(pey - Math.max(80, Math.abs(by - pey)) * 0.9)} ${f1(pex)},${f1(pey)}`,
      );
      this.rectP.setD(rectFromRight(P));
      const bsx = B.x + 0.75;
      const dip = 64;
      this.conn2.setD(
        `M${f1(pex)},${f1(pey)}C${f1(pex)},${f1(pey + dip)} ${f1(bsx)},${f1(pey + dip)} ${f1(bsx)},${f1(pey)}`,
      );
      this.rectB.setD(rectFromLeft(B));

      // pen position along ring → conn1 → rectP → conn2 → rectB (px)
      const Lr = this.ring.len;
      const lens = [Lr, this.conn1.len, this.rectP.len, this.conn2.len, this.rectB.len];
      const starts = [0];
      for (let i = 1; i < 5; i++) starts.push(starts[i - 1] + lens[i - 1]);
      const total = starts[4] + lens[4];
      const u = sine(norm(p, PEN0, PEN1));
      const T = lerp(Lr, total, u);
      const S = Math.max(0, T - Lr);
      const pieces = [this.ring, this.conn1, this.rectP, this.conn2, this.rectB];
      const sticky = [false, false, true, false, true];
      const fadeOut = 1 - ease(norm(p, GLIDE0 + 0.04, GLIDE1));
      pieces.forEach((pc, i) => {
        const a0 = sticky[i] ? 0 : clamp((S - starts[i]) / lens[i]);
        const b0 = clamp((T - starts[i]) / lens[i]);
        pc.show(a0, b0, sticky[i] ? fadeOut : 1);
      });

      // the letters ride the ring (upright across the top), then slide off
      const ringOff = Lr / 2 - g.textLen / 2;
      const baseOff = g.baseLen * 0.04;
      const off = lerp(baseOff, ringOff, ease(ringT)) + S * 0.5;
      this.textPathEl.setAttribute("startOffset", f1(off));
      this.gapEl.setAttribute("dx", f1(g.fs * 0.55 * ease(ringT)));
      // gone before they could tip past the side of the ring
      const tOp = 1 - norm(p, PEN0, PEN0 + 0.03);
      this.text.style.opacity = f3(0.85 * tOp); // .ribbon-text opacity
      this.text.style.display = tOp > 0 ? "" : "none";

      // the p at which the pen closes each outline (invert the sine ease)
      const closeAt = (pos: number) => {
        const v = clamp((pos - Lr) / (total - Lr));
        return PEN0 + (Math.acos(1 - 2 * v) / Math.PI) * (PEN1 - PEN0);
      };
      const cP = closeAt(starts[2] + lens[2]);
      const cB = closeAt(total);
      wipe = [norm(p, cP - 0.005, cP + WIPE), norm(p, cB - 0.005, cB + WIPE)];
      textAt = [cP + WIPE * 0.8, cB + WIPE * 0.8];
    }

    // ------------------------------------------------------------ the board
    const set = (el: HTMLElement, v: string, x: number) =>
      el.style.setProperty(v, f3(done || !g ? 1 : x));
    set(board, "--bd-frame", ease(norm(p, GLIDE0 + 0.04, GLIDE1)));
    set(board, "--bd-head", norm(p, GLIDE0, GLIDE1));
    set(board, "--bd-foot", norm(p, 0.955, 0.98));
    board.style.pointerEvents = done || !g || p >= GLIDE0 ? "" : "none";

    this.pairMedia.forEach((m, i) => {
      if (!g || done || k <= 0) {
        for (const s of ["height", "bottom", "transform"]) m.style.removeProperty(s);
      } else {
        const r = this.cardRect(i, k);
        m.style.bottom = "auto";
        m.style.height = `${f1(r.h)}px`;
        m.style.transform = `translate3d(0,${f1(r.y - g.slot[i].y)}px,0)`;
      }
      set(m, "--wipe", ease(wipe[i]));
    });
    this.pairText.forEach((t, i) => {
      const tin = g ? norm(p, textAt[i], textAt[i] + 0.03) : 1;
      set(t, "--bd-text", easeOut(tin));
      if (!g || done) {
        t.style.removeProperty("transform");
        return;
      }
      const r = this.cardRect(i, k);
      const dy = r.y + r.h - (g.slot[i].y + g.slot[i].h) + (1 - easeOut(tin)) * 12;
      t.style.transform = Math.abs(dy) > 0.05 ? `translate3d(0,${f1(dy)}px,0)` : "";
    });

    this.rowEls.forEach((r, i) => {
      const pc = this.rowPieces[i];
      if (done || !g) {
        for (const s of ["--pop", "--bd-img", "pointer-events"]) r.style.removeProperty(s);
        pc.show(0, 0);
        return;
      }
      const t0 = ROW0 + i * ROW_STEP;
      const t = norm(p, t0, t0 + ROW_DUR);
      const pop = easeOut(norm(t, 0, 0.45));
      const img = ease(norm(t, 0.55, 0.9));
      r.style.setProperty("--pop", f3(pop));
      r.style.setProperty("--bd-img", f3(img));
      r.style.pointerEvents = pop > 0.5 ? "" : "none";
      // a quick stroke around the strip, gone once the picture is in
      const draw = sine(norm(t, 0.1, 0.62));
      const op = 1 - norm(t, 0.8, 1);
      const row = g.rows[i];
      const sc = 0.96 + 0.04 * pop;
      const ty = (1 - pop) * 10;
      pc.transform =
        sc < 0.9999
          ? `translate(${f1(row.cx)} ${f1(row.cy + ty)}) scale(${sc.toFixed(4)}) translate(${f1(-row.cx)} ${f1(-row.cy)})`
          : "";
      pc.show(0, draw, op);
    });
  }

  destroy() {
    this.destroyed = true;
    const { slideOut, ribbon, ribbon2, portraitWrap } = this.els;
    for (const el of slideOut)
      for (const k of ["transform", "opacity", "transition", "visibility"]) el.style.removeProperty(k);
    ribbon?.style.removeProperty("opacity");
    this.ribbonText?.style.removeProperty("visibility");
    ribbon2?.style.removeProperty("opacity");
    for (const k of ["transform", "opacity", "filter", "mask-image", "transition", "transform-origin", "visibility"])
      portraitWrap.style.removeProperty(k);
    this.resetBoard();
    this.svg.remove();
  }
}
