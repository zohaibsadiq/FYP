"use client";

import { useState } from "react";
import { ChevronDown, History } from "lucide-react";

import { usePriceHistory } from "@/hooks/use-shopping";
import { friendlyDay } from "@/lib/dates";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * What this thing has cost before now.
 *
 * Only asked for when somebody opens it, and only offered at all once a price
 * has really moved. A row is written when the price changes, never on every
 * refresh, so an empty list honestly means "it has not changed".
 */
export function PriceHistory({
  dealId,
  currency,
}: {
  dealId: number;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const { data, isPending } = usePriceHistory(open ? dealId : null);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
      >
        <History className="size-3" aria-hidden />
        Price history
        <ChevronDown
          className={cn("size-3 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="animate-in fade-in slide-in-from-top-1 mt-2 rounded-xl bg-muted/40 p-2 duration-200">
          {isPending ? (
            <p className="text-xs text-muted-foreground">Looking...</p>
          ) : !data || data.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              This price has not changed since we started watching it.
            </p>
          ) : (
            <ul className="space-y-1">
              {data.map((change) => (
                <li
                  key={change.noticed_at}
                  className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground"
                >
                  <span className="font-medium tabular-nums text-foreground">
                    {money(change.price, currency)}
                  </span>
                  <span>{friendlyDay(change.noticed_at.slice(0, 10))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
