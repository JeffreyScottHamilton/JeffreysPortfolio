/**
 * Face → year hand-off source for the Explore journey.
 *
 * Rebuilds the arrival portrait's halftone exactly as the Portrait component
 * does (same lib/halftone field for the portrait's on-page box), picks the
 * dots that will travel, renders everything else to a still bitmap, and
 * samples the arrival copy (title, who, lead, "Start the story") into small
 * letter-shaped dots. All positions are local to the arrival section, which
 * moves rigidly with the page, so one getBoundingClientRect per frame places
 * the whole source.
 */
import { GLYPHS } from "@/components/shared/context";
import { buildHalftone, computeLayout, drawField, loadCutout, palette } from "@/lib/halftone";

export type HandoffSource = {
  /** the arrival section; all coordinates below are local to it */
  ref: HTMLElement;
  /** travelling face dots */
  x: Float32Array;
  y: Float32Array;
  r: Float32Array;
  a: Float32Array;
  /** box of the portrait inside the arrival (for ordering) */
  box: { x: number; y: number; w: number; h: number };
  /** the rest of the face (dots not travelling + glyphs + letters), at dpr */
  rest: HTMLCanvasElement;
  dpr: number;
  /** letter dots from the arrival copy */
  cx: Float32Array;
  cy: Float32Array;
  cr: Float32Array;
  /** 1 = red accent (the title's full stop) */
  ck: Uint8Array;
  ink: string;
  /** elements hidden while the canvas carries the arrival */
  portrait: HTMLElement;
  copy: HTMLElement[];
};

