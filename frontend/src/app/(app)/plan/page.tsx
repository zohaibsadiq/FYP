"use client";

import { useState } from "react";

import { DayPlan } from "@/components/planner/day-plan";
import { MonthGrid } from "@/components/planner/month-grid";
import { Button } from "@/components/ui/button";
import { usePlanMonth } from "@/hooks/use-planner";
import { addMonths, monthGrid, startOfMonth, todayIso } from "@/lib/dates";

export default function PlanPage() {
  const today = todayIso();
  const [month, setMonth] = useState(startOfMonth(today));
  const [selected, setSelected] = useState(today);

  // The grid draws the days either side of the month too, so the range asked
  // for covers them: a plan on 31 August should show in the September view.
  const grid = monthGrid(month);
  const { data: days } = usePlanMonth(grid[0].date, grid[grid.length - 1].date);

  function step(by: number) {
    setMonth(addMonths(month, by));
  }

  function jumpToToday() {
    setMonth(startOfMonth(today));
    setSelected(today);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Plan your days</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a day, choose what you will wear, and it is waiting for you when the day comes.
          </p>
        </div>

        <Button type="button" variant="outline" onClick={jumpToToday} className="h-11 px-5">
          Go to today
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <MonthGrid
          month={month}
          selected={selected}
          days={days ?? []}
          onSelect={(date) => {
            setSelected(date);
            setMonth(startOfMonth(date));
          }}
          onMonthChange={step}
        />

        <div className="rounded-2xl border border-border p-4 sm:p-5">
          <DayPlan date={selected} />
        </div>
      </div>
    </div>
  );
}
