"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import { useRecentWears } from "@/hooks/use-wardrobe";
import { addDays, friendlyDay, parseDay, todayIso } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { WearEvent } from "@/types/wardrobe";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The last seven days, oldest first, each with what was worn on it. */
export function lastSevenDays(events: WearEvent[], today = todayIso()) {
  const byDate = new Map<string, WearEvent[]>();
  for (const event of events) {
    const list = byDate.get(event.worn_on);
    if (list) list.push(event);
    else byDate.set(event.worn_on, [event]);
  }
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    return { date, worn: byDate.get(date) ?? [] };
  });
}

/**
 * The week as a strip of seven days, with the clothes worn on each day shown
 * as small pictures. Days with nothing on them stay quiet, so a week reads at
 * a glance: busy days are full, rest days are empty.
 */
export function RecentWears() {
  const { data, isPending, isError } = useRecentWears(7);

  if (isError) return null;

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  const today = todayIso();
  const days = lastSevenDays(data, today);
  const total = data.length;
  const busiest = days.filter((day) => day.worn.length > 0).slice(-3).reverse();

  return (
    <section aria-labelledby="recent-wears-heading" className="space-y-4">
      <div>
        <p className="text-sm font-medium text-primary">This week</p>
        <h2 id="recent-wears-heading" className="font-display text-2xl font-semibold tracking-tight">
          What you wore this week
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {total === 0
            ? "Nothing recorded in the last 7 days."
            : `${total} ${total === 1 ? "wearing" : "wearings"} in the last 7 days.`}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
        <ol className="grid grid-cols-7 gap-1.5 sm:gap-2" aria-label="The last seven days">
          {days.map((day) => {
            const isToday = day.date === today;
            const shown = day.worn.slice(0, 3);
            const extra = day.worn.length - shown.length;
            return (
              <li
                key={day.date}
                aria-current={isToday ? "date" : undefined}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl px-1 py-2.5 transition-colors",
                  isToday ? "bg-primary/10 ring-1 ring-primary/20" : "bg-muted/40",
                )}
              >
                <span className={cn("text-xs font-medium", isToday ? "text-primary" : "text-muted-foreground")}>
                  {isToday ? "Today" : WEEKDAY[parseDay(day.date).getDay()]}
                </span>

                <div className="flex min-h-11 items-center justify-center">
                  {day.worn.length === 0 ? (
                    <span className="size-2 rounded-full bg-border" aria-hidden />
                  ) : (
                    <div className="flex -space-x-2.5">
                      {shown.map((wear) => (
                        <Link
                          key={wear.id}
                          href={`/closet/${wear.item}`}
                          title={wear.item_name}
                          className="relative flex size-10 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-background shadow-sm transition-transform hover:z-10 hover:scale-110"
                        >
                          <GarmentPicture src={wear.item_image_url} sizes="40px" className="p-1.5" iconClassName="size-4" />
                          <span className="sr-only">{wear.item_name}</span>
                        </Link>
                      ))}
                      {extra > 0 ? (
                        <span className="flex size-10 items-center justify-center rounded-full border-2 border-card bg-muted text-xs font-medium">
                          +{extra}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>

                <span className="text-[0.7rem] tabular-nums text-muted-foreground">
                  {day.worn.length > 0 ? day.worn.length : " "}
                </span>
              </li>
            );
          })}
        </ol>

        {busiest.length === 0 ? (
          <p className="mt-4 flex items-start gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Open any item and tap
              <span className="font-medium text-foreground"> I wore this today</span>, and this strip
              starts filling in.
            </span>
          </p>
        ) : (
          <ul className="mt-4 space-y-1.5 text-sm">
            {busiest.map((day) => {
              const note = day.worn.find((event) => event.note)?.note;
              return (
                <li key={day.date} className="flex flex-wrap gap-x-2">
                  <span className="font-medium">{friendlyDay(day.date)}</span>
                  <span className="text-muted-foreground">
                    {day.worn.map((event) => event.item_name).join(", ")}
                    {note ? ` - ${note}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
