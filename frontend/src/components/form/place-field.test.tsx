import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PlaceField } from "./place-field";
import type { StorageLocation } from "@/types/wardrobe";

function place(id: number, name: string, fullPath: string, depth: number): StorageLocation {
  return {
    id,
    name,
    kind: "OTHER",
    kind_label: "Other",
    parent: null,
    full_path: fullPath,
    depth,
    notes: "",
    item_count: 0,
    created_at: "2026-01-01T00:00:00Z",
  };
}

const PLACES = [
  place(1, "Bedroom", "Bedroom", 0),
  place(2, "Wardrobe", "Bedroom > Wardrobe", 1),
  place(3, "Drawer 1", "Bedroom > Wardrobe > Drawer 1", 2),
  place(4, "Slot A", "Bedroom > Wardrobe > Drawer 1 > Slot A", 3),
];

function Harness({
  onCreate = vi.fn(),
  initial = null,
  ...rest
}: { onCreate?: (name: string) => void; initial?: string | null } & Partial<
  React.ComponentProps<typeof PlaceField>
>) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <PlaceField
      id="place-parent"
      label="Is it inside another place?"
      places={PLACES}
      value={value}
      onChange={setValue}
      onCreate={onCreate}
      {...rest}
    />
  );
}

const box = () => screen.getByRole("combobox", { name: /is it inside another place/i });
const openList = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: /show the list of places/i }));

describe("PlaceField", () => {
  it("shows the whole trail of the chosen place", () => {
    render(<Harness initial="3" />);

    expect(box()).toHaveValue("Bedroom > Wardrobe > Drawer 1");
  });

  it("greys out a place that has no room left inside it", async () => {
    const user = userEvent.setup();
    render(<Harness mustHoldAnother />);

    await openList(user);

    const full = await screen.findByRole("option", { name: /Slot A/ });
    expect(full).toHaveAttribute("data-disabled");
    expect(full).toHaveTextContent("full, nothing else fits inside");

    expect(await screen.findByRole("option", { name: /Drawer 1$/ })).not.toHaveAttribute(
      "data-disabled",
    );
  });

  it("offers every place when the field is for an item rather than a place", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await openList(user);

    expect(await screen.findByRole("option", { name: /Slot A/ })).not.toHaveAttribute(
      "data-disabled",
    );
  });

  it("offers to add a name that is not in the list yet", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<Harness onCreate={onCreate} />);

    await user.type(box(), "Drawer 2");
    await user.click(await screen.findByRole("option", { name: /Add "Drawer 2" as a new place/ }));

    expect(onCreate).toHaveBeenCalledWith("Drawer 2");
  });

  it("does not offer to add a name that is already there", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(box(), "Wardrobe");

    expect(await screen.findByRole("option", { name: "Bedroom > Wardrobe" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /as a new place/ })).not.toBeInTheDocument();
  });

  it("narrows the list as you type", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(box(), "Drawer 1");

    expect(await screen.findByRole("option", { name: /Drawer 1$/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Bedroom" })).not.toBeInTheDocument();
  });

  it("empties the field when the clear button is pressed", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2" />);

    expect(box()).toHaveValue("Bedroom > Wardrobe");

    await user.click(screen.getByRole("button", { name: /^clear /i }));

    expect(box()).toHaveValue("");
  });

  it("never offers a place as somewhere to put itself", async () => {
    const user = userEvent.setup();
    render(<Harness excludeId={2} />);

    await openList(user);

    expect(await screen.findByRole("option", { name: "Bedroom" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Bedroom > Wardrobe" })).not.toBeInTheDocument();
  });
});
