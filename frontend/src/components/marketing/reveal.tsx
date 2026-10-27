"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Eases its contents up into view the first time they scroll onto the screen.
 * The styles live in globals.css under .reveal; this only flips the switch.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Milliseconds to wait, so a row of cards arrives one after another. */
  delay?: number;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = box.current;
    if (!element) return;

    // Old browsers and test runners cannot watch the scroll position. Showing
    // everything at once is the right answer there, not hiding it for ever.
    if (typeof IntersectionObserver === "undefined") {
      element.setAttribute("data-shown", "");
      return;
    }

    const watcher = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          element.setAttribute("data-shown", "");
          watcher.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    watcher.observe(element);
    return () => watcher.disconnect();
  }, []);

  return (
    <div ref={box} className={cn("reveal", className)} style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}>
      {children}
    </div>
  );
}
