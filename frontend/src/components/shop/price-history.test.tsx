import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PriceHistory } from "./price-history";
import type { PriceChange } from "@/types/shopping";

const askedFor: (number | null)[] = [];
let rows: PriceChange[] = [];
let pending = false;

vi.mock("@/hooks/use-shopping", () => ({
  usePriceHistory: (id: number | null) => {
    askedFor.push(id);
    return { data: id === null || pending ? undefined : rows, isPending: id !== null && pending };
  },
}));

beforeEach(() => {
  askedFor.length = 0;
  pending = false;
  rows = [
    { price: "2690.00", was_price: "5490.00", noticed_at: "2026-09-14T06:00:00Z" },
    { price: "3990.00", was_price: null, noticed_at: "2026-09-01T06:00:00Z" },
  ];
});

describe("PriceHistory", () => {
  it("asks for nothing until it is opened", () => {
    render(<PriceHistory dealId={4} currency="PKR" />);
    expect(askedFor).toEqual([null]);
  });

  it("fetches only once somebody wants to see it", async () => {
    render(<PriceHistory dealId={4} currency="PKR" />);
    await userEvent.click(screen.getByRole("button", { name: /price history/i }));
    expect(askedFor).toContain(4);
  });

  it("lists every price it has been seen at", async () => {
    render(<PriceHistory dealId={4} currency="PKR" />);
    await userEvent.click(screen.getByRole("button", { name: /price history/i }));
    expect(screen.getByText("Rs 2,690")).toBeInTheDocument();
    expect(screen.getByText("Rs 3,990")).toBeInTheDocument();
  });

  it("says plainly when a price has never moved", async () => {
    rows = [];
    render(<PriceHistory dealId={4} currency="PKR" />);
    await userEvent.click(screen.getByRole("button", { name: /price history/i }));
    expect(screen.getByText(/has not changed since we started watching/i)).toBeInTheDocument();
  });

  it("says it is working while the answer is on its way", async () => {
    pending = true;
    render(<PriceHistory dealId={4} currency="PKR" />);
    await userEvent.click(screen.getByRole("button", { name: /price history/i }));
    expect(screen.getByText("Looking...")).toBeInTheDocument();
  });

  it("can be closed again", async () => {
    render(<PriceHistory dealId={4} currency="PKR" />);
    const toggle = screen.getByRole("button", { name: /price history/i });

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Rs 2,690")).not.toBeInTheDocument();
  });
});
