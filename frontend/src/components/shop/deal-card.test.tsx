import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DealCard } from "./deal-card";
import type { Deal } from "@/types/shopping";

function deal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: 1,
    title: "Mandarin Collar Shirt",
    url: "https://outfitters.com.pk/products/mandarin-collar-shirt",
    image_url: "",
    vendor: "Outfitters",
    shop_name: "Outfitters",
    shop_slug: "outfitters",
    currency: "PKR",
    shop_category: "SHIRTS/BLOUSES",
    category: 2,
    category_name: "Shirt",
    slot: "TOP",
    slot_label: "Top",
    color_name: "Navy",
    color_hex: "#1b2f55",
    price: "1490.00",
    was_price: "5990.00",
    discount_percent: 75,
    saving: "4500.00",
    sizes: ["S", "M", "L"],
    in_stock: true,
    checked_at: "2026-09-15T08:00:00Z",
    price_fell_at: null,
    just_dropped: false,
    fills_gap: false,
    already_owned: false,
    owned_count: 0,
    owned_item_id: null,
    closet_note: "",
    ...overrides,
  };
}

describe("DealCard", () => {
  it("shows the new price and the one it was cut from", () => {
    render(<DealCard deal={deal()} />);
    expect(screen.getByText("Rs 1,490")).toBeInTheDocument();
    expect(screen.getByText("Rs 5,990")).toBeInTheDocument();
  });

  it("says how much is saved in money, not only in percent", () => {
    render(<DealCard deal={deal()} />);
    expect(screen.getByText("75% off")).toBeInTheDocument();
    expect(screen.getByText("Rs 4,500 off")).toBeInTheDocument();
  });

  it("links straight to the shop's own page for the item", () => {
    render(<DealCard deal={deal()} />);
    const link = screen.getByRole("link", { name: /buy at outfitters/i });
    expect(link).toHaveAttribute("href", "https://outfitters.com.pk/products/mandarin-collar-shirt");
  });

  it("opens the shop safely in a new tab and says so", () => {
    render(<DealCard deal={deal()} />);
    const link = screen.getByRole("link", { name: /buy at outfitters/i });
    expect(link).toHaveAttribute("target", "_blank");
    // Without noopener the shop's page can reach back into this one.
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveTextContent(/opens the shop in a new tab/i);
  });

  it("names the shop, so nobody thinks the app is selling it", () => {
    render(<DealCard deal={deal()} />);
    expect(screen.getAllByText(/outfitters/i).length).toBeGreaterThan(0);
  });

  it("shows no old price when the shop is not calling it a sale", () => {
    render(<DealCard deal={deal({ was_price: null, discount_percent: 0, saving: null })} />);
    expect(screen.getByText("Rs 1,490")).toBeInTheDocument();
    expect(screen.queryByText(/% off/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ off$/)).not.toBeInTheDocument();
  });

  it("lists the sizes still in stock where a reader can get at them", () => {
    render(<DealCard deal={deal()} />);
    expect(screen.getByLabelText(/sizes in stock: s, m, l/i)).toBeInTheDocument();
  });

  it("does not run a long size list off the card", () => {
    const many = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
    render(<DealCard deal={deal({ sizes: many })} />);
    expect(screen.getByText("+2 more")).toBeInTheDocument();
    // The full list is still readable, just not printed in full.
    expect(screen.getByLabelText(/xs, s, m, l, xl, xxl, 3xl/i)).toBeInTheDocument();
  });

  it("marks something that cannot be bought today", () => {
    render(<DealCard deal={deal({ in_stock: false })} />);
    expect(screen.getByText("Sold out")).toBeInTheDocument();
  });

  it("flags a price that has just come down", () => {
    render(<DealCard deal={deal({ just_dropped: true })} />);
    expect(screen.getByText(/price just dropped/i)).toBeInTheDocument();
  });

  it("points out something the closet has nothing for", () => {
    render(
      <DealCard
        deal={deal({ fills_gap: true, closet_note: "You have nothing in your closet for this." })}
      />,
    );
    expect(screen.getByText(/nothing in your closet for this/i)).toBeInTheDocument();
  });

  it("warns when something close is already owned, and links to it", () => {
    render(
      <DealCard
        deal={deal({
          already_owned: true,
          owned_count: 2,
          owned_item_id: 7,
          closet_note: "You already own 2 in this colour, including Navy shirt.",
        })}
      />,
    );
    expect(screen.getByText(/already own 2 in this colour/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see it/i })).toHaveAttribute("href", "/closet/7");
  });

  it("says nothing about the closet when nothing was worked out", () => {
    render(<DealCard deal={deal()} />);
    expect(screen.queryByText(/already own/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nothing in your closet/i)).not.toBeInTheDocument();
  });

  it("shows what kind of thing it is and its colour", () => {
    render(<DealCard deal={deal()} />);
    expect(screen.getByText("Shirt - Navy")).toBeInTheDocument();
  });

  it("falls back to where it is worn when the exact kind is unknown", () => {
    render(<DealCard deal={deal({ category_name: "", color_name: "" })} />);
    expect(screen.getByText("Top")).toBeInTheDocument();
  });

  it("keeps the shop's own title rather than rewording it", () => {
    const article = screen.queryByRole("article");
    expect(article).toBeNull();
    render(<DealCard deal={deal({ title: "2 PIECE PRINTED LAWN SUIT (PRET)" })} />);
    const card = screen.getByRole("article");
    expect(within(card).getByText("2 PIECE PRINTED LAWN SUIT (PRET)")).toBeInTheDocument();
  });
});
