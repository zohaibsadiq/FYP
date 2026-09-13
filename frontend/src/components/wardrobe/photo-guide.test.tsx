import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PhotoGuide } from "./photo-guide";
import { GARMENT_SHAPES } from "./garment-shapes";
import { SLOTS, type Slot } from "@/types/wardrobe";

describe("PhotoGuide", () => {
  it("shows one way that works and three that do not", () => {
    render(<PhotoGuide slot="TOP" />);

    expect(screen.getAllByText("Do this")).toHaveLength(1);
    expect(screen.getAllByText("Avoid this")).toHaveLength(3);
  });

  it("tells someone adding shoes to photograph the pair", () => {
    render(<PhotoGuide slot="FOOTWEAR" />);

    expect(screen.getByText("Both shoes, side by side")).toBeInTheDocument();
    expect(screen.getByText("Not just one shoe")).toBeInTheDocument();
  });

  it("tells someone adding trousers to lay them out lengthwise", () => {
    render(<PhotoGuide slot="BOTTOM" />);

    expect(screen.getByText("Laid out lengthwise")).toBeInTheDocument();
    expect(screen.getByText("Not folded up")).toBeInTheDocument();
  });

  it("tells someone adding a watch to come closer, which laying it flat would not", () => {
    render(<PhotoGuide slot="ACCESSORY" />);

    expect(screen.getByText("Not far away")).toBeInTheDocument();
    expect(screen.queryByText("Not folded up")).not.toBeInTheDocument();
  });

  it("says something for every sort of thing, including a made-up category", () => {
    for (const slot of SLOTS) {
      const { unmount } = render(<PhotoGuide slot={slot as Slot} />);
      expect(screen.getAllByText("Do this")).toHaveLength(1);
      expect(screen.getByText(/cuts the background out for you/i)).toBeInTheDocument();
      unmount();
    }
  });

  it("has a drawing for every sort of thing", () => {
    for (const slot of SLOTS) {
      expect(GARMENT_SHAPES[slot as Slot]).toMatch(/^M[\d\s.]/);
    }
  });
});
