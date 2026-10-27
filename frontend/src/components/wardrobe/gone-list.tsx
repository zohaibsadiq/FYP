"use client";

import { Archive } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/wardrobe/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import { useGarments, useToggleArchived } from "@/hooks/use-wardrobe";
import { getErrorMessage } from "@/lib/api";
import { thumbnail } from "@/lib/images";
import { cn } from "@/lib/utils";
import type { GarmentListItem } from "@/types/wardrobe";

/**
 * Things that have left the closet: sold, or put away for the season.
 *
 * They keep their history, which is the whole reason they are still here and
 * not deleted. Anything merely put away can be brought straight back; anything
 * sold cannot, because it belongs to somebody else now.
 */
export function GoneList({ search = "" }: { search?: string }) {
  const { data, isPending } = useGarments({ gone: true, ...(search ? { search } : {}) });
  const bringBack = useToggleArchived();
  const items = data?.results ?? [];

  if (isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Archive}
        title={search ? "Nothing matched" : "Nothing has left your closet"}
        body={
          search
            ? "None of the things you have sold or put away match that word."
            : "Things you sell, or put away because the season is over, are kept here instead of being deleted. That way you never lose how often you wore them."
        }
      />
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item: GarmentListItem, index) => {
        const sold = item.status === "SOLD";
        return (
          <li
            key={item.id}
            className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
            style={{ animationDelay: `${Math.min(index, 7) * 50}ms` }}
          >
            <article className="flex h-full items-center gap-4 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-primary/30">
              {/* Sold things go grey: they belong to somebody else now. */}
              <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-muted/80 to-muted/20">
                <GarmentPicture
                  src={thumbnail(item.display_image_url, 200)}
                  sizes="80px"
                  className={cn("p-2", sold && "opacity-70 grayscale")}
                  iconClassName="size-6"
                />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.name}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <Badge variant={sold ? "default" : "secondary"}>{item.status_label}</Badge>
                  <span>
                    {item.wear_count > 0
                      ? `worn ${item.wear_count} ${item.wear_count === 1 ? "time" : "times"}`
                      : "never worn"}
                  </span>
                </span>
              </span>

              {item.status === "ARCHIVED" ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={bringBack.isPending}
                  onClick={() =>
                    bringBack.mutate(
                      { id: item.id, archived: false },
                      {
                        onSuccess: () => toast.success("Back in your closet."),
                        onError: (error: unknown) =>
                          toast.error(getErrorMessage(error, "That did not save. Try again.")),
                      },
                    )
                  }
                  className="h-10 shrink-0 rounded-full"
                >
                  Bring it back
                </Button>
              ) : null}
            </article>
          </li>
        );
      })}
    </ul>
  );
}
