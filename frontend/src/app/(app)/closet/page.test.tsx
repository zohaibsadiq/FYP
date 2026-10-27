import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ClosetPage from "./page";
import type { GarmentListItem, WardrobeStats } from "@/types/wardrobe";

const seenFilters: Record<string, unknown>[] = [];

let owned: Partial<GarmentListItem>[] = [];
let gone: Partial<GarmentListItem>[] = [];
let stats: Partial<WardrobeStats> | undefined;
let placeholder = false;

vi.mock("@/hooks/use-wardrobe", () => ({
  useGarments: (filters: Record<string, unknown>) => {
    seenFilters.push(filters);
    const rows = filters.gone ? gone : owned;
    return {
      data: { count: rows.length, results: rows },
      isPending: false,
      isPlaceholderData: placeholder,
      isError: false,
      error: null,
    };
  },
  useWardrobeStats: () => ({ data: stats }),
  useMarkWorn: () => ({ mutate: vi.fn(), isPending: false }),
  useToggleLaundry: () => ({ mutate: vi.fn(), isPending: false }),
  useToggleFavorite: () => ({ mutate: vi.fn(), isPending: false }),
  useToggleArchived: () => ({ mutate: vi.fn(), isPending: false }),
}));

// The card has its own tests; here it only needs to be findable by name.
vi.mock("@/components/wardrobe/item-card", () => ({
  ItemCard: ({ item }: { item: GarmentListItem }) => <li>{item.name}</li>,
}));

function item(over: Partial<GarmentListItem> = {}): Partial<GarmentListItem> {
  return {
    id: 1,
    name: "Blue Shirt",
    status: "IN_WARDROBE",
    status_label: "In wardrobe",
    wear_count: 0,
    display_image_url: "",
    ...over,
  };
}

function counts(over: Partial<WardrobeStats> = {}): Partial<WardrobeStats> {
  return { total: 1, in_laundry: 0, gone: 0, ...over };
}

beforeEach(() => {
  seenFilters.length = 0;
  owned = [item()];
  gone = [];
  stats = counts();
  placeholder = false;
});

// Anchored, so it never also matches "See what is sold and put away" in the
// empty state. The header button carries the count in its name.
const goneButton = () => screen.queryByRole("button", { name: /^sold and put away/i });

describe("ClosetPage", () => {
  it("shows loading tiles instead of the last tab's clothes while a new tab loads", () => {
    placeholder = true;
    render(<ClosetPage />);
    expect(screen.queryByText("Blue Shirt")).not.toBeInTheDocument();
  });

  it("does not offer a way to sold things when nothing has been sold", () => {
    render(<ClosetPage />);
    expect(goneButton()).not.toBeInTheDocument();
  });

  it("offers it next to Add an item once something has left", () => {
    stats = counts({ total: 1, gone: 2 });
    gone = [item({ id: 9, name: "Winter Coat", status: "ARCHIVED", status_label: "Put away" })];
    render(<ClosetPage />);

    const button = goneButton();
    expect(button).toBeInTheDocument();
    expect(within(button as HTMLElement).getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add an item/i })).toBeInTheDocument();
  });

  it("shows the gone things when it is pressed, and the closet again when pressed twice", async () => {
    stats = counts({ total: 1, gone: 1 });
    gone = [item({ id: 9, name: "Winter Coat", status: "ARCHIVED", status_label: "Put away" })];
    render(<ClosetPage />);

    expect(screen.getByText("Blue Shirt")).toBeInTheDocument();

    await userEvent.click(goneButton() as HTMLElement);
    expect(screen.getByText("Winter Coat")).toBeInTheDocument();
    expect(screen.queryByText("Blue Shirt")).not.toBeInTheDocument();

    await userEvent.click(goneButton() as HTMLElement);
    expect(screen.getByText("Blue Shirt")).toBeInTheDocument();
  });

  it("asks the server only for gone things while that view is open", async () => {
    stats = counts({ total: 1, gone: 1 });
    render(<ClosetPage />);
    await userEvent.click(goneButton() as HTMLElement);
    expect(seenFilters.some((f) => f.gone === true)).toBe(true);
  });

  it("treats a brand new closet as a brand new closet", () => {
    owned = [];
    stats = counts({ total: 0, gone: 0 });
    render(<ClosetPage />);
    expect(screen.getByText(/your closet is empty/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add my first item/i })).toBeInTheDocument();
  });

  it("does not call it a new closet when everything in it was sold or put away", () => {
    owned = [];
    stats = counts({ total: 0, gone: 1 });
    gone = [item({ id: 9, name: "Winter Coat", status: "ARCHIVED", status_label: "Put away" })];
    render(<ClosetPage />);

    expect(screen.queryByText(/your closet is empty/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /add my first item/i })).not.toBeInTheDocument();
    expect(screen.getByText(/nothing in your closet right now/i)).toBeInTheDocument();
  });

  it("still lets that person reach what they sold", async () => {
    owned = [];
    stats = counts({ total: 0, gone: 1 });
    gone = [item({ id: 9, name: "Winter Coat", status: "ARCHIVED", status_label: "Put away" })];
    render(<ClosetPage />);

    expect(goneButton()).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /see what is sold and put away/i }));
    expect(screen.getByText("Winter Coat")).toBeInTheDocument();
  });

  it("goes back to the closet when the last put-away thing is brought back", async () => {
    stats = counts({ total: 1, gone: 1 });
    gone = [item({ id: 9, name: "Winter Coat", status: "ARCHIVED", status_label: "Put away" })];
    const { rerender } = render(<ClosetPage />);

    await userEvent.click(goneButton() as HTMLElement);
    expect(screen.getByText("Winter Coat")).toBeInTheDocument();

    // She brings it back, so there is nothing gone left and the button goes.
    owned = [item(), item({ id: 9, name: "Winter Coat" })];
    gone = [];
    stats = counts({ total: 2, gone: 0 });
    rerender(<ClosetPage />);

    expect(screen.queryByText(/nothing has left your closet/i)).not.toBeInTheDocument();
    expect(screen.getByText("Winter Coat")).toBeInTheDocument();
    expect(screen.getByText("Blue Shirt")).toBeInTheDocument();
    expect(goneButton()).not.toBeInTheDocument();
  });

  it("always offers a way back out of the sold and put-away list", async () => {
    // An empty closet hides the row of sorts, so this is the only way back.
    owned = [];
    stats = counts({ total: 0, gone: 1 });
    gone = [item({ id: 9, name: "Winter Coat", status: "ARCHIVED", status_label: "Put away" })];
    render(<ClosetPage />);

    await userEvent.click(goneButton() as HTMLElement);
    expect(screen.getByText("Winter Coat")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /back to my clothes/i }));
    expect(screen.queryByText("Winter Coat")).not.toBeInTheDocument();
    expect(screen.getByText(/nothing in your closet right now/i)).toBeInTheDocument();
  });

  it("hides the row of sorts when there is nothing to sort", () => {
    owned = [];
    stats = counts({ total: 0, gone: 1 });
    render(<ClosetPage />);
    expect(screen.queryByRole("button", { name: "Tops" })).not.toBeInTheDocument();
  });

  it("counts only what is owned in the line under the heading", () => {
    stats = counts({ total: 4, in_laundry: 1, gone: 7 });
    render(<ClosetPage />);
    expect(screen.getByText("4 items, 1 in the wash")).toBeInTheDocument();
  });
});
