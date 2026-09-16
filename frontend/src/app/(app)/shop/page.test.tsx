import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ShopPage from "./page";
import type { Deal, DealFilters, FilterOptions, Freshness } from "@/types/shopping";

const fetchNextPage = vi.fn();
const seenFilters: DealFilters[] = [];

let dealsState: {
  results: Deal[];
  count: number;
  isPending: boolean;
  isError: boolean;
  hasNextPage: boolean;
};
let freshnessState: Freshness | undefined;
let optionsState: FilterOptions | undefined;

vi.mock("@/hooks/use-shopping", () => ({
  useDeals: (filters: DealFilters) => {
    seenFilters.push(filters);
    return {
      data: dealsState.isPending
        ? undefined
        : { pages: [{ results: dealsState.results, count: dealsState.count, next: null, previous: null }] },
      isPending: dealsState.isPending,
      isError: dealsState.isError,
      // Shaped the way axios really hands a server failure over, so the
      // page is tested against the message a person would actually see.
      error: dealsState.isError
        ? { isAxiosError: true, response: { status: 503, data: {} } }
        : null,
      fetchNextPage,
      hasNextPage: dealsState.hasNextPage,
      isFetchingNextPage: false,
    };
  },
  useFreshness: () => ({ data: freshnessState }),
  useFilterOptions: () => ({ data: optionsState }),
}));

function deal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: 1,
    title: "Mandarin Collar Shirt",
    url: "https://outfitters.com.pk/products/x",
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
    sizes: ["M"],
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

const OPTIONS: FilterOptions = {
  slots: [{ value: "TOP", label: "Tops", count: 1400 }],
  categories: [{ value: "2", label: "Shirt", count: 470 }],
  shops: [{ value: "outfitters", label: "Outfitters", count: 967 }],
  colors: [{ value: "Navy", label: "Navy", count: 51 }],
  sizes: [{ value: "M", label: "M", count: 792 }],
  price_floor: 119,
  price_ceiling: 144155,
  empty_slots: ["FOOTWEAR", "OUTERWEAR"],
};

const FRESHNESS: Freshness = {
  checked_at: "2026-09-15T06:00:00Z",
  is_stale: false,
  stale_after_hours: 24,
  summary: "Prices checked 2 hours ago.",
  shops_working: 8,
  shops_total: 8,
  deals_listed: 7411,
  deals_on_sale: 4325,
  shops: [],
};

function lastFilters(): DealFilters {
  return seenFilters[seenFilters.length - 1];
}

beforeEach(() => {
  fetchNextPage.mockReset();
  seenFilters.length = 0;
  dealsState = { results: [deal()], count: 4325, isPending: false, isError: false, hasNextPage: true };
  freshnessState = FRESHNESS;
  optionsState = OPTIONS;
});

describe("Sales page", () => {
  it("says how old the prices are before showing any of them", () => {
    render(<ShopPage />);
    expect(screen.getByText("Prices checked 2 hours ago.")).toBeInTheDocument();
  });

  it("makes plain that buying happens on the shop's own site", () => {
    render(<ShopPage />);
    expect(screen.getByText(/buy it on the shop's own site/i)).toBeInTheDocument();
  });

  it("starts on the reduced things, since that is what the page is for", () => {
    render(<ShopPage />);
    expect(lastFilters().on_sale).toBe(true);
    expect(lastFilters().ordering).toBe("-discount_percent");
  });

  it("counts what was found", () => {
    render(<ShopPage />);
    expect(screen.getByText("4,325 things found")).toBeInTheDocument();
  });

  it("lists what came back", () => {
    render(<ShopPage />);
    expect(screen.getByText("Mandarin Collar Shirt")).toBeInTheDocument();
  });

  it("waits for a pause in typing before searching", async () => {
    render(<ShopPage />);
    await userEvent.type(screen.getByLabelText(/search the sales/i), "kurta");

    // Nothing is sent mid-word.
    expect(lastFilters().search).toBeUndefined();
    await waitFor(() => expect(lastFilters().search).toBe("kurta"));
  });

  it("turns a quick choice into a real filter", async () => {
    render(<ShopPage />);
    await userEvent.click(screen.getByRole("button", { name: /only what i am missing/i }));
    expect(lastFilters().fills_gap).toBe(true);
  });

  it("marks a quick choice that is on, so it can be seen and undone", async () => {
    render(<ShopPage />);
    const chip = screen.getByRole("button", { name: /hide what i already own/i });
    expect(chip).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(chip);
    expect(lastFilters().hide_owned).toBe(false);
  });

  it("offers half price in one tap", async () => {
    render(<ShopPage />);
    await userEvent.click(screen.getByRole("button", { name: /half price or better/i }));
    expect(lastFilters().min_discount).toBe(50);
  });

  it("says how many filters are on and clears them all at once", async () => {
    render(<ShopPage />);
    await userEvent.click(screen.getByRole("button", { name: /only what i am missing/i }));
    await userEvent.click(screen.getByRole("button", { name: /in stock only/i }));

    const reset = screen.getAllByRole("button", { name: /clear 2 filters/i })[0];
    await userEvent.click(reset);

    expect(lastFilters().fills_gap).toBeUndefined();
    expect(lastFilters().in_stock).toBeUndefined();
    // The page's own starting point is not counted as a filter somebody set.
    expect(lastFilters().on_sale).toBe(true);
  });

  it("tells somebody which parts of their closet are empty", () => {
    render(<ShopPage />);
    expect(screen.getAllByText(/you own nothing for 2 parts of an outfit/i).length).toBeGreaterThan(0);
  });

  it("loads more rather than making somebody guess at page numbers", async () => {
    render(<ShopPage />);
    await userEvent.click(screen.getByRole("button", { name: /show more/i }));
    expect(fetchNextPage).toHaveBeenCalled();
  });

  it("says when the list has run out instead of leaving a dead button", () => {
    dealsState.hasNextPage = false;
    render(<ShopPage />);
    expect(screen.getByText(/that is everything that matched/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
  });

  it("offers a way out when nothing matched", async () => {
    dealsState = { ...dealsState, results: [], count: 0 };
    render(<ShopPage />);
    await userEvent.click(screen.getByRole("button", { name: /only what i am missing/i }));

    expect(screen.getByText(/nothing matched/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /clear the filters/i }));
    expect(lastFilters().fills_gap).toBeUndefined();
  });

  it("explains an empty database rather than showing an empty grid", () => {
    freshnessState = { ...FRESHNESS, deals_listed: 0 };
    render(<ShopPage />);
    expect(screen.getByText(/no prices have been loaded yet/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/search the sales/i)).not.toBeInTheDocument();
  });

  it("shows a failure as a sentence, not a blank page", () => {
    dealsState = { ...dealsState, isError: true };
    render(<ShopPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/i);
  });

  it("says it is working while the first answer is on its way", () => {
    dealsState = { ...dealsState, isPending: true };
    render(<ShopPage />);
    expect(screen.getByText("Looking...")).toBeInTheDocument();
  });

  it("keeps each result in a list, so a screen reader can count them", () => {
    render(<ShopPage />);
    const lists = screen.getAllByRole("list");
    const grid = lists.find((list) => within(list).queryByText("Mandarin Collar Shirt"));
    expect(grid).toBeDefined();
  });
});
