/**
 * Small CPU stable-fluids solver (Stam 1999) on a coarse collocated grid.
 *
 * Velocity is stored in cells/second, the dye is a scalar "reveal amount".
 * Each step: vorticity confinement -> divergence -> Jacobi pressure solve
 * (warm-started) -> projection -> semi-Lagrangian advection of velocity and
 * dye -> dissipation. Grid is ~128 cells on the long side, which keeps a step
 * around a millisecond on a desktop CPU.
 *
 * The solver tracks its own energy (max speed / max dye) and the bounding box
 * of the cells that still carry dye, so callers can stop animating (and restrict
 * per-frame work) once everything has decayed.
 */

export type FluidOptions = {
  /** Jacobi pressure iterations per step */
  iterations?: number;
  /** vorticity confinement strength (cells / s^2 scale) */
  curl?: number;
  /** velocity exponential decay time constant (s) */
  velocityTau?: number;
  /** dye exponential decay time constant (s) */
  dyeTau?: number;
  /** dye linear fade (units / s) on top of the exponential decay */
  dyeFade?: number;
  /** dye cap */
  dyeMax?: number;
};

export class Fluid {
  readonly nx: number;
  readonly ny: number;
  /** CSS px per cell */
  readonly h: number;
  u: Float32Array;
  v: Float32Array;
  dye: Float32Array;
  private u0: Float32Array;
  private v0: Float32Array;
  private d0: Float32Array;
  private p: Float32Array;
  private div: Float32Array;
  private w: Float32Array;
  private o: Required<FluidOptions>;

  /** max |velocity| (cells/s) after the last step */
  maxSpeed = 0;
  /** max dye after the last step */
  maxDye = 0;
  /** bbox (cells, inclusive-exclusive) of dye > DYE_EPS; empty when x1 <= x0 */
  dyeBox: [number, number, number, number] = [0, 0, 0, 0];

  static DYE_EPS = 0.004;

  constructor(widthPx: number, heightPx: number, longSide = 128, opts: FluidOptions = {}) {
    const long = Math.max(widthPx, heightPx);
    this.h = long / longSide;
    this.nx = Math.max(8, Math.ceil(widthPx / this.h));
    this.ny = Math.max(8, Math.ceil(heightPx / this.h));
    const n = this.nx * this.ny;
    this.u = new Float32Array(n);
    this.v = new Float32Array(n);
    this.dye = new Float32Array(n);
    this.u0 = new Float32Array(n);
    this.v0 = new Float32Array(n);
    this.d0 = new Float32Array(n);
    this.p = new Float32Array(n);
    this.div = new Float32Array(n);
    this.w = new Float32Array(n);
    this.o = {
      iterations: opts.iterations ?? 20,
      curl: opts.curl ?? 28,
      velocityTau: opts.velocityTau ?? 0.75,
      dyeTau: opts.dyeTau ?? 3.2,
      dyeFade: opts.dyeFade ?? 0.26,
      dyeMax: opts.dyeMax ?? 1.15,
    };
  }

  get active() {
    return this.maxSpeed > 0 || this.maxDye > 0;
  }

  reset() {
    this.u.fill(0);
    this.v.fill(0);
    this.dye.fill(0);
    this.p.fill(0);
    this.maxSpeed = this.maxDye = 0;
    this.dyeBox = [0, 0, 0, 0];
  }

