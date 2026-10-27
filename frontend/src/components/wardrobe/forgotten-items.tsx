"use client";

import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import { useGarments } from "@/hooks/use-wardrobe";
import { spanInWords } from "@/lib/dates";

/**
 * Things that have sat untouched for months, shown as pictures first. The
 * point is to remind the owner what they already have, not to tell them off
 * for it, so the time is a quiet label rather than a warning.
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
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  const items = data.results.slice(0, limit);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="forgotten-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">Forgotten</p>
          <h2 id="forgotten-heading" className="font-display text-2xl font-semibold tracking-tight">
            You have not worn these in a while
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Still in your closet, untouched for {spanInWords(days)} or more.
          </p>
        </div>

        {data.count > limit ? (
          <Link href="/closet" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            See all {data.count}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>

      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/closet/${item.id}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10"
            >
              <div className="relative aspect-4/3 bg-muted/40">
                <GarmentPicture src={item.display_image_url} sizes="(max-width: 1024px) 50vw, 25vw" className="p-3" />
                <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-card/90 px-2 py-1 text-[0.7rem] font-medium shadow-sm backdrop-blur">
                  <Clock className="size-3" aria-hidden />
                  {item.days_since_worn === null ? "Never worn" : `${spanInWords(item.days_since_worn)} ago`}
                </span>
              </div>
              <div className="p-3">
                <p className="truncate font-medium">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">{item.category_name}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
