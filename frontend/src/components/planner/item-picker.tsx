"use client";

import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";

import { HistoryButton, WearHistoryDialog } from "@/components/wardrobe/wear-history-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import { useGarments } from "@/hooks/use-wardrobe";
import { cn } from "@/lib/utils";
import { lastWorn, lastWornSentence } from "@/lib/wear";
import { SLOT_LABELS, SLOTS, type Slot } from "@/types/wardrobe";
import type { GarmentListItem } from "@/types/wardrobe";

/**
 * Picking several things out of the closet. Kept as tappable tiles with
 * pictures rather than a list of names, because the picture is what most
 * people recognise their own clothes by.
 */
export function ItemPicker({
  chosen,
  onChange,
  max,
  known = [],
}: {
  chosen: number[];
  onChange: (ids: number[]) => void;
  max: number;
  /** Items already picked before this opened, which may not be on screen. */
  known?: GarmentListItem[];
}) {
  const [slot, setSlot] = useState<Slot | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [showingHistoryFor, setShowingHistoryFor] = useState<number | null>(null);

  const filters = useMemo(
    () => ({
      wearable: true,
      page_size: 60,
      ...(slot !== "ALL" ? { slot } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    }),
    [slot, search],
  );

  const { data, isPending } = useGarments(filters);

  // Filtering the grid must not lose what has already been picked, so each one
  // is kept as it is chosen. Seeded from a plan being edited, whose items may
  // not be on screen at all.
  const [chosenDetails, setChosenDetails] = useState<Map<number, GarmentListItem>>(
    () => new Map(known.map((item) => [item.id, item])),
  );

  const picked = new Set(chosen);
  const full = chosen.length >= max;
  const pickedItems = chosen
    .map((id) => chosenDetails.get(id))
    .filter((item): item is GarmentListItem => Boolean(item));

  function toggle(item: GarmentListItem) {
    if (picked.has(item.id)) {
      onChange(chosen.filter((each) => each !== item.id));
      return;
    }
    if (full) return;
    setChosenDetails((current) => new Map(current).set(item.id, item));
    onChange([...chosen, item.id]);
  }

  const openHistoryFor =
    pickedItems.find((item) => item.id === showingHistoryFor) ??
    (data?.results ?? []).find((item) => item.id === showingHistoryFor);

  return (
    <div className="space-y-4">
      {pickedItems.length > 0 ? (
        <div className="animate-in fade-in slide-in-from-bottom-1 rounded-2xl border border-primary/20 bg-primary/5 p-3 duration-300">
          <p className="mb-2 text-sm font-medium">What you picked</p>

          <ul className="space-y-2">
            {pickedItems.map((item) => {
              const worn = lastWorn(item);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-card p-2 shadow-sm"
                >
                  <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-b from-muted/80 to-muted/20">
                    <GarmentPicture src={item.display_image_url} sizes="44px" className="p-0.5" iconClassName="size-4" />
                  </span>

                  <span className="min-w-40 flex-1">
                    <span className="block truncate text-sm font-medium">{item.name}</span>
                    <span
                      className={cn(
                        "block text-xs",
                        worn.recent ? "text-amber-700" : "text-muted-foreground",
                      )}
                    >
                      {lastWornSentence(worn)}
                    </span>
                  </span>

                  <HistoryButton
                    onClick={() => setShowingHistoryFor(item.id)}
                    className="h-9 text-muted-foreground"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => toggle(item)}
                    className="size-9 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" aria-hidden />
                    <span className="sr-only">Take {item.name} out of this day</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-48 flex-1">
          <Label htmlFor="plan-search" className="sr-only">
            Find something
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="plan-search"
              type="search"
              value={search}
              placeholder="Find something, like: blue shirt"
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 rounded-full border-transparent bg-muted/60 pl-10 focus-visible:border-ring focus-visible:bg-card"
            />
          </div>
        </div>

        <p
          className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          {chosen.length} of {max} picked
        </p>
      </div>

      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex gap-2">
          {(["ALL", ...SLOTS] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={slot === value ? "default" : "outline"}
              aria-pressed={slot === value}
              onClick={() => setSlot(value)}
              className={cn("h-9 shrink-0 rounded-full px-3.5", slot === value && "shadow-md shadow-primary/20")}
            >
              {value === "ALL" ? "Everything" : SLOT_LABELS[value]}
            </Button>
          ))}
        </div>
      </div>

      {isPending ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-busy>
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="aspect-4/5 rounded-2xl" />
          ))}
        </div>
      ) : (data?.results.length ?? 0) === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Nothing here matches. Try another word, or pick a different sort above.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {(data?.results ?? []).map((item) => {
            const isPicked = picked.has(item.id);
            const worn = lastWorn(item);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => toggle(item)}
                  aria-pressed={isPicked}
                  disabled={!isPicked && full}
                  aria-label={`${item.name}. ${lastWornSentence(worn)}.`}
                  className={cn(
                    "relative flex aspect-4/5 w-full flex-col overflow-hidden rounded-2xl border bg-card text-left transition-all duration-200",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    isPicked
                      ? "border-primary bg-primary/5 shadow-md shadow-primary/15"
                      : "border-border hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                    !isPicked && full && "cursor-not-allowed opacity-40",
                  )}
                >
                  <span className="relative block w-full flex-1 bg-gradient-to-b from-muted/80 to-muted/20">
                    <GarmentPicture
                      src={item.display_image_url}
                      sizes="(max-width: 640px) 30vw, 140px"
                      className="p-2"
                      iconClassName="size-7"
                    />
                  </span>

                  <span className="line-clamp-2 px-2.5 py-2 text-xs font-medium leading-tight">
                    {item.name}
                  </span>

                  {worn.recent ? (
                    <span
                      className="absolute left-1.5 top-1.5 rounded-full bg-card/90 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 shadow-sm backdrop-blur"
                      aria-hidden
                    >
                      {worn.when.replace("Worn ", "")}
                    </span>
                  ) : null}

                  {isPicked ? (
                    <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground animate-in zoom-in-50 duration-200">
                      <Check className="size-3" aria-hidden />
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {full ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <X className="size-4" aria-hidden />
          That is as many as one day can hold. Take one out to add another.
        </p>
      ) : null}

      {openHistoryFor ? (
        <WearHistoryDialog
          item={openHistoryFor}
          open
          onOpenChange={(next) => {
            if (!next) setShowingHistoryFor(null);
          }}
        />
      ) : null}
    </div>
  );
}
