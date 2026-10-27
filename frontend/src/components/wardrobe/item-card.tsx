"use client";

import Link from "next/link";
import { Clock, Heart, MapPin, WashingMachine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import { thumbnail } from "@/lib/images";
import { cn } from "@/lib/utils";
import { lastWorn, lastWornSentence } from "@/lib/wear";
import type { GarmentListItem } from "@/types/wardrobe";

interface Props {
  item: GarmentListItem;
  onWear?: (id: number) => void;
  onToggleLaundry?: (id: number) => void;
  onToggleFavorite?: (id: number) => void;
  busy?: boolean;
  /** Loads the picture first. For the handful of cards at the top of a page. */
  priority?: boolean;
}

export function ItemCard({
  item,
  onWear,
  onToggleLaundry,
  onToggleFavorite,
  busy,
  priority,
}: Props) {
  const inWash = item.status === "IN_LAUNDRY";
  const worn = lastWorn(item);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card focus-within:ring-3 focus-within:ring-ring/50 hover:border-primary/40">
      <div className="relative aspect-square bg-muted/40">
        <GarmentPicture
          src={thumbnail(item.display_image_url, 400)}
          alt={item.name}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className={cn("p-3", inWash && "opacity-50")}
          iconClassName="size-10"
          priority={priority}
        />

        {onToggleFavorite ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={busy}
            onClick={() => onToggleFavorite(item.id)}
            className="absolute right-1.5 top-1.5 z-10 bg-card/85 backdrop-blur hover:bg-card"
          >
            <Heart
              className={cn("size-5", item.is_favorite && "fill-destructive text-destructive")}
              aria-hidden
            />
            <span className="sr-only">
              {item.is_favorite ? `Remove ${item.name} from favourites` : `Save ${item.name} to favourites`}
            </span>
          </Button>
        ) : null}

        {/* Status is stated in words, not only by the dimmed image. */}
        {inWash ? (
          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-card/90 px-2 py-1 text-xs font-medium backdrop-blur">
            <WashingMachine className="size-3.5" aria-hidden />
            In the wash
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        {/* Covers the card so the whole tile opens the item, while the buttons
            below sit above it and keep their own click. */}
        <h3 className="line-clamp-2 text-sm font-medium leading-snug">
          <Link href={`/closet/${item.id}`} className="outline-none after:absolute after:inset-0">
            {item.name}
          </Link>
        </h3>

        <p className="text-xs text-muted-foreground">
          {[item.brand, item.category_name].filter(Boolean).join(", ") || item.category_name}
        </p>

        {item.location_path ? (
          <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
            <MapPin className="mt-px size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-1">{item.location_path}</span>
          </p>
        ) : null}

        <p className="mt-1 flex items-start gap-1 text-xs">
          <Clock className="mt-px size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className={cn(worn.recent ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
            {lastWornSentence(worn)}
          </span>
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          {item.wear_count === 0
            ? "Not worn yet"
            : `Worn ${item.wear_count} ${item.wear_count === 1 ? "time" : "times"}`}
          {item.cost_per_wear !== null
            ? `, ${Math.round(item.cost_per_wear)} ${item.currency} each time`
            : ""}
        </p>

        {(onWear || onToggleLaundry) && (
          <div className="relative z-10 mt-3 flex flex-wrap gap-2">
            {onWear ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={busy || inWash}
                onClick={() => onWear(item.id)}
              >
                I wore this
              </Button>
            ) : null}
            {onToggleLaundry ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="flex-1"
                disabled={busy}
                onClick={() => onToggleLaundry(item.id)}
              >
                {inWash ? "It is clean" : "To the wash"}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}
