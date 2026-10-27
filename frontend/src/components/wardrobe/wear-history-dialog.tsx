"use client";

import Link from "next/link";
import { History } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import { useItemWears } from "@/hooks/use-wardrobe";
import { friendlyDay, parseDay } from "@/lib/dates";
import { lastWorn, lastWornSentence } from "@/lib/wear";
import type { GarmentListItem } from "@/types/wardrobe";

/**
 * Every day one thing was worn, opened from wherever that thing appears. The
 * list is only fetched once the panel is actually opened, so a grid of forty
 * items does not pull forty histories nobody asked for.
 */
export function WearHistoryDialog({
  item,
  open,
  onOpenChange,
  trigger,
}: {
  item: GarmentListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const { data: log, isPending, isError } = useItemWears(open ? item.id : null);
  const summary = lastWorn(item);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger render={trigger as React.ReactElement} /> : null}

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-left">
            <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
              <GarmentPicture src={item.display_image_url} sizes="44px" className="p-1" iconClassName="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate">{item.name}</span>
              <span className="block text-sm font-normal text-muted-foreground">
                {item.wear_count === 0
                  ? "Never worn"
                  : `Worn ${item.wear_count} ${item.wear_count === 1 ? "day" : "days"}`}
              </span>
            </span>
          </DialogTitle>

          <DialogDescription className="text-left">
            {lastWornSentence(summary)}.
          </DialogDescription>
        </DialogHeader>

        {isError ? (
          <p role="alert" className="text-sm text-muted-foreground">
            The history could not be loaded just now.
          </p>
        ) : isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-11 rounded-lg" />
            <Skeleton className="h-11 rounded-lg" />
            <Skeleton className="h-11 rounded-lg" />
          </div>
        ) : log.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            No days recorded yet. Open the item and tap
            <span className="font-medium text-foreground"> I wore this today</span> when you next
            wear it.
          </p>
        ) : (
          <ol className="relative space-y-3 border-l border-border pl-5">
            {log.map((wear) => (
              <li key={wear.id} className="relative">
                <span
                  className="absolute -left-[1.4375rem] top-1.5 size-2.5 rounded-full bg-primary ring-4 ring-background"
                  aria-hidden
                />
                <p className="font-medium">{friendlyDay(wear.worn_on)}</p>
                <p className="text-sm text-muted-foreground">
                  {wear.note ? wear.note : parseDay(wear.worn_on).toDateString()}
                </p>
              </li>
            ))}
          </ol>
        )}

        <Link
          href={`/closet/${item.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Open this item
        </Link>
      </DialogContent>
    </Dialog>
  );
}

/** The small button that opens the panel above. */
export function HistoryButton(props: React.ComponentProps<typeof Button>) {
  return (
    <Button type="button" variant="ghost" size="sm" {...props}>
      <History className="size-4" aria-hidden />
      When did I wear it?
    </Button>
  );
}
