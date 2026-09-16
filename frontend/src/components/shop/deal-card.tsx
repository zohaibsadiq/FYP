"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ExternalLink, Shirt, Sparkles, TriangleAlert } from "lucide-react";

import { PriceHistory } from "@/components/shop/price-history";
import { Badge } from "@/components/ui/badge";
import { money, savingLabel } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Deal } from "@/types/shopping";

/** How many sizes fit on a card before the rest become "+3 more". */
const SIZES_SHOWN = 5;

export function DealCard({ deal }: { deal: Deal }) {
  const saving = savingLabel(deal.saving, deal.currency);
  const extraSizes = deal.sizes.length - SIZES_SHOWN;

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md",
        !deal.in_stock && "opacity-75",
      )}
    >
      <div className="relative aspect-[3/4] bg-muted/40">
        {deal.image_url ? (
          <Image
            src={deal.image_url}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Shirt className="size-8 text-muted-foreground" aria-hidden />
          </div>
        )}

        <div className="absolute left-2 top-2 flex flex-col items-start gap-1.5">
          {deal.discount_percent > 0 ? (
            <Badge className="bg-primary text-primary-foreground shadow-sm">
              {deal.discount_percent}% off
            </Badge>
          ) : null}

          {deal.just_dropped ? (
            <Badge variant="secondary" className="gap-1 shadow-sm">
              <ArrowDown className="size-3" aria-hidden />
              Price just dropped
            </Badge>
          ) : null}
        </div>

        {!deal.in_stock ? (
          <Badge variant="secondary" className="absolute right-2 top-2 shadow-sm">
            Sold out
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {deal.shop_name}
        </p>

        <h3 className="line-clamp-2 text-sm font-medium leading-snug" title={deal.title}>
          {deal.title}
        </h3>

        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-base font-semibold tabular-nums">
            {money(deal.price, deal.currency)}
          </span>
          {deal.was_price ? (
            <span className="text-sm text-muted-foreground line-through tabular-nums">
              {money(deal.was_price, deal.currency)}
            </span>
          ) : null}
        </p>

        {saving ? <p className="text-xs font-medium text-primary">{saving}</p> : null}

        <p className="text-xs text-muted-foreground">
          {[deal.category_name || deal.slot_label, deal.color_name]
            .filter(Boolean)
            .join(" - ")}
        </p>

        {deal.sizes.length > 0 ? (
          <p className="flex flex-wrap gap-1" aria-label={`Sizes in stock: ${deal.sizes.join(", ")}`}>
            {deal.sizes.slice(0, SIZES_SHOWN).map((size) => (
              <span
                key={size}
                aria-hidden
                className="rounded border border-border px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground"
              >
                {size}
              </span>
            ))}
            {extraSizes > 0 ? (
              <span aria-hidden className="px-1 py-0.5 text-[11px] leading-4 text-muted-foreground">
                +{extraSizes} more
              </span>
            ) : null}
          </p>
        ) : null}

        {deal.price_fell_at ? (
          <PriceHistory dealId={deal.id} currency={deal.currency} />
        ) : null}

        <ClosetNote deal={deal} />

        <a
          href={deal.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Buy at {deal.shop_name}
          <ExternalLink className="size-4" aria-hidden />
          <span className="sr-only">(opens the shop in a new tab)</span>
        </a>
      </div>
    </article>
  );
}

/**
 * The one thing a shop's own page cannot tell somebody. Only printed when it
 * was actually worked out from their clothes, never as a filler line.
 */
function ClosetNote({ deal }: { deal: Deal }) {
  if (!deal.closet_note) return null;

  if (deal.fills_gap) {
    return (
      <p className="flex items-start gap-1.5 rounded-lg bg-primary/10 p-2 text-xs text-foreground">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
        {deal.closet_note}
      </p>
    );
  }

  return (
    <p className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 p-2 text-xs text-foreground">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden />
      <span>
        {deal.closet_note}{" "}
        {deal.owned_item_id ? (
          <Link
            href={`/closet/${deal.owned_item_id}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            See it
          </Link>
        ) : null}
      </span>
    </p>
  );
}
