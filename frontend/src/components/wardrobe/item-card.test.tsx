import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ItemCard } from "./item-card";
import type { GarmentListItem } from "@/types/wardrobe";

function item(over: Partial<GarmentListItem> = {}): GarmentListItem {
  return {
    id: 1,
    name: "Blue Shirt",
    brand: "Khaadi",
    category: 2,
    category_name: "Shirt",
    category_slot: "TOP",
    display_image_url: "",
    primary_color_hex: "#33568a",
    primary_color_name: "Blue",
    status: "IN_WARDROBE",
    status_label: "In wardrobe",
    is_favorite: false,
    storage_location: null,
    location_path: "",
    wear_count: 0,
    last_worn_date: null,
    days_since_worn: null,
    last_worn_note: "",
    purchase_price: null,
    currency: "PKR",
    cost_per_wear: null,
    created_at: "2026-09-18T08:00:00Z",
    ...over,
  };
}

describe("ItemCard", () => {
  it("offers the two things people do every day", () => {
    render(<ItemCard item={item()} onWear={vi.fn()} onToggleLaundry={vi.fn()} />);
    expect(screen.getByRole("button", { name: /i wore this/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /to the wash/i })).toBeInTheDocument();
  });

  it("does not clutter the card with putting away, which is rare", () => {
    render(<ItemCard item={item()} onWear={vi.fn()} onToggleLaundry={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /put it away/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /bring it back/i })).not.toBeInTheDocument();
  });

  it("opens the item when the card is followed", () => {
    render(<ItemCard item={item()} />);
    expect(screen.getByRole("link", { name: /blue shirt/i })).toHaveAttribute("href", "/closet/1");
  });

  it("will not let something already in the wash be worn", () => {
    render(
      <ItemCard
        item={item({ status: "IN_LAUNDRY", status_label: "In the wash" })}
        onWear={vi.fn()}
        onToggleLaundry={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /i wore this/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /it is clean/i })).toBeInTheDocument();
  });

  it("passes the item on when a button is pressed", async () => {
    const onWear = vi.fn();
    render(<ItemCard item={item()} onWear={onWear} />);
    await userEvent.click(screen.getByRole("button", { name: /i wore this/i }));
    expect(onWear).toHaveBeenCalledWith(1);
  });

  it("shows no button row at all when nothing is wired up", () => {
    render(<ItemCard item={item()} />);
    expect(screen.queryByRole("button", { name: /i wore this/i })).not.toBeInTheDocument();
  });
});
