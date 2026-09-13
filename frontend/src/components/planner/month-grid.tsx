"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { monthGrid, monthLabel, parseDay, todayIso, WEEKDAY_INITIALS } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { PlanDay } from "@/types/planner";

export function MonthGrid({
  month,
  selected,
  days,
  onSelect,
  onMonthChange,
}: {
  /** Any day inside the month being shown. */
  month: string;
  selected: string;
  days: PlanDay[];
  onSelect: (date: string) => void;
  onMonthChange: (step: number) => void;
}) {
  const today = todayIso();
  const planned = new Map(days.map((day) => [day.date, day]));

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onMonthChange(-1)}
          className="size-11"
        >
          <ChevronLeft className="size-5" aria-hidden />
          <span className="sr-only">Go to the month before</span>
        </Button>

        <h2 aria-live="polite" className="text-lg font-semibold">
          {monthLabel(month)}
        </h2>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onMonthChange(1)}
          className="size-11"
        >
          <ChevronRight className="size-5" aria-hidden />
          <span className="sr-only">Go to the month after</span>
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAY_INITIALS.map((name) => (
          <abbr key={name} title={name} className="py-1 no-underline">
            {name.slice(0, 1)}
          </abbr>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {monthGrid(month).map(({ date, inMonth }) => {
          const plan = planned.get(date);
          const isToday = date === today;
          const isSelected = date === selected;
          const number = parseDay(date).getDate();

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              aria-current={isToday ? "date" : undefined}
              aria-pressed={isSelected}
              // Spelled out rather than left to the number plus a coloured
              // dot, which a screen reader would read as one run-on word.
              aria-label={
                plan
                  ? `${number} ${plan.label || "Planned"}, ${plan.item_count} ${
                      plan.item_count === 1 ? "item" : "items"
                    }${plan.is_confirmed ? ", already worn" : ""}`
                  : `${number}, nothing planned`
              }
              className={cn(
                "relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-lg text-sm transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                inMonth ? "text-foreground" : "text-muted-foreground/40",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent",
                isToday && !isSelected && "ring-1 ring-primary",
              )}
            >
              <span className={cn("tabular-nums", plan && "font-semibold")}>{number}</span>

              {plan ? (
                <span
                  className={cn(
                    "mt-0.5 flex items-center gap-0.5",
                    isSelected ? "text-primary-foreground" : "text-primary",
                  )}
                >
                  {plan.is_confirmed ? (
                    <Check className="size-3" aria-hidden />
                  ) : (
                    <span className="size-1.5 rounded-full bg-current" aria-hidden />
                  )}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
          Planned
        </span>
        <span className="flex items-center gap-1.5">
          <Check className="size-3 text-primary" aria-hidden />
          Already worn
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded ring-1 ring-primary" aria-hidden />
          Today
        </span>
      </p>
    </div>
  );
}
