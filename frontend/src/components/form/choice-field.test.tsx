import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChoiceField, type Choice } from "./choice-field";

const PLACES: Choice[] = [
  { value: "8", label: "Bedroom > Wardrobe" },
  { value: "9", label: "Bedroom > Shoe rack" },
];

function Harness({
  initial = null,
  onChange,
  ...rest
}: {
  initial?: string | null;
  onChange?: (value: string | null) => void;
} & Partial<React.ComponentProps<typeof ChoiceField>>) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <ChoiceField
      id="place-parent"
      label="Is it inside another place?"
      choices={PLACES}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      {...rest}
    />
  );
}

function trigger() {
  return screen.getByRole("combobox", { name: /is it inside another place/i });
}

describe("ChoiceField", () => {
  it("shows the name of the chosen row, not the id that gets submitted", () => {
    render(<Harness initial="8" />);

    expect(trigger()).toHaveTextContent("Bedroom > Wardrobe");
    expect(trigger()).not.toHaveTextContent(/^8$/);
  });

  it("shows the clear row as the resting text while nothing is chosen", () => {
    render(<Harness clearLabel="No, it stands on its own" />);

    expect(trigger()).toHaveTextContent("No, it stands on its own");
  });

  it("shows the placeholder when the field has no clear row", () => {
    render(<Harness placeholder="Choose one" />);

    expect(trigger()).toHaveTextContent("Choose one");
  });

  it("takes an answer back when the clear row is picked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="8" clearLabel="No, it stands on its own" onChange={onChange} />);

    expect(trigger()).toHaveTextContent("Bedroom > Wardrobe");

    await user.click(trigger());
    await user.click(await screen.findByRole("option", { name: "No, it stands on its own" }));

    expect(onChange).toHaveBeenCalledWith(null);
    expect(trigger()).toHaveTextContent("No, it stands on its own");
  });

  it("switches from one row to another", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="8" onChange={onChange} />);

    await user.click(trigger());
    await user.click(await screen.findByRole("option", { name: "Bedroom > Shoe rack" }));

    expect(onChange).toHaveBeenCalledWith("9");
    expect(trigger()).toHaveTextContent("Bedroom > Shoe rack");
  });

  it("says so instead of opening an empty list when there is nothing to pick", async () => {
    const user = userEvent.setup();
    render(<Harness choices={[]} placeholder="Choose one" />);

    await user.click(trigger());

    const list = await screen.findByRole("listbox");
    expect(within(list).getByText("There is nothing to choose from yet")).toBeInTheDocument();
  });

  it("ties its error text to the field for a screen reader", () => {
    render(<Harness error="Please choose what kind of item this is." />);

    expect(trigger()).toHaveAccessibleDescription("Please choose what kind of item this is.");
    expect(trigger()).toHaveAttribute("aria-invalid", "true");
  });
});