  /**
   * Splat along a segment (CSS px). Velocity is pushed toward (fx, fy) (cells/s)
   * with a Gaussian falloff of radius `r` (CSS px) around the segment; dye is
   * added with the same falloff (radius `rd`, defaults to r).
   */
  splatSegment(ax: number, ay: number, bx: number, by: number, r: number, fx: number, fy: number, dye: number, rd = r) {
    const h = this.h;
    const nx = this.nx;
    const ny = this.ny;
    const R = Math.max(r, rd) * 2.6;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - R) / h));
    const i1 = Math.min(nx, Math.ceil((Math.max(ax, bx) + R) / h));
    const j0 = Math.max(0, Math.floor((Math.min(ay, by) - R) / h));
    const j1 = Math.min(ny, Math.ceil((Math.max(ay, by) + R) / h));
    const sx = bx - ax;
    const sy = by - ay;
    const sl = sx * sx + sy * sy;
    const ir2 = 1 / (r * r);
    const ird2 = 1 / (rd * rd);
    const cap = this.o.dyeMax;
    for (let j = j0; j < j1; j++) {
      const py = (j + 0.5) * h;
      for (let i = i0; i < i1; i++) {
        const px = (i + 0.5) * h;
        let t = sl > 0 ? ((px - ax) * sx + (py - ay) * sy) / sl : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = px - (ax + sx * t);
        const dy = py - (ay + sy * t);
        const d2 = dx * dx + dy * dy;
        const q = j * nx + i;
        const gv = Math.exp(-d2 * ir2);
        if (gv > 0.002) {
          // blend toward the stroke velocity (no runaway accumulation)
          this.u[q] += (fx - this.u[q]) * gv * 0.85;
          this.v[q] += (fy - this.v[q]) * gv * 0.85;
        }
        if (dye > 0) {
          const gd = Math.exp(-d2 * ird2);
          if (gd > 0.002) {
            const nd = this.dye[q] + dye * gd;
            this.dye[q] = nd > cap ? cap : nd;
          }
        }
      }
    }
    this.maxSpeed = Math.max(this.maxSpeed, Math.hypot(fx, fy));
    this.maxDye = Math.max(this.maxDye, dye > 0 ? Math.min(cap, dye) : 0);
    if (dye > 0) this.growBox(i0, j0, i1, j1);
  }

  /** Radial splat (tap): outward velocity `strength` (cells/s) and dye. */
  splatRadial(cx: number, cy: number, r: number, strength: number, dye: number) {
    const h = this.h;
    const nx = this.nx;
    const R = r * 2.8;
    const i0 = Math.max(0, Math.floor((cx - R) / h));
    const i1 = Math.min(nx, Math.ceil((cx + R) / h));
    const j0 = Math.max(0, Math.floor((cy - R) / h));
    const j1 = Math.min(this.ny, Math.ceil((cy + R) / h));
    const ir2 = 1 / (r * r);
    const cap = this.o.dyeMax;
    for (let j = j0; j < j1; j++) {
      const dy = (j + 0.5) * h - cy;
      for (let i = i0; i < i1; i++) {
        const dx = (i + 0.5) * h - cx;
        const d2 = dx * dx + dy * dy;
        const g = Math.exp(-d2 * ir2);
        if (g < 0.002) continue;
        const q = j * nx + i;
        const d = Math.sqrt(d2) || 1;
        // ring of outward push peaking around r/1.4
        const k = strength * g * Math.min(1, d / (r * 0.7));
        this.u[q] += (dx / d) * k;
        this.v[q] += (dy / d) * k;
        const nd = this.dye[q] + dye * g;
        this.dye[q] = nd > cap ? cap : nd;
      }
    }
    this.maxSpeed = Math.max(this.maxSpeed, strength);
    this.maxDye = Math.max(this.maxDye, Math.min(cap, dye));
    this.growBox(i0, j0, i1, j1);
  }

  private growBox(i0: number, j0: number, i1: number, j1: number) {
    const b = this.dyeBox;
    if (b[2] <= b[0] || b[3] <= b[1]) this.dyeBox = [i0, j0, i1, j1];
    else this.dyeBox = [Math.min(b[0], i0), Math.min(b[1], j0), Math.max(b[2], i1), Math.max(b[3], j1)];
  }

  /** Bilinear sample of a cell-centred field at CSS px (x, y). */
  sample(f: Float32Array, x: number, y: number) {
    const nx = this.nx;
    const ny = this.ny;
    let gx = x / this.h - 0.5;
    let gy = y / this.h - 0.5;
    gx = gx < 0 ? 0 : gx > nx - 1 ? nx - 1 : gx;
    gy = gy < 0 ? 0 : gy > ny - 1 ? ny - 1 : gy;
    const i = gx | 0;
    const j = gy | 0;
    const i1 = i + 1 < nx ? i + 1 : i;
    const j1 = j + 1 < ny ? j + 1 : j;
    const tx = gx - i;
    const ty = gy - j;
    const a = f[j * nx + i] + (f[j * nx + i1] - f[j * nx + i]) * tx;
    const b = f[j1 * nx + i] + (f[j1 * nx + i1] - f[j1 * nx + i]) * tx;
    return a + (b - a) * ty;
  }

  /** Advance by dt seconds. */
  step(dt: number) {
    if (!this.active) return;
    const nx = this.nx;
    const ny = this.ny;
    const u = this.u;
    const v = this.v;
    const o = this.o;
    const moving = this.maxSpeed > 0;

    if (moving) {
      /* vorticity confinement: curly swirls that survive the coarse grid */
      const w = this.w;
      for (let j = 1; j < ny - 1; j++)
        for (let i = 1; i < nx - 1; i++) {
          const q = j * nx + i;
          w[q] = 0.5 * (v[q + 1] - v[q - 1] - (u[q + nx] - u[q - nx]));
        }
      // swirl only while there is dye to stir: the flow then just decays
      const eps = o.curl * Math.min(1, this.maxDye / 0.25);
      for (let j = 2; j < ny - 2; j++)
        for (let i = 2; i < nx - 2; i++) {
          const q = j * nx + i;
          const gx = 0.5 * (Math.abs(w[q + 1]) - Math.abs(w[q - 1]));
          const gy = 0.5 * (Math.abs(w[q + nx]) - Math.abs(w[q - nx]));
          const l = Math.sqrt(gx * gx + gy * gy) + 1e-5;
          u[q] += eps * (gy / l) * w[q] * dt;
          v[q] += -eps * (gx / l) * w[q] * dt;
        }

      this.project();

      /* advect velocity */
      this.u0.set(u);
      this.v0.set(v);
      this.advect(u, this.u0, dt);
      this.advect(v, this.v0, dt);
      this.walls();
    }

    /* advect dye (only inside its bbox, padded by the max travel) */
    if (this.maxDye > 0) {
      this.d0.set(this.dye);
      const pad = Math.ceil(this.maxSpeed * dt) + 2;
      const b = this.dyeBox;
      this.advect(this.dye, this.d0, dt, Math.max(0, b[0] - pad), Math.max(0, b[1] - pad), Math.min(nx, b[2] + pad), Math.min(ny, b[3] + pad));
    }

    /* dissipation + energy / bbox bookkeeping */
    const kv = Math.exp(-dt / o.velocityTau);
    const kd = Math.exp(-dt / o.dyeTau);
    const fade = o.dyeFade * dt;
    let ms2 = 0;
    if (moving) {
      for (let q = 0; q < u.length; q++) {
        u[q] *= kv;
        v[q] *= kv;
        const s = u[q] * u[q] + v[q] * v[q];
        if (s > ms2) ms2 = s;
      }
    }
    let md = 0;
    let bx0 = nx;
    let by0 = ny;
    let bx1 = 0;
    let by1 = 0;
    if (this.maxDye > 0) {
      const d = this.dye;
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const q = j * nx + i;
          let x = d[q];
          if (x <= 0) continue;
          x = x * kd - fade;
          if (x < Fluid.DYE_EPS) {
            d[q] = 0;
            continue;
          }
          d[q] = x;
          if (x > md) md = x;
          if (i < bx0) bx0 = i;
          if (i >= bx1) bx1 = i + 1;
          if (j < by0) by0 = j;
          if (j >= by1) by1 = j + 1;
        }
    }
    this.maxDye = md;
    this.dyeBox = md > 0 ? [bx0, by0, bx1, by1] : [0, 0, 0, 0];
    // below ~0.6 cells/s nothing visible moves, and without dye the flow has
    // nothing left to show: settle to exactly zero
    this.maxSpeed = Math.sqrt(ms2);
    if (this.maxSpeed < 0.6 || md === 0) {
      if (moving) {
        u.fill(0);
        v.fill(0);
        this.p.fill(0);
      }
      this.maxSpeed = 0;
    }
  }

  private walls() {
    const nx = this.nx;
    const ny = this.ny;
    for (let i = 0; i < nx; i++) {
      this.v[i] = 0;
      this.v[(ny - 1) * nx + i] = 0;
    }
    for (let j = 0; j < ny; j++) {
      this.u[j * nx] = 0;
      this.u[j * nx + nx - 1] = 0;
    }
  }

  private project() {
    const nx = this.nx;
    const ny = this.ny;
    const u = this.u;
    const v = this.v;
    const p = this.p;
    const div = this.div;
    this.walls();
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const q = j * nx + i;
        const ur = i < nx - 1 ? u[q + 1] : -u[q];
        const ul = i > 0 ? u[q - 1] : -u[q];
        const vb = j < ny - 1 ? v[q + nx] : -v[q];
        const vt = j > 0 ? v[q - nx] : -v[q];
        div[q] = 0.5 * (ur - ul + vb - vt);
      }
    // Jacobi, pressure warm-started from the previous step (Neumann walls)
    for (let it = 0; it < this.o.iterations; it++) {
      for (let j = 0; j < ny; j++) {
        const row = j * nx;
        for (let i = 0; i < nx; i++) {
          const q = row + i;
          const pc = p[q];
          const pl = i > 0 ? p[q - 1] : pc;
          const pr = i < nx - 1 ? p[q + 1] : pc;
          const pt = j > 0 ? p[q - nx] : pc;
          const pb = j < ny - 1 ? p[q + nx] : pc;
          p[q] = (pl + pr + pt + pb - div[q]) * 0.25;
        }
      }
    }
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const q = j * nx + i;
        const pc = p[q];
        const pl = i > 0 ? p[q - 1] : pc;
        const pr = i < nx - 1 ? p[q + 1] : pc;
        const pt = j > 0 ? p[q - nx] : pc;
        const pb = j < ny - 1 ? p[q + nx] : pc;
        u[q] -= 0.5 * (pr - pl);
        v[q] -= 0.5 * (pb - pt);
      }
  }

  /** Semi-Lagrangian advection of `src` into `dst` by the current velocity. */
  private advect(dst: Float32Array, src: Float32Array, dt: number, i0 = 0, j0 = 0, i1 = this.nx, j1 = this.ny) {
    const nx = this.nx;
    const ny = this.ny;
    const u = this.u;
    const v = this.v;
    const mx = nx - 1;
    const my = ny - 1;
    for (let j = j0; j < j1; j++)
      for (let i = i0; i < i1; i++) {
        const q = j * nx + i;
        let x = i - u[q] * dt;
        let y = j - v[q] * dt;
        x = x < 0 ? 0 : x > mx ? mx : x;
        y = y < 0 ? 0 : y > my ? my : y;
        const a = x | 0;
        const b = y | 0;
        const a1 = a < mx ? a + 1 : a;
        const b1 = b < my ? b + 1 : b;
        const tx = x - a;
        const ty = y - b;
        const r0 = b * nx;
        const r1 = b1 * nx;
        const top = src[r0 + a] + (src[r0 + a1] - src[r0 + a]) * tx;
        const bot = src[r1 + a] + (src[r1 + a1] - src[r1 + a]) * tx;
        dst[q] = top + (bot - top) * ty;
      }
  }
}
