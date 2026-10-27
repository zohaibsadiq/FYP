"use client";

import Link from "next/link";
import { Heart, MapPin, WashingMachine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import { thumbnail } from "@/lib/images";
import { cn } from "@/lib/utils";
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

/**
 * One piece of clothing as a card: the picture, the name, what it is, where
 * it is kept, and the two buttons people press most.
 *
 * Every card has exactly the same lines, whether or not the facts are known,
 * so a grid of them lines up. The rest (when it was worn, what it cost) lives
 * on the item page.
 */
export function ItemCard({
  item,
  onWear,
  onToggleLaundry,
  onToggleFavorite,
  busy,
  priority,
}: Props) {
  const inWash = item.status === "IN_LAUNDRY";
  const kind = [item.brand, item.category_name].filter(Boolean).join(", ") || item.category_name;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 focus-within:ring-3 focus-within:ring-ring/50 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
      <div className="relative aspect-4/5 overflow-hidden bg-gradient-to-b from-muted/80 to-muted/20">
        {/* The picture grows a little on hover. The frame clips the growth. */}
        <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-105">
          <GarmentPicture
            src={thumbnail(item.display_image_url, 400)}
            alt={item.name}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={cn("p-4", inWash && "opacity-50")}
            iconClassName="size-10"
            priority={priority}
          />
        </div>

        {onToggleFavorite ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onToggleFavorite(item.id)}
            className="absolute right-2 top-2 z-10 rounded-full bg-card/90 shadow-sm backdrop-blur hover:bg-card"
          >
            <Heart
              className={cn("size-4", item.is_favorite && "fill-destructive text-destructive")}
              aria-hidden
            />
            <span className="sr-only">
              {item.is_favorite ? `Remove ${item.name} from favourites` : `Save ${item.name} to favourites`}
            </span>
          </Button>
        ) : null}

        {/* The main colour the app found in the photo, as a small dot. */}
        {item.primary_color_hex ? (
          <span
            aria-hidden
            title={item.primary_color_name || undefined}
            className="absolute bottom-2 right-2 size-4 rounded-full border-2 border-card shadow-sm"
            style={{ background: item.primary_color_hex }}
          />
        ) : null}

        {/* Status is stated in words, not only by the dimmed image. */}
        {inWash ? (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur">
            <WashingMachine className="size-3.5 text-chart-2" aria-hidden />
            In the wash
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        {/* Covers the card so the whole tile opens the item, while the buttons
            below sit above it and keep their own click. */}
        <h3 className="truncate text-sm font-semibold leading-snug">
          <Link href={`/closet/${item.id}`} className="outline-none after:absolute after:inset-0">
            {item.name}
          </Link>
        </h3>

        <p className="mt-0.5 truncate text-xs text-muted-foreground">{kind}</p>

        {/* Always one place line, even when there is no place yet, so the
            buttons sit at the same height on every card. */}
        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{item.location_path || "No place yet"}</span>
        </p>

        {(onWear || onToggleLaundry) && (
          <div className="relative z-10 mt-auto flex gap-2 pt-3">
            {onWear ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-9 flex-1"
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
                className="h-9 flex-1"
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
