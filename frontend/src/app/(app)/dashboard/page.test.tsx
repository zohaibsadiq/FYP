import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "./page";
import type { GarmentListItem, WardrobeStats } from "@/types/wardrobe";

let stats: WardrobeStats | undefined;
let items: Partial<GarmentListItem>[] = [];

vi.mock("@/hooks/use-auth", () => ({
  useCurrentUser: () => ({ data: { display_name: "Ayesha" }, isPending: false }),
}));
vi.mock("@/hooks/use-wardrobe", () => ({
  useWardrobeStats: () => ({ data: stats, isPending: false }),
  useGarments: () => ({ data: { count: items.length, results: items } }),
}));
// Numbers count up on the real page; here they are read at once.
vi.mock("@/hooks/use-count-up", () => ({ useCountUp: (value: number | undefined) => value ?? 0 }));
vi.mock("@/components/planner/weather-card", () => ({ WeatherCard: () => <p>weather</p> }));
vi.mock("@/components/wardrobe/recent-wears", () => ({ RecentWears: () => <p>recent wears</p> }));
vi.mock("@/components/wardrobe/forgotten-items", () => ({ ForgottenItems: () => <p>forgotten</p> }));
vi.mock("@/components/wardrobe/item-card", () => ({
  ItemCard: ({ item }: { item: GarmentListItem }) => <article>{item.name}</article>,
}));

function counts(over: Partial<WardrobeStats> = {}): WardrobeStats {
  return {
    total: 24,
    in_wardrobe: 20,
    in_laundry: 2,
    gone: 1,
    favorites: 3,
    unplaced: 4,
    never_worn: 5,
    total_spent: 90000,
    total_wears: 140,
    worn_this_week: 6,
    not_worn_in_90_days: 7,
    storage_locations: 8,
    by_slot: [
      { slot: "TOP", count: 12 },
      { slot: "BOTTOM", count: 7 },
      { slot: "FOOTWEAR", count: 5 },
    ],
    ...over,
  };
}

beforeEach(() => {
  stats = counts();
  items = [{ id: 1, name: "Navy Kurta" }, { id: 2, name: "Linen Shirt" }];
});

describe("DashboardPage", () => {
  it("greets the person by name", () => {
    render(<DashboardPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Ayesha/);
  });

  it("shows the four numbers and what the closet is made of", () => {
    render(<DashboardPage />);
    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getByText("Things you own")).toBeInTheDocument();
    expect(screen.getByText("In the wash")).toBeInTheDocument();
    expect(screen.getByText("Places you keep them")).toBeInTheDocument();
    expect(screen.getByText("Worn this week")).toBeInTheDocument();
    expect(screen.getByText("Tops")).toBeInTheDocument();
    expect(screen.getByText("Footwear")).toBeInTheDocument();
  });

  it("offers the three things people do most, right at the top", () => {
    render(<DashboardPage />);
    expect(screen.getByRole("link", { name: /add an item/i })).toHaveAttribute("href", "/closet/add");
    expect(screen.getByRole("link", { name: /plan today/i })).toHaveAttribute("href", "/plan");
    expect(screen.getByRole("link", { name: /try something on/i })).toHaveAttribute("href", "/try-on");
  });

  it("lists the newest things and the week's wearings", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Navy Kurta")).toBeInTheDocument();
    expect(screen.getByText("recent wears")).toBeInTheDocument();
    expect(screen.getByText("forgotten")).toBeInTheDocument();
  });

  it("walks a brand new closet through its first item instead of showing zeros", () => {
    stats = counts({ total: 0, by_slot: [] });
    items = [];
    render(<DashboardPage />);
    expect(screen.getByRole("link", { name: /add my first item/i })).toHaveAttribute("href", "/closet/add");
    expect(screen.queryByText("Things you own")).not.toBeInTheDocument();
    expect(screen.queryByText("recent wears")).not.toBeInTheDocument();
  });
});
