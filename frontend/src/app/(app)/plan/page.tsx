"use client";

import { useState } from "react";
import { ArrowRight, CalendarDays, Check } from "lucide-react";

import { DayPlan } from "@/components/planner/day-plan";
import { MonthGrid } from "@/components/planner/month-grid";
import { Button } from "@/components/ui/button";
import { usePlanMonth } from "@/hooks/use-planner";
import { addMonths, friendlyDay, monthGrid, parseDay, startOfMonth, todayIso } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { PlanDay } from "@/types/planner";

export default function PlanPage() {
  const today = todayIso();
  const [month, setMonth] = useState(startOfMonth(today));
  const [selected, setSelected] = useState(today);

  // The grid draws the days either side of the month too, so the range asked
  // for covers them: a plan on 31 August should show in the September view.
  const grid = monthGrid(month);
  const { data: days } = usePlanMonth(grid[0].date, grid[grid.length - 1].date);

  // The next few planned days in view, for a quick jump without hunting
  // through the grid.
  const upcoming = (days ?? [])
    .filter((day) => day.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  function step(by: number) {
    setMonth(addMonths(month, by));
  }

  function jumpToToday() {
    setMonth(startOfMonth(today));
    setSelected(today);
  }

  function select(date: string) {
    setSelected(date);
    setMonth(startOfMonth(date));
  }

  return (
    <div className="relative mx-auto max-w-6xl space-y-6">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 -z-10 h-72 w-full overflow-hidden">
        <div className="animate-drift absolute -top-10 right-10 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-drift absolute left-1/3 top-6 size-56 rounded-full bg-chart-4/15 blur-3xl [animation-delay:-8s]" />
      </div>

      <header className="animate-in fade-in slide-in-from-bottom-2 flex flex-wrap items-end justify-between gap-4 duration-500">
        <div>
          <p className="text-sm font-medium text-primary">Planner</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Plan your days
          </h1>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Pick a day, choose what you will wear, and it is waiting for you when the day comes.
          </p>
        </div>

        <Button type="button" variant="outline" onClick={jumpToToday} className="h-11 gap-2 px-5">
          <CalendarDays className="size-4" aria-hidden />
          Go to today
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* The calendar stays in view on a wide screen while the day scrolls. */}
        <div>
          <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both space-y-4 duration-500 [animation-delay:60ms] lg:sticky lg:top-6">
            <MonthGrid
              month={month}
              selected={selected}
              days={days ?? []}
              onSelect={select}
              onMonthChange={step}
            />

            {upcoming.length > 0 ? (
              <Upcoming days={upcoming} selected={selected} onSelect={select} />
            ) : null}
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both overflow-hidden rounded-3xl border border-border bg-card duration-500 [animation-delay:120ms]">
          <DayPlan date={selected} />
        </div>
      </div>
    </div>
  );
}

/** The next planned days, each one a shortcut to that day. */
function Upcoming({
  days,
  selected,
  onSelect,
}: {
  days: PlanDay[];
  selected: string;
  onSelect: (date: string) => void;
}) {
  return (
    <section aria-labelledby="upcoming-heading" className="rounded-2xl border border-border bg-card p-3 sm:p-4">
      <h2 id="upcoming-heading" className="px-2 text-sm font-medium text-primary">
        Coming up
      </h2>

      <ul className="mt-1">
        {days.map((day) => {
          const date = parseDay(day.date);
          const isSelected = day.date === selected;
          return (
            <li key={day.date}>
              <button
                type="button"
                onClick={() => onSelect(day.date)}
                aria-pressed={isSelected}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/60",
                  isSelected && "bg-primary/5",
                )}
              >
                <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-muted leading-none">
                  <span className="text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground">
                    {date.toLocaleDateString("en-GB", { month: "short" })}
                  </span>
                  <span className="mt-0.5 font-display text-lg font-semibold tabular-nums">
                    {date.getDate()}
                  </span>
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{day.label || "Planned"}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {friendlyDay(day.date)}, {day.item_count} {day.item_count === 1 ? "item" : "items"}
                  </span>
                </span>

                {day.is_confirmed ? (
                  <Check className="size-4 shrink-0 text-primary" aria-hidden />
                ) : (
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
