"use client";

import { ArrowDown, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import { money, savingLabel } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Deal } from "@/types/shopping";

/**
 * One thing on sale at one shop: the shop's photo, the name, the price now
 * and before, what that saves, what kind of thing it is, and a way to buy it.
 * Nothing else, so a row of cards reads at a glance.
 */
export function DealCard({ deal }: { deal: Deal }) {
  const saving = savingLabel(deal.saving, deal.currency);

  return (
    <article
      className={cn(
        // h-full so every card in a row is the same height. Without it each
        // one shrinks to its own text and the grid looks ragged.
        "group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10",
        !deal.in_stock && "opacity-75",
      )}
    >
      <div className="relative aspect-3/4 overflow-hidden bg-muted/40">
        {/* The photo grows a little on hover. The frame clips the growth. */}
        <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-105">
          <GarmentPicture
            src={deal.image_url}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            cover
          />
        </div>

        <div className="absolute left-2 top-2 flex flex-col items-start gap-1.5">
          {deal.discount_percent > 0 ? (
            <Badge className="bg-primary text-primary-foreground shadow-md shadow-primary/30">
              {deal.discount_percent}% off
            </Badge>
          ) : null}

          {deal.just_dropped ? (
            <Badge variant="secondary" className="gap-1 bg-card/90 shadow-sm backdrop-blur">
              <ArrowDown className="size-3" aria-hidden />
              Price just dropped
            </Badge>
          ) : null}
        </div>

        {!deal.in_stock ? (
          <Badge variant="secondary" className="absolute right-2 top-2 bg-card/90 shadow-sm backdrop-blur">
            Sold out
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3
          className="line-clamp-2 min-h-10 text-sm font-medium leading-snug"
          title={deal.title}
        >
          {deal.title}
        </h3>

        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-display text-lg font-semibold tabular-nums tracking-tight">
            {money(deal.price, deal.currency)}
          </span>
          {deal.was_price ? (
            <span className="text-sm text-muted-foreground line-through tabular-nums">
              {money(deal.was_price, deal.currency)}
            </span>
          ) : null}
        </p>

        {saving ? <p className="text-xs font-medium text-primary">{saving}</p> : null}

        <p className="text-xs text-muted-foreground">{deal.category_name || deal.slot_label}</p>

        <a
          href={deal.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
        >
          {/* The whole spoken label lives in one place. Split across a text
              node and a hidden span, the two ran together as "Buyat Outfitters"
              with no space between them. */}
          <span aria-hidden>Buy</span>
          <ExternalLink className="size-4" aria-hidden />
          <span className="sr-only">Buy at {deal.shop_name} (opens the shop in a new tab)</span>
        </a>
      </div>
    </article>
  );
}
