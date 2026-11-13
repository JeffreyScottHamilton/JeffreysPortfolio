/** Shared incompressible velocity field in viewport CSS pixels. No animation loop:
 * the visible particle renderers advance it once per display frame. */
export class ParticleFluid {
  readonly nx = 64;
  ny = 48;
  w = 1;
  h = 1;
  last = 0;
  u = new Float32Array(0);
  v = new Float32Array(0);
  private tu = new Float32Array(0);
  private tv = new Float32Array(0);
  private pressure = new Float32Array(0);
  private temp = new Float32Array(0);
  private div = new Float32Array(0);
  pointer = { x: -9999, y: -9999, vx: 0, vy: 0, time: -9999, speed: 0 };
  private references = 0;
  private previous = 0;
  private move = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    const now = performance.now(),
      p = this.pointer,
      dt = Math.max(0.008, Math.min(0.06, (now - this.previous) / 1000));
    const fresh = now - p.time > 180;
    const dx = fresh ? 0 : e.clientX - p.x,
      dy = fresh ? 0 : e.clientY - p.y;
    const length = Math.hypot(dx, dy),
      cap = length / dt > 1500 ? (1500 * dt) / (length || 1) : 1;
    p.vx = (dx / dt) * cap;
    p.vy = (dy / dt) * cap;
    p.speed = Math.hypot(p.vx, p.vy);
    p.x = e.clientX;
    p.y = e.clientY;
    p.time = now;
    this.previous = now;
    const steps = Math.min(10, Math.max(1, Math.ceil(length / 16)));
    for (let k = 0; k < steps; k++)
      this.splat(
        p.x - dx * (1 - k / steps),
        p.y - dy * (1 - k / steps),
        p.vx,
        p.vy,
        1 / steps,
      );
  };
  private leave = () => {
    this.pointer.time = -9999;
  };
  private resize = () => {
    this.w = innerWidth;
    this.h = innerHeight;
    this.ny = Math.max(24, Math.round((this.nx * this.h) / this.w));
    const n = this.nx * this.ny;
    this.u = new Float32Array(n);
    this.v = new Float32Array(n);
    this.tu = new Float32Array(n);
    this.tv = new Float32Array(n);
    this.pressure = new Float32Array(n);
    this.temp = new Float32Array(n);
    this.div = new Float32Array(n);
    this.last = 0;
  };
  acquire() {
    if (this.references++ === 0) {
      this.resize();
      window.addEventListener("pointermove", this.move, { passive: true });
      document.documentElement.addEventListener("pointerleave", this.leave);
      window.addEventListener("blur", this.leave);
      window.addEventListener("resize", this.resize);
    }
    return () => {
      if (--this.references === 0) {
        window.removeEventListener("pointermove", this.move);
        document.documentElement.removeEventListener(
          "pointerleave",
          this.leave,
        );
        window.removeEventListener("blur", this.leave);
        window.removeEventListener("resize", this.resize);
      }
    };
  }
  private splat(
    px: number,
    py: number,
    vx: number,
    vy: number,
    weight: number,
  ) {
    const gx = (px / this.w) * this.nx,
      gy = (py / this.h) * this.ny,
      rx = (110 / this.w) * this.nx,
      ry = (110 / this.h) * this.ny;
    for (
      let y = Math.max(1, Math.floor(gy - ry * 2));
      y < Math.min(this.ny - 1, gy + ry * 2);
      y++
    )
      for (
        let x = Math.max(1, Math.floor(gx - rx * 2));
        x < Math.min(this.nx - 1, gx + rx * 2);
        x++
      ) {
        const dx = (x - gx) / (rx || 1),
          dy = (y - gy) / (ry || 1),
          q = Math.exp(-(dx * dx + dy * dy) * 1.6),
          i = y * this.nx + x;
        this.u[i] +=
          (vx * 0.75 - dy * Math.hypot(vx, vy) * 0.12 - this.u[i]) *
          q *
          weight *
          0.5;
        this.v[i] +=
          (vy * 0.75 + dx * Math.hypot(vx, vy) * 0.12 - this.v[i]) *
          q *
          weight *
          0.5;
      }
  }
  private read(a: Float32Array, x: number, y: number) {
    x = Math.max(0.5, Math.min(this.nx - 1.5, x));
    y = Math.max(0.5, Math.min(this.ny - 1.5, y));
    const x0 = x | 0,
      y0 = y | 0,
      fx = x - x0,
      fy = y - y0,
      i = y0 * this.nx + x0;
    return (
      (a[i] * (1 - fx) + a[i + 1] * fx) * (1 - fy) +
      (a[i + this.nx] * (1 - fx) + a[i + this.nx + 1] * fx) * fy
    );
  }
  step(time: number) {
    if (time - this.last < 10) return;
    const dt = this.last ? Math.min(0.12, (time - this.last) / 1000) : 1 / 60;
    this.last = time;
    const n = this.nx,
      m = this.ny,
      decay = Math.exp(-dt * 1.7);
    // Semi-Lagrangian advection transports the wake rather than painting cursor blobs.
    for (let y = 1; y < m - 1; y++)
      for (let x = 1; x < n - 1; x++) {
        const i = y * n + x,
          bx = x - (this.u[i] * dt * n) / this.w,
          by = y - (this.v[i] * dt * m) / this.h;
        this.tu[i] = this.read(this.u, bx, by) * decay;
        this.tv[i] = this.read(this.v, bx, by) * decay;
      }
    this.u.set(this.tu);
    this.v.set(this.tv);
    this.pressure.fill(0);
    for (let y = 1; y < m - 1; y++)
      for (let x = 1; x < n - 1; x++) {
        const i = y * n + x;
        this.div[i] =
          -0.5 *
          (this.u[i + 1] - this.u[i - 1] + this.v[i + n] - this.v[i - n]);
      }
    // Pressure projection removes divergence so the wake rolls around its surroundings.
    for (let k = 0; k < 12; k++) {
      for (let y = 1; y < m - 1; y++)
        for (let x = 1; x < n - 1; x++) {
          const i = y * n + x;
          this.temp[i] =
            (this.div[i] +
              this.pressure[i - 1] +
              this.pressure[i + 1] +
              this.pressure[i - n] +
              this.pressure[i + n]) *
            0.25;
        }
      const swap = this.pressure;
      this.pressure = this.temp;
      this.temp = swap;
    }
    for (let y = 1; y < m - 1; y++)
      for (let x = 1; x < n - 1; x++) {
        const i = y * n + x;
        this.u[i] -= 0.5 * (this.pressure[i + 1] - this.pressure[i - 1]);
        this.v[i] -= 0.5 * (this.pressure[i + n] - this.pressure[i - n]);
      }
  }
  sample(x: number, y: number) {
    if (x < 0 || y < 0 || x > this.w || y > this.h || !this.u.length)
      return [0, 0];
    return [
      this.read(this.u, (x / this.w) * this.nx, (y / this.h) * this.ny),
      this.read(this.v, (x / this.w) * this.nx, (y / this.h) * this.ny),
    ];
  }
}
export const particleFluid = new ParticleFluid();
/** Every point keeps independent momentum and a spring back to its own home. */
export class ParticleDynamics {
  readonly offsets: Float32Array;
  private velocity: Float32Array;
  energy = 0;
  constructor(
    readonly homes: Float32Array,
    readonly stride = 6,
  ) {
    this.offsets = new Float32Array((homes.length / stride) * 2);
    this.velocity = new Float32Array(this.offsets.length);
  }
  step(
    dt: number,
    time: number,
    left: number,
    top: number,
    scaleX = 1,
    scaleY = scaleX,
  ) {
    dt = Math.min(0.12, Math.max(0.001, dt));
    const steps = Math.ceil(dt / 0.02),
      step = dt / steps;
    particleFluid.step(time);
    const p = particleFluid.pointer,
      recent = time - p.time < 120 && p.speed > 12;
    let energy = 0;
    for (let j = 0, i = 0; j < this.offsets.length; j += 2, i += this.stride) {
      let ox = this.offsets[j],
        oy = this.offsets[j + 1];
      const x = left + (this.homes[i] + ox) * scaleX,
        y = top + (this.homes[i + 1] + oy) * scaleY;
      const flow = particleFluid.sample(x, y),
        dx = x - p.x,
        dy = y - p.y,
        d = Math.hypot(dx, dy) || 1,
        near = recent ? Math.max(0, 1 - d / 110) : 0,
        depth = 0.6 + ((i / this.stride) % 7) / 10;
      let vx = this.velocity[j],
        vy = this.velocity[j + 1];
      const pressure = near * near * 200,
        fx =
          ((flow[0] / scaleX) * 1.9 + ((dx / d) * pressure) / scaleX) * depth,
        fy =
          ((flow[1] / scaleY) * 1.9 + ((dy / d) * pressure) / scaleY) * depth;
      for (let k = 0; k < steps; k++) {
        vx += (fx - ox * 9 - vx * 5.8) * step;
        vy += (fy - oy * 9 - vy * 5.8) * step;
        const speed = Math.hypot(vx, vy),
          cap = speed > 650 ? 650 / speed : 1;
        vx *= cap;
        vy *= cap;
        ox += vx * step;
        oy += vy * step;
        const length = Math.hypot(ox, oy);
        if (length > 145) {
          ox *= 145 / length;
          oy *= 145 / length;
        }
      }
      this.offsets[j] = ox;
      this.offsets[j + 1] = oy;
      this.velocity[j] = vx;
      this.velocity[j + 1] = vy;
      energy += Math.abs(vx) + Math.abs(vy);
    }
    this.energy = energy / (this.offsets.length || 1);
  }
  reset() {
    this.offsets.fill(0);
    this.velocity.fill(0);
    this.energy = 0;
  }
}
