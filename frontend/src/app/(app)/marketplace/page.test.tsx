import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MarketplacePage from "./page";
import type { Listing } from "@/types/market";

let listings: Listing[] = [];
let placeholder = false;

vi.mock("@/hooks/use-auth", () => ({
  useCurrentUser: () => ({ data: { shopping_for: "EVERYTHING" } }),
}));
vi.mock("@/hooks/use-market", () => ({
  useListings: () => ({
    data: { pages: [{ results: listings, count: listings.length, next: null, previous: null }] },
    isPending: false,
    isPlaceholderData: placeholder,
    isError: false,
    error: null,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
  useMarketStats: () => ({ data: undefined }),
}));
// The dialogs and the card have their own tests; here the card only needs to be findable by name.
vi.mock("@/components/market/sell-dialog", () => ({ SellDialog: () => null }));
vi.mock("@/components/market/enquiry-dialog", () => ({ EnquiryDialog: () => null }));
vi.mock("@/components/market/report-dialog", () => ({ ReportDialog: () => null }));
vi.mock("@/components/market/listing-card", () => ({
  ListingCard: ({ listing }: { listing: Listing }) => <article>{listing.item.name}</article>,
}));

function listing(): Listing {
  return {
    id: 31,
    item: {
      name: "Black Trousers",
      brand: "Outfitters",
      size: "32",
      material: "",
      pattern: "SOLID",
      pattern_label: "One plain colour",
      category_name: "Trousers",
      category_slot: "BOTTOM",
      display_image_url: "",
      primary_color_hex: "",
      primary_color_name: "",
    },
    seller: { id: 2, display_name: "Ali", city: "Lahore" },
    asking_price: "1200.00",
    currency: "PKR",
    condition: "GOOD",
    condition_label: "Good, worn a few times",
    audience: "MEN",
    audience_label: "Men",
    note: "",
    city: "Lahore",
    status: "ACTIVE",
    status_label: "For sale",
    created_at: "2026-10-20T08:00:00Z",
    my_enquiry_status: "",
  };
}

beforeEach(() => {
  listings = [listing()];
  placeholder = false;
});

describe("Buy and Sell page", () => {
  it("lists what is for sale", () => {
    render(<MarketplacePage />);
    expect(screen.getByText("Black Trousers")).toBeInTheDocument();
    expect(screen.getByText("1 thing for sale")).toBeInTheDocument();
  });

  it("shows loading tiles, not the last tab's listings, while a new tab loads", () => {
    placeholder = true;
    render(<MarketplacePage />);
    expect(screen.queryByText("Black Trousers")).not.toBeInTheDocument();
    expect(screen.getByText("Looking...")).toBeInTheDocument();
  });
});
