export type SceneRole = "hero" | "contact" | "return" | "static" | "journey";
export type MotionKey =
  | "portrait"
  | "title"
  | "heroScatter"
  | "contactFormation"
  | "returnFormation"
  | "modeProgress";
/** GSAP owns scene timing. Renderers read this stable object without React renders. */
export function createSceneMotion() {
  const listeners = new Set<() => void>();
  return {
    support: 1,
    portrait: 1,
    title: 1,
    heroScatter: 0,
    workLine: 0,
    contactFormation: 1,
    returnFormation: 0,
    modeProgress: 1,
    notify() {
      listeners.forEach((fn) => fn());
    },
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
export type SceneMotion = ReturnType<typeof createSceneMotion>;
export function formationFor(motion: SceneMotion | undefined, role: SceneRole) {
  return !motion
    ? 1
    : role === "hero"
      ? motion.portrait
      : role === "contact"
        ? motion.contactFormation
        : role === "return"
          ? motion.returnFormation
          : 1;
}
