"use client";

import { cn } from "@/lib/utils";
import { AUDIENCE_TABS, type Audience, type Facet } from "@/types/shopping";

/**
 * Everyone, women, men, kids.
 *
 * Who a thing is for is the first question anybody asks in a clothes shop, so
 * it sits above the rest rather than inside the filter panel. Every other
 * filter then narrows whatever is chosen here.
 *
 * The counts come from the shops' own labelling. A few products never say who
 * they are for; those appear under Everyone and nowhere else, because putting
 * a man's shirt in the women's tab is worse than leaving it out of both.
 */
export function AudienceTabs({
  value,
  counts,
  total,
  onChange,
}: {
  value: Audience | "";
  counts?: Facet[];
  total?: number;
  onChange: (next: Audience | "") => void;
}) {
  function countFor(tab: Audience | ""): number | undefined {
    if (!counts) return undefined;
    if (tab === "") return total;
    return counts.find((facet) => facet.value === tab)?.count;
  }

  return (
    <div
      role="tablist"
      aria-label="Who the clothes are for"
      className="flex w-full gap-1 overflow-x-auto rounded-xl border border-border bg-muted/40 p-1"
    >
      {AUDIENCE_TABS.map((tab) => {
        const selected = value === tab.value;
        const count = countFor(tab.value);

        return (
          <button
            key={tab.value || "all"}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm transition-colors",
              selected
                ? "bg-card font-semibold text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
            )}
          >
            {tab.label}
            {count !== undefined ? (
              <span className="text-xs font-normal tabular-nums opacity-70">
                {count.toLocaleString("en-US")}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
