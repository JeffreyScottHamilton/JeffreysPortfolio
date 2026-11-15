/**
 * Face → year hand-off source for the Explore journey.
 *
 * Rebuilds the arrival portrait's halftone exactly as the Portrait component
 * does (same lib/halftone field for the portrait's on-page box), picks the
 * dots that will travel and renders everything else to a still bitmap. The
 * arrival copy is turned into dots by chapterDots.ts (its dots become the
 * first chapter's text). All positions are local to the arrival section, which
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
  ink: string;
  /** elements hidden while the canvas carries the arrival */
  portrait: HTMLElement;
  copy: HTMLElement[];
};

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

  const copy = [
    arrival.querySelector<HTMLElement>(".x-arrival-copy"),
    arrival.querySelector<HTMLElement>(".x-start"),
  ].filter((e): e is HTMLElement => !!e);

  return {
    ref: arrival,
    x,
    y,
    r,
    a,
    box: { x: ox, y: oy, w: W, h: H },
    rest,
    dpr,
    ink: pal.ink,
    portrait,
    copy,
  };
}
