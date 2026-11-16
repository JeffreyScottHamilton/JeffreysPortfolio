/**
 * The opening's deceleration, shared by every scroll-scrubbed piece: instead
 * of tracking the scrollbar 1:1, a value glides toward the scrolled target
 * and slows to a stop (exponential approach, time constant TAU). Big jumps
 * (the loop's jump to the top, a keyboard / anchor jump, a refresh) snap, so
 * nothing ever replays backwards.
 *
 *   const v = inertia((p) => thing.update(p));
 *   ScrollTrigger.create({ onUpdate: (s) => v.follow(s.progress),
 *                          onRefresh: (s) => v.jump(s.progress) });
 */

/** seconds */
export const TAU = 0.35;

export type Inertia = {
  /** glide toward p (snaps when the jump is larger than `snap`) */
  follow(p: number): void;
  /** go to p now */
  jump(p: number): void;
  /** the value as drawn */
  readonly value: number;
  stop(): void;
};

export function inertia(
  apply: (v: number) => void,
  o: { tau?: number; snap?: number; eps?: number; start?: number } = {},
): Inertia {
  const tau = o.tau ?? TAU;
  const snap = o.snap ?? 0.6;
  const eps = o.eps ?? 2e-4;
  let cur = o.start ?? 0;
  let target = cur;
  let raf = 0;
  let prevT = 0;
  const step = (t: number) => {
    const dt = Math.min(0.05, Math.max(0, (t - prevT) / 1000));
    prevT = t;
    cur += (target - cur) * (1 - Math.exp(-dt / tau));
    if (Math.abs(target - cur) < eps) cur = target;
    apply(cur);
    raf = cur === target ? 0 : requestAnimationFrame(step);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const jump = (p: number) => {
    stop();
    cur = target = p;
    apply(p);
  };
  const follow = (p: number) => {
    target = p;
    if (Math.abs(target - cur) > snap) return jump(p);
    if (!raf && target !== cur) {
      prevT = performance.now();
      raf = requestAnimationFrame(step);
    }
  };
  return {
    follow,
    jump,
    stop,
    get value() {
      return cur;
    },
  };
}
