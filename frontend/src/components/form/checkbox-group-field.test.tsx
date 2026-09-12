import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CheckboxGroupField } from "./checkbox-group-field";

const CHOICES = [
  { value: "SUMMER", label: "Summer" },
  { value: "WINTER", label: "Winter" },
  { value: "SPRING", label: "Spring" },
];

function Harness({ initial = [] as string[] }) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <>
      <CheckboxGroupField
        legend="When can you wear it?"
        choices={CHOICES}
        value={value}
        onChange={setValue}
      />
      <output data-testid="picked">{value.join(",")}</output>
    </>
  );
}

const picked = () => screen.getByTestId("picked").textContent;

describe("CheckboxGroupField", () => {
  it("ticks the ones already chosen", () => {
    render(<Harness initial={["WINTER"]} />);

    expect(screen.getByRole("checkbox", { name: "Winter" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Summer" })).not.toBeChecked();
  });

  it("keeps more than one at a time, unlike a dropdown", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("checkbox", { name: "Summer" }));
    await user.click(screen.getByRole("checkbox", { name: "Spring" }));

    expect(picked()).toBe("SUMMER,SPRING");
  });

  it("unticks without touching the others", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["SUMMER", "WINTER"]} />);

    await user.click(screen.getByRole("checkbox", { name: "Summer" }));

    expect(picked()).toBe("WINTER");
  });

  it("can end up with nothing ticked", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["SUMMER"]} />);

    await user.click(screen.getByRole("checkbox", { name: "Summer" }));

    expect(picked()).toBe("");
  });

  it("names the group for a screen reader", () => {
    render(<Harness />);

    expect(screen.getByRole("group", { name: "When can you wear it?" })).toBeInTheDocument();
  });
});
