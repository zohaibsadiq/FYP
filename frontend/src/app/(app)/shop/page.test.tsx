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

let shoppingFor = "EVERYTHING";

vi.mock("@/hooks/use-auth", () => ({
  useCurrentUser: () => ({ data: { shopping_for: shoppingFor } }),
}));

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
    audience: "MEN",
    audience_label: "Men",
    price: "1490.00",
    was_price: "5990.00",
    discount_percent: 75,
    saving: "4500.00",
    sizes: ["M"],
    in_stock: true,
    checked_at: "2026-09-15T08:00:00Z",
    price_fell_at: null,
    just_dropped: false,
    ...overrides,
  };
}

const OPTIONS: FilterOptions = {
  audiences: [
    { value: "WOMEN", label: "Women", count: 4815 },
    { value: "MEN", label: "Men", count: 1335 },
    { value: "KIDS", label: "Kids", count: 1053 },
  ],
  slots: [{ value: "TOP", label: "Tops", count: 1400 }],
  categories: [{ value: "2", label: "Shirt", count: 470 }],
  shops: [{ value: "outfitters", label: "Outfitters", count: 967 }],
  colors: [{ value: "Navy", label: "Navy", count: 51 }],
  sizes: [{ value: "M", label: "M", count: 792 }],
  price_floor: 119,
  price_ceiling: 144155,
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
  shoppingFor = "EVERYTHING";
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
    await userEvent.click(screen.getByRole("button", { name: /in stock only/i }));
    expect(lastFilters().in_stock).toBe(true);
  });

  it("marks a quick choice that is on, so it can be seen and undone", async () => {
    render(<ShopPage />);
    const chip = screen.getByRole("button", { name: /in stock only/i });
    expect(chip).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(chip);
    expect(lastFilters().in_stock).toBe(false);
  });

  it("never offers to match against the closet", () => {
    render(<ShopPage />);
    expect(screen.queryByText(/what i am missing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/already own/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/match to my closet/i)).not.toBeInTheDocument();
  });

  it("offers half price in one tap", async () => {
    render(<ShopPage />);
    await userEvent.click(screen.getByRole("button", { name: /half price or better/i }));
    expect(lastFilters().min_discount).toBe(50);
  });

  it("says how many filters are on and clears them all at once", async () => {
    render(<ShopPage />);
    await userEvent.click(screen.getByRole("button", { name: /half price or better/i }));
    await userEvent.click(screen.getByRole("button", { name: /in stock only/i }));

    const reset = screen.getAllByRole("button", { name: /clear 2 filters/i })[0];
    await userEvent.click(reset);

    expect(lastFilters().min_discount).toBeUndefined();
    expect(lastFilters().in_stock).toBeUndefined();
    // The page's own starting point is not counted as a filter somebody set.
    expect(lastFilters().on_sale).toBe(true);
  });

  it("starts on everyone, so nothing is hidden before a choice is made", () => {
    render(<ShopPage />);
    expect(lastFilters().audience).toBeUndefined();
    expect(screen.getByRole("tab", { name: /everyone/i })).toHaveAttribute("aria-selected", "true");
  });

  it("opens on whatever the person usually shops for", () => {
    shoppingFor = "MEN";
    render(<ShopPage />);
    expect(lastFilters().audience).toBe("MEN");
    expect(screen.getByRole("tab", { name: /^men/i })).toHaveAttribute("aria-selected", "true");
  });

  it("opens on everything for somebody who did not pick a side", () => {
    shoppingFor = "EVERYTHING";
    render(<ShopPage />);
    expect(lastFilters().audience).toBeUndefined();
  });

  it("lets the preference be overridden, and keeps the override", async () => {
    shoppingFor = "WOMEN";
    render(<ShopPage />);
    expect(lastFilters().audience).toBe("WOMEN");

    await userEvent.click(screen.getByRole("tab", { name: /everyone/i }));
    expect(lastFilters().audience).toBeUndefined();
    expect(screen.getByRole("tab", { name: /everyone/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("narrows to one audience when a tab is tapped", async () => {
    render(<ShopPage />);
    await userEvent.click(screen.getByRole("tab", { name: /women/i }));
    expect(lastFilters().audience).toBe("WOMEN");
  });

  it("drops the narrower filters when the audience changes", async () => {
    // A size that exists in menswear may not exist in the kids range, and a
    // page that goes empty on a tap looks broken.
    render(<ShopPage />);
    await userEvent.click(screen.getByRole("button", { name: /half price or better/i }));
    expect(lastFilters().min_discount).toBe(50);

    await userEvent.click(screen.getByRole("tab", { name: /kids/i }));
    expect(lastFilters().audience).toBe("KIDS");
    expect(lastFilters().min_discount).toBeUndefined();
  });

  it("keeps what was typed when the audience changes", async () => {
    render(<ShopPage />);
    await userEvent.type(screen.getByLabelText(/search the sales/i), "kurta");
    await waitFor(() => expect(lastFilters().search).toBe("kurta"));

    await userEvent.click(screen.getByRole("tab", { name: /^men/i }));
    expect(lastFilters().search).toBe("kurta");
    expect(lastFilters().audience).toBe("MEN");
  });

  it("does not count the chosen audience as a filter to clear", async () => {
    render(<ShopPage />);
    await userEvent.click(screen.getByRole("tab", { name: /women/i }));
    expect(screen.getAllByRole("button", { name: /no filters are on/i }).length).toBeGreaterThan(0);
  });

  it("keeps the audience when the filters are cleared", async () => {
    render(<ShopPage />);
    await userEvent.click(screen.getByRole("tab", { name: /^men/i }));
    await userEvent.click(screen.getByRole("button", { name: /in stock only/i }));

    await userEvent.click(screen.getAllByRole("button", { name: /clear 1 filter/i })[0]);
    expect(lastFilters().in_stock).toBeUndefined();
    expect(lastFilters().audience).toBe("MEN");
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
    await userEvent.click(screen.getByRole("button", { name: /in stock only/i }));

    expect(screen.getByText(/nothing matched/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /clear the filters/i }));
    expect(lastFilters().in_stock).toBeUndefined();
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
