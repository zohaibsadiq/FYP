"use client";

import { Loader2 } from "lucide-react";

import { useBackendWake } from "@/hooks/use-backend-wake";

/**
 * A line that appears only when the server is genuinely taking its time.
 *
 * It says what is happening and roughly how long, because "waiting for a
 * minute because the server was asleep" and "broken" look identical otherwise,
 * and only one of them is worth giving up over.
 */
export function WakingNotice() {
  const { showNotice } = useBackendWake();

  if (!showNotice) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      <span>Starting the server up. This can take up to a minute the first time.</span>
    </div>
  );
}
