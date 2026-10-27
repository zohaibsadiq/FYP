"use client";

import { useEffect, useState } from "react";

function wantsLessMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A number that counts up from zero to its value when it first appears, in
 * well under a second. People who ask their device for less motion get the
 * final number straight away.
 */
export function useCountUp(target: number | undefined, duration = 700): number {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (target === undefined) return;
    const total = wantsLessMotion() ? 0 : duration;
    const started = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = total === 0 ? 1 : Math.min(1, (now - started) / total);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return shown;
}
