"use client";

import { Check, Clock, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Listing } from "@/types/market";

/**
 * One thing somebody is selling.
 *
 * Everything on this card comes from the seller's own description of the
 * garment. Nothing about how they used it, what they paid or where they keep
 * it reaches here, and the server does not send it either.
 */
export function ListingCard({
  listing,
  onAsk,
  onReport,
}: {
  listing: Listing;
  onAsk: (listing: Listing) => void;
  onReport: (listing: Listing) => void;
}) {
  const asked = listing.my_enquiry_status;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
      <div className="relative aspect-3/4 overflow-hidden bg-gradient-to-b from-muted/80 to-muted/20">
        {/* The picture grows a little on hover. The frame clips the growth. */}
        <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-105">
          <GarmentPicture
            src={listing.item.display_image_url}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="p-3"
          />
        </div>

        <Badge variant="secondary" className="absolute left-2 top-2 bg-card/90 shadow-sm backdrop-blur">
          {listing.condition_label}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3
          className="line-clamp-2 min-h-10 text-sm font-medium leading-snug"
          title={listing.item.name}
        >
          {listing.item.name}
        </h3>

        <p className="font-display text-lg font-semibold tabular-nums tracking-tight">
          {money(listing.asking_price, listing.currency)}
        </p>

        <p className="text-xs text-muted-foreground">
          {[listing.item.category_name, listing.item.size && `Size ${listing.item.size}`,
            listing.item.brand]
            .filter(Boolean)
            .join(" - ")}
        </p>

        {listing.note ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{listing.note}</p>
        ) : null}

        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0 text-primary" aria-hidden />
          {listing.seller.display_name}
          {listing.city ? `, ${listing.city}` : ""}
        </p>

        <div className="mt-auto space-y-1.5 pt-2">
          {asked ? (
            <AlreadyAsked status={asked} />
          ) : (
            <Button
              type="button"
              onClick={() => onAsk(listing)}
              className="h-10 w-full rounded-xl shadow-md shadow-primary/20"
            >
              Ask to buy
            </Button>
          )}

          <button
            type="button"
            onClick={() => onReport(listing)}
            className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Report this
          </button>
        </div>
      </div>
    </article>
  );
}

/**
 * What the button turns into once somebody has asked.
 *
 * Withdrawing a request removes it, so this never sees one: the card goes
 * straight back to offering the button, and the same person can ask again.
 */
function AlreadyAsked({ status }: { status: string }) {
  const settled = status === "ACCEPTED";
  const finished = status === "DECLINED" || status === "CLOSED";

  const words = settled
    ? "They said yes"
    : finished
      ? "This one is closed"
      : "Waiting for a reply";

  return (
    <p
      className={cn(
        "flex h-10 items-center justify-center gap-2 rounded-xl border text-sm",
        settled
          ? "border-primary/40 bg-primary/10 font-medium text-foreground"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      {settled ? (
        <Check className="size-4 text-primary" aria-hidden />
      ) : (
        <Clock className="size-4" aria-hidden />
      )}
      {words}
    </p>
  );
}
