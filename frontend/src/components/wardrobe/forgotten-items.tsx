"use client";

import Link from "next/link";
import { Clock } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import { useGarments } from "@/hooks/use-wardrobe";
import { spanInWords } from "@/lib/dates";

/**
 * Things that have sat untouched for months. Shown as a gentle nudge rather
 * than a warning: the point is to remind the owner what they already have,
 * not to tell them off for it.
 */
export function ForgottenItems({ days = 90, limit = 4 }: { days?: number; limit?: number }) {
  const { data, isPending, isError } = useGarments({
    unworn_days: days,
    wearable: true,
    ordering: "last_worn_date",
  });

  if (isError) return null;

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    );
  }

  const items = data.results.slice(0, limit);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="forgotten-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="forgotten-heading" className="text-lg font-semibold tracking-tight">
            You have not worn these in a while
          </h2>
          <p className="text-sm text-muted-foreground">
            Still in your closet, untouched for {spanInWords(days)} or more.
          </p>
        </div>

        {data.count > limit ? (
          <Link
            href="/closet"
            className="text-sm font-medium text-primary hover:underline"
          >
            See all {data.count}
          </Link>
        ) : null}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/closet/${item.id}`}
              className="flex h-full items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary hover:bg-accent"
            >
              <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                <GarmentPicture src={item.display_image_url} sizes="56px" className="p-1" iconClassName="size-5" />
              </span>

              <div className="min-w-0">
                <p className="truncate font-medium">{item.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" aria-hidden />
                  {item.days_since_worn === null
                    ? "Never worn"
                    : `${spanInWords(item.days_since_worn)} ago`}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