const MAX_COPY = 2200;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function buildHandoffSource(
  arrival: HTMLElement,
  count: number,
): Promise<HandoffSource | null> {
  const portrait = arrival.querySelector<HTMLElement>(".x-arrival-portrait");
  const root = portrait?.querySelector<HTMLElement>(".portrait") ?? portrait;
  if (!portrait || !root) return null;
  const W = Math.round(root.clientWidth);
  const H = Math.round(root.clientHeight);
  if (W < 16 || H < 16) return null;
  const img = await loadCutout();
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts) await Promise.race([fonts.ready, new Promise((r) => setTimeout(r, 1200))]);
  if (!arrival.isConnected) return null;

  const ar = arrival.getBoundingClientRect();
  const pr = root.getBoundingClientRect();
  const ox = pr.left - ar.left;
  const oy = pr.top - ar.top;
  const L = computeLayout(W, H, "bust");
  const F = buildHalftone(img, L, { tone: "light", framing: "bust", glyphs: GLYPHS });
  const pal = palette("light");
  const family = getComputedStyle(root).fontFamily || "sans-serif";

  // travelling dots: weighted (bigger = likelier) sample of the round dots
  const r0 = rng(4201);
  const cand: { p: number; k: number }[] = [];
  for (let q = 0; q < F.live.length; q++) {
    const p = F.live[q];
    if (F.g[p] >= 0 || F.r[p] < 0.4) continue;
    cand.push({ p, k: Math.pow(r0(), 1 / (F.r[p] * F.a[p] + 0.05)) });
  }
  cand.sort((u, v) => v.k - u.k);
  const pick = cand.slice(0, Math.min(count, cand.length));
  const moving = new Uint8Array(F.x.length);
  const n = pick.length;
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const r = new Float32Array(n);
  const a = new Float32Array(n);
  pick.forEach(({ p }, i) => {
    moving[p] = 1;
    x[i] = ox + F.x[p];
    y[i] = oy + F.y[p];
    r[i] = F.r[p];
    a[i] = F.a[p];
  });

  // everything else stays as one still layer that fades as the dots leave
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rest = document.createElement("canvas");
  rest.width = Math.round(W * dpr);
  rest.height = Math.round(H * dpr);
  const rc = rest.getContext("2d");
  if (!rc) return null;
  rc.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawField(rc, { ...F, live: F.live.filter((p) => !moving[p]) }, pal.ink, family, true, true);

  // ---- the copy, as letter-shaped dots
  const copy = [
    arrival.querySelector<HTMLElement>(".x-arrival-copy"),
    arrival.querySelector<HTMLElement>(".x-start"),
  ].filter((e): e is HTMLElement => !!e);
  const texts = [
    ...arrival.querySelectorAll<HTMLElement>(
      ".x-arrival-title-vis, .x-arrival-who, .x-arrival-lead, .x-start",
    ),
  ];
  const CW = Math.max(1, Math.round(ar.width));
  const CH = Math.max(1, Math.round(ar.height));
  const tc = document.createElement("canvas");
  tc.width = CW;
  tc.height = CH;
  const g = tc.getContext("2d", { willReadFrequently: true });
  const cx: number[] = [];
  const cy: number[] = [];
  const cr: number[] = [];
  const ck: number[] = [];
  if (g) {
    const chars: { x0: number; y0: number; x1: number; y1: number; step: number; red: boolean }[] = [];
    const range = document.createRange();
    for (const el of texts) {
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walk.nextNode(); node; node = walk.nextNode()) {
        const parent = node.parentElement;
        if (!parent || parent.closest(".sr-only")) continue;
        const cs = getComputedStyle(parent);
        const size = parseFloat(cs.fontSize) || 16;
        g.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
        g.textBaseline = "alphabetic";
        g.fillStyle = "#000";
        const m = g.measureText("Hg");
        const asc = m.fontBoundingBoxAscent || size * 0.8;
        const desc = m.fontBoundingBoxDescent || size * 0.2;
        const text = node.textContent ?? "";
        const red = !!parent.closest(".dot-accent");
        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          if (!ch.trim()) continue;
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const b = range.getBoundingClientRect();
          if (b.width < 1 || b.height < 1) continue;
          const lx = b.left - ar.left;
          const ty = b.top - ar.top;
          const base = ty + (b.height + asc - desc) / 2;
          g.fillText(ch, lx, base);
          chars.push({
            x0: lx - 2,
            y0: ty,
            x1: lx + b.width + 2,
            y1: ty + b.height,
            step: Math.max(2.4, size / (size > 40 ? 15 : 6.5)),
            red,
          });
        }
      }
    }
    range.detach();
    let d: Uint8ClampedArray | null = null;
    try {
      d = g.getImageData(0, 0, CW, CH).data;
    } catch {
      d = null;
    }
    if (d) {
      for (const c of chars) {
        for (let yy = c.y0 + c.step / 2; yy < c.y1; yy += c.step) {
          for (let xx = c.x0 + c.step / 2; xx < c.x1; xx += c.step) {
            const xi = xx | 0;
            const yi = yy | 0;
            if (xi < 0 || yi < 0 || xi >= CW || yi >= CH) continue;
            if (d[(yi * CW + xi) * 4 + 3] < 110) continue;
            cx.push(xx);
            cy.push(yy);
            cr.push(c.step * 0.42);
            ck.push(c.red ? 1 : 0);
          }
        }
      }
    }
  }
  // keep at most MAX_COPY, evenly
  let keep = [...cx.keys()];
  if (keep.length > MAX_COPY) {
    const r1 = rng(99);
    keep = keep
      .map((i) => ({ i, k: r1() }))
      .sort((u, v) => u.k - v.k)
      .slice(0, MAX_COPY)
      .map((o) => o.i);
  }

  return {
    ref: arrival,
    x,
    y,
    r,
    a,
    box: { x: ox, y: oy, w: W, h: H },
    rest,
    dpr,
    cx: Float32Array.from(keep, (i) => cx[i]),
    cy: Float32Array.from(keep, (i) => cy[i]),
    cr: Float32Array.from(keep, (i) => cr[i]),
    ck: Uint8Array.from(keep, (i) => ck[i]),
    ink: pal.ink,
    portrait,
    copy,
  };
}
