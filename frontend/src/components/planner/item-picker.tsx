"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Check, Search, Shirt, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useGarments } from "@/hooks/use-wardrobe";
import { cn } from "@/lib/utils";
import { SLOT_LABELS, SLOTS, type Slot } from "@/types/wardrobe";

/**
 * Picking several things out of the closet. Kept as tappable tiles with
 * pictures rather than a list of names, because the picture is what most
 * people recognise their own clothes by.
 */
export function ItemPicker({
  chosen,
  onChange,
  max,
}: {
  chosen: number[];
  onChange: (ids: number[]) => void;
  max: number;
}) {
  const [slot, setSlot] = useState<Slot | "ALL">("ALL");
  const [search, setSearch] = useState("");

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
  const picked = new Set(chosen);
  const full = chosen.length >= max;

  function toggle(id: number) {
    if (picked.has(id)) onChange(chosen.filter((each) => each !== id));
    else if (!full) onChange([...chosen, id]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Label htmlFor="plan-search" className="mb-2 block">
            Find something
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="plan-search"
              type="search"
              value={search}
              placeholder="Shirt, kurta, blue"
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 pl-9"
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground" aria-live="polite">
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
              className="shrink-0"
            >
              {value === "ALL" ? "Everything" : SLOT_LABELS[value]}
            </Button>
          ))}
        </div>
      </div>

      {isPending ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : (data?.results.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Nothing here matches. Try another word, or pick a different sort above.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {(data?.results ?? []).map((item) => {
            const isPicked = picked.has(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  aria-pressed={isPicked}
                  disabled={!isPicked && full}
                  className={cn(
                    "relative flex aspect-square w-full flex-col items-center justify-end gap-1 rounded-xl border p-2 text-center transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    isPicked
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-accent",
                    !isPicked && full && "cursor-not-allowed opacity-40",
                  )}
                >
                  <span className="relative flex flex-1 w-full items-center justify-center overflow-hidden">
                    {item.display_image_url ? (
                      <Image
                        src={item.display_image_url}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 30vw, 120px"
                        className="object-contain p-1"
                      />
                    ) : (
                      <Shirt className="size-7 text-muted-foreground" aria-hidden />
                    )}
                  </span>

                  <span className="line-clamp-2 text-xs leading-tight">{item.name}</span>

                  {isPicked ? (
                    <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
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
    </div>
  );
}
