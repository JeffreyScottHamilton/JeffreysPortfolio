"use client";
import { useEffect, useRef } from "react";
/** CSS motion is enabled only while this decoration is visible and the tab is active. */
export function useVisibleMotion<T extends Element>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let visible = false;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      el.setAttribute(
        "data-moving",
        String(visible && !document.hidden && !motion.matches),
      );
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(el);
    document.addEventListener("visibilitychange", update);
    motion.addEventListener("change", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      motion.removeEventListener("change", update);
    };
  }, []);
  return ref;
}
