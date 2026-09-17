import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AudienceTabs } from "./audience-tabs";
import type { Facet } from "@/types/shopping";

const onChange = vi.fn();

const COUNTS: Facet[] = [
  { value: "WOMEN", label: "Women", count: 4815 },
  { value: "MEN", label: "Men", count: 1335 },
  { value: "KIDS", label: "Kids", count: 1053 },
];

beforeEach(() => onChange.mockReset());

describe("AudienceTabs", () => {
  it("offers everyone, women, men and kids", () => {
    render(<AudienceTabs value="" counts={COUNTS} total={7400} onChange={onChange} />);
    // Anchored, because "Men" is inside "Women" and would match both.
    for (const name of ["Everyone", "Women", "Men", "Kids"]) {
      expect(screen.getByRole("tab", { name: new RegExp("^" + name, "i") })).toBeInTheDocument();
    }
  });

  it("starts on everyone, so nothing is hidden before anybody chooses", () => {
    render(<AudienceTabs value="" counts={COUNTS} total={7400} onChange={onChange} />);
    expect(screen.getByRole("tab", { name: /everyone/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /women/i })).toHaveAttribute("aria-selected", "false");
  });

  it("says how many are behind each tab", () => {
    render(<AudienceTabs value="" counts={COUNTS} total={7400} onChange={onChange} />);
    expect(screen.getByRole("tab", { name: /everyone/i })).toHaveTextContent("7,400");
    expect(screen.getByRole("tab", { name: /women/i })).toHaveTextContent("4,815");
    expect(screen.getByRole("tab", { name: /kids/i })).toHaveTextContent("1,053");
  });

  it("passes the choice up when one is tapped", async () => {
    render(<AudienceTabs value="" counts={COUNTS} total={7400} onChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: /^men/i }));
    expect(onChange).toHaveBeenCalledWith("MEN");
  });

  it("goes back to everything from any tab", async () => {
    render(<AudienceTabs value="KIDS" counts={COUNTS} total={7400} onChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: /everyone/i }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("marks the chosen one, so it is visible and not only coloured", () => {
    render(<AudienceTabs value="WOMEN" counts={COUNTS} total={7400} onChange={onChange} />);
    expect(screen.getByRole("tab", { name: /women/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /everyone/i })).toHaveAttribute("aria-selected", "false");
  });

  it("still works before the counts have arrived", () => {
    render(<AudienceTabs value="" onChange={onChange} />);
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.getByRole("tab", { name: /^women/i })).toBeInTheDocument();
  });

  it("is a real tab strip, so a screen reader announces it as one", () => {
    render(<AudienceTabs value="" counts={COUNTS} total={7400} onChange={onChange} />);
    expect(screen.getByRole("tablist")).toHaveAccessibleName(/who the clothes are for/i);
  });

  it("never offers a tab for things the shops did not label", () => {
    // Those appear under Everyone. A tab called "Not stated" would be
    // meaningless to a shopper.
    render(
      <AudienceTabs
        value=""
        counts={[...COUNTS, { value: "UNKNOWN", label: "Not stated", count: 197 }]}
        total={7400}
        onChange={onChange}
      />,
    );
    expect(screen.queryByRole("tab", { name: /not stated/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });
});
