import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RecentWears, lastSevenDays } from "./recent-wears";
import { addDays, todayIso } from "@/lib/dates";
import type { WearEvent } from "@/types/wardrobe";

let events: WearEvent[] = [];

vi.mock("@/hooks/use-wardrobe", () => ({
  useRecentWears: () => ({ data: events, isPending: false, isError: false }),
}));

function wear(over: Partial<WearEvent>): WearEvent {
  return {
    id: 1,
    item: 7,
    item_name: "Navy Kurta",
    item_image_url: "",
    item_slot: "TOP",
    worn_on: todayIso(),
    note: "",
    days_ago: 0,
    created_at: "2026-10-27T08:00:00Z",
    ...over,
  };
}

beforeEach(() => {
  events = [];
});

describe("lastSevenDays", () => {
  it("always gives seven days ending today, oldest first", () => {
    const days = lastSevenDays([], "2026-10-27");
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe("2026-10-21");
    expect(days[6].date).toBe("2026-10-27");
  });

  it("puts each wearing on its own day", () => {
    const days = lastSevenDays([wear({ worn_on: "2026-10-27" }), wear({ id: 2, worn_on: "2026-10-25" })], "2026-10-27");
    expect(days[6].worn).toHaveLength(1);
    expect(days[4].worn).toHaveLength(1);
    expect(days[5].worn).toHaveLength(0);
  });
});

describe("RecentWears", () => {
  it("marks today and links each thing worn to its page", () => {
    events = [wear({}), wear({ id: 2, item: 9, item_name: "Black Trousers", worn_on: addDays(todayIso(), -1) })];
    render(<RecentWears />);

    expect(screen.getAllByText("Today").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Navy Kurta" })).toHaveAttribute("href", "/closet/7");
    expect(screen.getByRole("link", { name: "Black Trousers" })).toHaveAttribute("href", "/closet/9");
    expect(screen.getByText("2 wearings in the last 7 days.")).toBeInTheDocument();
  });

  it("says how to start when the week is empty", () => {
    render(<RecentWears />);
    expect(screen.getByText("Nothing recorded in the last 7 days.")).toBeInTheDocument();
    expect(screen.getByText(/I wore this today/)).toBeInTheDocument();
  });

  it("keeps a busy day readable with a count instead of a pile of pictures", () => {
    events = [1, 2, 3, 4, 5].map((n) => wear({ id: n, item: n, item_name: `Thing ${n}` }));
    render(<RecentWears />);
    expect(screen.getByText("+2")).toBeInTheDocument();
  });
});
