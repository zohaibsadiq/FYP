"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import { useRecentWears } from "@/hooks/use-wardrobe";
import { friendlyDay } from "@/lib/dates";
import type { WearEvent } from "@/types/wardrobe";

/** Groups the flat list into one block per day, newest day first. */
function byDay(events: WearEvent[]): { date: string; note: string; worn: WearEvent[] }[] {
  const days = new Map<string, WearEvent[]>();
  for (const event of events) {
    const existing = days.get(event.worn_on);
    if (existing) existing.push(event);
    else days.set(event.worn_on, [event]);
  }
  return [...days.entries()].map(([date, worn]) => ({
    date,
    note: worn.find((event) => event.note)?.note ?? "",
    worn,
  }));
}

export function RecentWears({ days = 7 }: { days?: number }) {
  const { data, isPending, isError } = useRecentWears(days);

  if (isError) return null;

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  const grouped = byDay(data);

  return (
    <section aria-labelledby="recent-wears-heading" className="space-y-4">
      <h2 id="recent-wears-heading" className="text-lg font-semibold tracking-tight">
        What you wore this week
      </h2>

      {grouped.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-border p-4">
          <CalendarDays className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Nothing recorded in the last {days} days. Open any item and tap
            <span className="font-medium text-foreground"> I wore this today</span>, and it starts
            keeping track for you.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {grouped.map((day) => (
            <li key={day.date} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{friendlyDay(day.date)}</p>
                <p className="text-sm text-muted-foreground">
                  {day.note ? day.note : `${day.worn.length} ${day.worn.length === 1 ? "thing" : "things"}`}
                </p>
              </div>

              <ul className="mt-3 flex flex-wrap gap-2">
                {day.worn.map((wear) => (
                  <li key={wear.id}>
                    <Link
                      href={`/closet/${wear.item}`}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card py-1.5 pl-1.5 pr-3 text-sm transition-colors hover:border-primary hover:bg-accent"
                    >
                      <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                        <GarmentPicture src={wear.item_image_url} sizes="36px" className="p-0.5" iconClassName="size-4" />
                      </span>
                      {wear.item_name}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
