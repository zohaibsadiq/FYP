import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ItemPicker } from "./item-picker";
import type { GarmentListItem } from "@/types/wardrobe";

let results: GarmentListItem[] = [];
let pending = false;
let lastFilters: Record<string, unknown> = {};

vi.mock("@/hooks/use-wardrobe", () => ({
  useGarments: (filters: Record<string, unknown>) => {
    lastFilters = filters;
    return { data: { results, count: results.length }, isPending: pending };
  },
  useItemWears: () => ({ data: [], isPending: false, isError: false }),
}));

function item(id: number, name: string, overrides: Partial<GarmentListItem> = {}): GarmentListItem {
  return {
    id,
    name,
    display_image_url: "",
    wear_count: 0,
    last_worn_date: null,
    days_since_worn: null,
    last_worn_note: "",
    ...overrides,
  } as GarmentListItem;
}

function Harness({ max = 12, known = [] as GarmentListItem[], start = [] as number[] }) {
  const [chosen, setChosen] = useState<number[]>(start);
  return <ItemPicker chosen={chosen} onChange={setChosen} max={max} known={known} />;
}

beforeEach(() => {
  pending = false;
  lastFilters = {};
  results = [
    item(1, "Cream kurta", {
      wear_count: 4,
      last_worn_date: "2026-09-12",
      days_since_worn: 2,
      last_worn_note: "Ayesha's mehndi",
    }),
    item(2, "Black jeans", {
      wear_count: 9,
      last_worn_date: "2026-06-01",
      days_since_worn: 105,
    }),
    item(3, "New shirt"),
  ];
});

describe("ItemPicker", () => {
  it("only offers things that can actually be worn today", () => {
    render(<Harness />);
    expect(lastFilters.wearable).toBe(true);
  });

  it("says when each thing was last worn, before it is even tapped", () => {
    render(<Harness />);
    expect(
      screen.getByRole("button", { name: /Cream kurta\. Worn 2 days ago, for Ayesha's mehndi\./ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New shirt\. Not worn yet\./ })).toBeInTheDocument();
  });

  it("marks something worn in the last few days so it stands out in the grid", () => {
    render(<Harness />);
    expect(screen.getByText("2 days ago")).toBeInTheDocument();
    // 105 days is not a repeat risk, so it carries no marker.
    expect(screen.queryByText("4 months ago")).not.toBeInTheDocument();
  });

  it("shows what was picked, with the day and the occasion", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Cream kurta\./ }));

    const picked = screen.getByText("What you picked").closest("div");
    expect(within(picked as HTMLElement).getByText("Worn 2 days ago, for Ayesha's mehndi"))
      .toBeInTheDocument();
  });

  it("keeps what was picked visible after the grid is filtered away", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Cream kurta\./ }));

    results = [item(9, "Something else")];
    await userEvent.type(screen.getByLabelText(/find something/i), "else");

    expect(screen.getByText("What you picked")).toBeInTheDocument();
    expect(screen.getAllByText("Cream kurta").length).toBeGreaterThan(0);
  });

  it("shows the things already in a plan being edited, even when off screen", () => {
    const offScreen = item(77, "Wedding sherwani", {
      wear_count: 1,
      last_worn_date: "2026-01-01",
      days_since_worn: 256,
      last_worn_note: "Cousin's wedding",
    });
    render(<Harness known={[offScreen]} start={[77]} />);

    expect(screen.getByText("Wedding sherwani")).toBeInTheDocument();
    expect(screen.getByText(/for Cousin's wedding/)).toBeInTheDocument();
  });

  it("offers a way into the full history of one thing", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Cream kurta\./ }));
    expect(screen.getByRole("button", { name: /when did i wear it/i })).toBeInTheDocument();
  });

  it("takes something back out again", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Cream kurta\./ }));
    expect(screen.getByText("1 of 12 picked")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /take cream kurta out/i }));
    expect(screen.getByText("0 of 12 picked")).toBeInTheDocument();
  });

  it("stops at the limit and says why, rather than silently ignoring a tap", async () => {
    render(<Harness max={1} />);
    await userEvent.click(screen.getByRole("button", { name: /Cream kurta\./ }));

    expect(screen.getByText(/as many as one day can hold/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Black jeans\./ })).toBeDisabled();
  });

  it("lets something already picked be tapped again to remove it, even at the limit", async () => {
    render(<Harness max={1} />);
    await userEvent.click(screen.getByRole("button", { name: /Cream kurta\./ }));
    await userEvent.click(screen.getByRole("button", { name: /Cream kurta\./ }));
    expect(screen.getByText("0 of 1 picked")).toBeInTheDocument();
  });
});
