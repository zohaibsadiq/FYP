"use client";

import { cn } from "@/lib/utils";

// Fixed set, picked so each reads clearly against white text in both themes.
const COLOURS = [
  "bg-rose-500", "bg-orange-500", "bg-amber-600", "bg-emerald-600",
  "bg-teal-600", "bg-sky-600", "bg-indigo-500", "bg-violet-500",
];

function lettersOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * A circle with somebody's initials in it.
 *
 * The colour comes from the account id, not the name, so two friends who are
 * both called Ali Khan get different colours. Without that they would look
 * identical in a list even after being given different names.
 */
export function Initials({
  name,
  id,
  className,
}: {
  name: string;
  id: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
        COLOURS[id % COLOURS.length],
        className,
      )}
    >
      {lettersOf(name)}
    </span>
  );
}
