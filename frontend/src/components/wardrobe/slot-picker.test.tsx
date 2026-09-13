import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SlotPicker } from "./slot-picker";
import type { Category, Slot } from "@/types/wardrobe";

function cat(id: number, name: string, slot: Slot): Category {
  return {
    id,
    name,
    slot,
    slot_label: slot,
    icon: "",
    sort_order: id,
    is_system: true,
    item_count: 0,
  };
}

const CATEGORIES = [
  cat(1, "T-Shirt", "TOP"),
  cat(2, "Shirt", "TOP"),
  cat(3, "Polo", "TOP"),
  cat(4, "Kurta", "TOP"),
  cat(5, "Jeans", "BOTTOM"),
  cat(6, "Sneakers", "FOOTWEAR"),
];

function Harness() {
  const [slot, setSlot] = useState<Slot | null>(null);
  return (
    <>
      <SlotPicker categories={CATEGORIES} value={slot} onChange={setSlot} />
      <output data-testid="chosen">{slot ?? ""}</output>
    </>
  );
}

describe("SlotPicker", () => {
  it("offers only the sorts that actually have kinds behind them", () => {
    render(<Harness />);

    expect(screen.getByRole("button", { name: /Tops/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bottoms/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Footwear/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Headwear/ })).not.toBeInTheDocument();
  });

  it("shows real examples under each sort so the words are not needed", () => {
    render(<Harness />);

    expect(screen.getByText("T-Shirt, Shirt, Polo")).toBeInTheDocument();
  });

  it("keeps the examples short rather than listing every kind", () => {
    render(<Harness />);

    expect(screen.queryByText(/Kurta/)).not.toBeInTheDocument();
  });

  it("reports which sort was tapped", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /Footwear/ }));

    expect(screen.getByTestId("chosen")).toHaveTextContent("FOOTWEAR");
    expect(screen.getByRole("button", { name: /Footwear/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("marks only one as chosen at a time", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /Footwear/ }));
    await user.click(screen.getByRole("button", { name: /Tops/ }));

    expect(screen.getByRole("button", { name: /Tops/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Footwear/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
