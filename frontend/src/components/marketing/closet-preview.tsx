import { CloudSun, MapPin, Tag } from "lucide-react";

import { GARMENT_SHAPES } from "@/components/wardrobe/garment-shapes";
import { cn } from "@/lib/utils";
import type { Slot } from "@/types/wardrobe";

// Six made-up garments, drawn as the app draws a closet. Nothing here is
// anybody's real wardrobe.
const GARMENTS: { name: string; slot: Slot; worn: string; tone: string }[] = [
  { name: "Navy Kurta", slot: "TOP", worn: "Worn 12 times", tone: "fill-chart-1" },
  { name: "Linen Shirt", slot: "TOP", worn: "Worn yesterday", tone: "fill-chart-2" },
  { name: "Black Trousers", slot: "BOTTOM", worn: "Worn 8 times", tone: "fill-foreground/80" },
  { name: "Olive Jacket", slot: "OUTERWEAR", worn: "Not worn for 3 months", tone: "fill-chart-3" },
  { name: "Khussa", slot: "FOOTWEAR", worn: "Worn 4 times", tone: "fill-chart-5" },
  { name: "Silk Dupatta", slot: "ACCESSORY", worn: "Worn 2 times", tone: "fill-chart-4" },
];

/**
 * A picture of the app, built from the same shapes the app uses, so the front
 * page never shows a screenshot that has gone out of date.
 */
export function ClosetPreview({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="A preview of a closet in My Closette: six garments, each with how often it has been worn, where one of them is kept, today's weather, and a price drop at a shop"
      className={cn("relative pt-6 pb-8 sm:px-4", className)}
    >
      <div className="rounded-3xl border border-border/80 bg-card/90 p-3 shadow-2xl shadow-primary/10 backdrop-blur sm:p-4">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-sm font-semibold">My Clothes</span>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            24 items, 2 in the wash
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {GARMENTS.map((garment) => (
            <div
              key={garment.name}
              className="rounded-xl border border-border bg-background p-2.5 transition-transform duration-500 hover:-translate-y-1"
            >
              <svg viewBox="0 0 100 100" aria-hidden className="mx-auto size-12 sm:size-16">
                <path d={GARMENT_SHAPES[garment.slot]} className={garment.tone} />
              </svg>
              <p className="mt-1.5 truncate text-xs font-medium">{garment.name}</p>
              <p className="truncate text-[0.68rem] text-muted-foreground">{garment.worn}</p>
            </div>
          ))}
        </div>

        <p className="mt-3 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs">
          <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden />
          <span className="truncate">
            <span className="font-medium">Navy Kurta</span>
            <span className="text-muted-foreground"> is in Bedroom &gt; Wardrobe &gt; Drawer 2</span>
          </span>
        </p>
      </div>

      {/* Two small cards hang off the edges: what the app adds around a
          closet, the weather and the shop prices. They sit over the margins,
          never over the words inside. */}
      <div className="animate-float absolute left-0 top-0 rounded-2xl border border-border bg-card px-3.5 py-2.5 shadow-lg sm:-left-6">
        <p className="flex items-center gap-2 text-xs font-medium">
          <CloudSun className="size-4 text-chart-4" aria-hidden />
          31 C in Lahore
        </p>
        <p className="mt-0.5 text-[0.7rem] text-muted-foreground">Warm. Light clothes are enough.</p>
      </div>

      <div
        className="animate-float-slow absolute bottom-0 right-0 rounded-2xl border border-border bg-card px-3.5 py-2.5 shadow-lg sm:-right-6"
        style={{ animationDelay: "1.2s" }}
      >
        <p className="flex items-center gap-2 text-xs font-medium">
          <Tag className="size-4 text-chart-5" aria-hidden />
          Price dropped at Outfitters
        </p>
        <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
          Linen shirt, <span className="line-through">Rs 5,990</span> Rs 2,990
        </p>
      </div>
    </div>
  );
}
