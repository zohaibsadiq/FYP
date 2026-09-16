"use client";

import { useState } from "react";
import { ChevronDown, Clock, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { friendlyDay } from "@/lib/dates";
import type { Freshness } from "@/types/shopping";

/**
 * How old the prices are, said out loud.
 *
 * Nothing here is fetched live from a shop, so the one thing a shopper is owed
 * is the age of what they are looking at. It is never hidden behind a tooltip:
 * a stale price that looks current is worse than no price.
 */
export function FreshnessBar({ freshness }: { freshness?: Freshness }) {
  const [showShops, setShowShops] = useState(false);

  if (!freshness) return null;

  const failing = freshness.shops_total - freshness.shops_working;

  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-sm",
        freshness.is_stale
          ? "border-amber-300/60 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/30"
          : "border-border bg-muted/30",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="flex items-center gap-2">
          {freshness.is_stale ? (
            <TriangleAlert className="size-4 shrink-0 text-amber-600" aria-hidden />
          ) : (
            <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span>{freshness.summary}</span>
        </p>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowShops((open) => !open)}
          aria-expanded={showShops}
          className="h-8 gap-1 px-2 text-xs"
        >
          {freshness.shops_working} of {freshness.shops_total} shops
          {failing > 0 ? `, ${failing} not answering` : ""}
          <ChevronDown
            className={cn("size-3.5 transition-transform", showShops && "rotate-180")}
            aria-hidden
          />
        </Button>
      </div>

      {showShops ? (
        <ul className="mt-3 grid gap-1.5 border-t border-border/60 pt-3 sm:grid-cols-2">
          {freshness.shops.map((shop) => (
            <li key={shop.id} className="flex items-baseline justify-between gap-3 text-xs">
              <a
                href={shop.site_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline"
              >
                {shop.name}
              </a>
              <span className="text-muted-foreground">
                {shop.deal_count.toLocaleString("en-US")} things
                {shop.last_checked_at ? `, ${friendlyDay(shop.last_checked_at.slice(0, 10))}` : ""}
                {shop.last_result === "FAILED" ? " (last check failed)" : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
