/**
 * One swirl for the whole page: the cursor's liquid feel from the portrait
 * (lib/portrait-engine.ts) shared by every other dot layer, so the dots
 * react the same way at rest and mid-transition (hero morph, board text,
 * text ⇄ dots morphs).
 *
 * A coarse stable-fluids solver (lib/fluid.ts, the portrait's) covers the
 * viewport. Mouse strokes inject velocity the same way the portrait's do;
 * a dot at (x, y) is displaced by the local velocity (soft-capped), so it
 * swirls along with the flow and settles back as the flow dies down. Pure
 * per frame: no dot keeps state, scrubbed pieces stay pure functions of p.
 *
 *   const off = swirl.on(() => redraw());   // subscribe (starts listening)
 *   swirl.at(x, y, out)                      // displacement, viewport px
 *   off();
 *
 * Touch and reduced motion: never stirs (at() is always 0).
 */
import { Fluid } from "@/lib/fluid";

/** velocity (px/s) → displacement: seconds of travel, and the soft cap (px) */
export const SWIRL_T = 0.05;
export const SWIRL_CAP = 10;
const LONG = 112; // solver cells on the viewport's long side
const MAX_FORCE = 240; // cells/s (as the portrait)

type Fn = () => void;

class Swirl {
  private f: Fluid | null = null;
  private subs = new Set<Fn>();
  private raf = 0;
  private last = 0;
  private px = 0;
  private py = 0;
  private t = -1e9;
  private R = 36;
  private off = true;
  /** the field moved this frame (subscribers redraw while true) */
  live = false;

  on(fn: Fn) {
    this.subs.add(fn);
    if (this.subs.size === 1) this.start();
    return () => {
      this.subs.delete(fn);
      if (!this.subs.size) this.stop();
    };
  }

  private start() {
    if (typeof window === "undefined") return;
    this.off =
      matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(any-pointer: fine)").matches;
    if (this.off) return;
    this.resize();
    addEventListener("pointermove", this.move, { passive: true });
    addEventListener("resize", this.resize);
  }

  private stop() {
    removeEventListener("pointermove", this.move);
    removeEventListener("resize", this.resize);
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.f = null;
    this.live = false;
  }

  private resize = () => {
    const W = innerWidth;
    const H = innerHeight;
    if (this.f && Math.abs(this.f.nx * this.f.h - W) < this.f.h && Math.abs(this.f.ny * this.f.h - H) < this.f.h) return;
    this.f = new Fluid(W, H, LONG);
    // splat radius like the portrait's (~5% of a portrait's width)
    this.R = Math.max(18, Math.min(48, W * 0.028));
  };

  private move = (e: PointerEvent) => {
    if (e.pointerType === "touch" || this.off) return;
    const f = this.f;
    if (!f) return;
    const now = performance.now();
    const x = e.clientX;
    const y = e.clientY;
    if (now - this.t > 250) {
      // (re)entering: start a stroke here, nothing to smear yet
      this.px = x;
      this.py = y;
      this.t = now;
      return;
    }
    const dt = Math.max(8, now - this.t);
    const dx = x - this.px;
    const dy = y - this.py;
    if (dx * dx + dy * dy < 0.25) return;
    const vx = dx / dt;
    const vy = dy / dt;
    const k = 1000 / f.h; // px/ms -> cells/s
    let fx = vx * k * 0.9;
    let fy = vy * k * 0.9;
    const m = Math.hypot(fx, fy);
    if (m > MAX_FORCE) {
      fx *= MAX_FORCE / m;
      fy *= MAX_FORCE / m;
    }
    const r = this.R * (1 + Math.min(0.35, Math.hypot(vx, vy) * 0.12));
    // (dye is never shown here; it keeps the flow alive as long as the portrait's)
    f.splatSegment(this.px, this.py, x, y, r * 1.25, fx, fy, 0.6, r);
    this.px = x;
    this.py = y;
    this.t = now;
    this.kick();
  };

  private kick() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.raf = 0;
    const f = this.f;
    if (!f) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    f.step(dt);
    // below ~0.05 px of displacement everything counts as at rest
    this.live = f.maxSpeed * f.h * SWIRL_T > 0.05;
    if (!this.live) f.reset();
    for (const s of this.subs) s();
    if (this.live) this.raf = requestAnimationFrame(this.tick);
  };

  /** Displacement (viewport px) of a dot at viewport (x, y); returns its length. */
  at(x: number, y: number, out: [number, number]) {
    const f = this.f;
    if (!f || !this.live) {
      out[0] = out[1] = 0;
      return 0;
    }
    const k = f.h * SWIRL_T;
    const dx = f.sample(f.u, x, y) * k;
    const dy = f.sample(f.v, x, y) * k;
    const l = Math.hypot(dx, dy);
    if (l < 1e-4) {
      out[0] = out[1] = 0;
      return 0;
    }
    const s = (SWIRL_CAP * Math.tanh(l / SWIRL_CAP)) / l;
    out[0] = dx * s;
    out[1] = dy * s;
    return l * s;
  }

  /**
   * The displacement field as an RGBA8 grid for a GPU sampler: R, G =
   * 128 + 127 · d / SWIRL_CAP per cell (x, y). `cell` is px per cell.
   */
  grid(): { nx: number; ny: number; cell: number; data: Uint8Array } | null {
    const f = this.f;
    if (!f) return null;
    const n = f.nx * f.ny;
    if (!this.gridData || this.gridData.length !== n * 4) this.gridData = new Uint8Array(n * 4);
    const D = this.gridData;
    const k = f.h * SWIRL_T;
    for (let i = 0; i < n; i++) {
      let dx = this.live ? f.u[i] * k : 0;
      let dy = this.live ? f.v[i] * k : 0;
      const l = Math.hypot(dx, dy);
      if (l > 1e-4) {
        const s = (SWIRL_CAP * Math.tanh(l / SWIRL_CAP)) / l;
        dx *= s;
        dy *= s;
      }
      D[i * 4] = Math.round(128 + (127 * dx) / SWIRL_CAP);
      D[i * 4 + 1] = Math.round(128 + (127 * dy) / SWIRL_CAP);
      D[i * 4 + 2] = 0;
      D[i * 4 + 3] = 255;
    }
    return { nx: f.nx, ny: f.ny, cell: f.h, data: D };
  }
  private gridData: Uint8Array | null = null;
}

export const swirl = new Swirl();
