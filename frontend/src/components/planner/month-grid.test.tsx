import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MonthGrid } from "./month-grid";
import { addDays, todayIso } from "@/lib/dates";
import type { PlanDay } from "@/types/planner";

function day(date: string, overrides: Partial<PlanDay> = {}): PlanDay {
  return { date, label: "", item_count: 2, is_confirmed: false, ...overrides };
}

function show(props: Partial<React.ComponentProps<typeof MonthGrid>> = {}) {
  const onSelect = vi.fn();
  const onMonthChange = vi.fn();
  render(
    <MonthGrid
      month="2026-09-01"
      selected="2026-09-14"
      days={[]}
      onSelect={onSelect}
      onMonthChange={onMonthChange}
      {...props}
    />,
  );
  return { onSelect, onMonthChange };
}

describe("MonthGrid", () => {
  it("names the month being shown", () => {
    show();
    expect(screen.getByText("September 2026")).toBeInTheDocument();
  });

  it("draws six full rows, plus the two buttons that change the month", () => {
    show();
    expect(screen.getAllByRole("button")).toHaveLength(42 + 2);
  });

  it("hands back the day that was tapped", async () => {
    const { onSelect } = show();
    await userEvent.click(screen.getByRole("button", { name: "15, nothing planned" }));
    expect(onSelect).toHaveBeenCalledWith("2026-09-15");
  });

  it("steps a month back and forward", async () => {
    const { onMonthChange } = show();
    await userEvent.click(screen.getByRole("button", { name: /month before/i }));
    expect(onMonthChange).toHaveBeenCalledWith(-1);

    await userEvent.click(screen.getByRole("button", { name: /month after/i }));
    expect(onMonthChange).toHaveBeenCalledWith(1);
  });

  it("says out loud what is planned on a day, not just a coloured dot", () => {
    show({ days: [day("2026-09-10", { label: "Mehndi", item_count: 3 })] });
    expect(
      screen.getByRole("button", { name: "10 Mehndi, 3 items" }),
    ).toBeInTheDocument();
  });

  it("marks a day already worn differently from one still to come", () => {
    show({ days: [day("2026-09-10", { label: "Office", is_confirmed: true })] });
    expect(
      screen.getByRole("button", { name: /already worn/i }),
    ).toBeInTheDocument();
  });

  it("uses the singular for a day with one thing in it", () => {
    show({ days: [day("2026-09-10", { item_count: 1 })] });
    expect(screen.getByRole("button", { name: "10 Planned, 1 item" })).toBeInTheDocument();
  });

  it("marks today so it can be found at a glance", () => {
    const today = todayIso();
    render(
      <MonthGrid
        month={today}
        selected={addDays(today, 3)}
        days={[]}
        onSelect={vi.fn()}
        onMonthChange={vi.fn()}
      />,
    );
    const marked = screen.getAllByRole("button").filter(
      (button) => button.getAttribute("aria-current") === "date",
    );
    expect(marked).toHaveLength(1);
  });

  it("shows exactly one day as chosen", () => {
    show();
    const pressed = screen
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
  });

  it("spells out what the marks mean instead of leaving them to be guessed", () => {
    show();
    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(screen.getByText("Already worn")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
  });
});
