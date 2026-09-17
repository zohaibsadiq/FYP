"use client";

import { useEffect, useState } from "react";

import { NOTICE_AFTER_MS, wakeBackend } from "@/lib/wake";

export type WakeState = "checking" | "awake" | "unreachable";

/**
 * Knocks on the server once, when the app loads, and says whether it is taking
 * long enough to be worth mentioning.
 */
export function useBackendWake() {
  const [state, setState] = useState<WakeState>("checking");
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (alive) setSlow(true);
    }, NOTICE_AFTER_MS);

    wakeBackend(controller.signal).then((ok) => {
      if (!alive) return;
      clearTimeout(timer);
      setState(ok ? "awake" : "unreachable");
    });

    return () => {
      alive = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  // Only worth saying while it is still unknown. Once the answer is in, either
  // everything works or the page's own error has something better to say.
  return { state, showNotice: slow && state === "checking" };
}
