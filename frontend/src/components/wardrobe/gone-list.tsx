"use client";

import Image from "next/image";
import { Archive, Shirt } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/wardrobe/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGarments, useToggleArchived } from "@/hooks/use-wardrobe";
import { getErrorMessage } from "@/lib/api";
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
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
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
    <ul className="space-y-3">
      {items.map((item: GarmentListItem) => (
        <li key={item.id}>
          <article className="flex items-center gap-3 rounded-xl border border-border p-3">
            <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
              {item.display_image_url ? (
                <Image
                  src={item.display_image_url}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-contain p-1"
                />
              ) : (
                <Shirt className="size-5 text-muted-foreground" aria-hidden />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{item.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {item.status_label}
                {item.wear_count > 0
                  ? ` - worn ${item.wear_count} ${item.wear_count === 1 ? "time" : "times"}`
                  : " - never worn"}
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
                className="h-11 shrink-0"
              >
                Bring it back
              </Button>
            ) : (
              <Badge variant="secondary" className="shrink-0">
                Sold
              </Badge>
            )}
          </article>
        </li>
      ))}
    </ul>
  );
}
