"use client";

import { cn } from "@/lib/utils";
import { AUDIENCE_TABS, type Audience } from "@/types/market";

/**
 * Everyone, women, men, kids, across the top of Buy and Sell.
 *
 * It starts on whatever the person normally shops for, which is set once in
 * their details and can be changed here at any time without saving anything.
 * Items whose seller did not say who they suit appear under Everyone only,
 * because putting a man's shirt in the women's tab is worse than leaving it
 * out of both.
 */
export function AudienceRow({
  value,
  onChange,
}: {
  value: Audience | "";
  onChange: (next: Audience | "") => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Whose clothes to show"
      className="flex w-full gap-1 overflow-x-auto rounded-full border border-border bg-muted/50 p-1"
    >
      {AUDIENCE_TABS.map((tab) => {
        const selected = value === tab.value;
        return (
          <button
            key={tab.value || "all"}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={cn(
              "min-h-10 flex-1 whitespace-nowrap rounded-full px-4 text-sm transition-all duration-200",
              selected
                ? "bg-primary font-semibold text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:bg-card hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
