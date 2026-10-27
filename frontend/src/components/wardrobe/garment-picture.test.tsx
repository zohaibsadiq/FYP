import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GarmentPicture } from "./garment-picture";

describe("GarmentPicture", () => {
  it("shows the picture when there is one", () => {
    render(<GarmentPicture src="https://images.test/kurta.png" alt="Blue Kurta" sizes="100px" />);
    expect(screen.getByAltText("Blue Kurta")).toBeInTheDocument();
  });

  it("shows a plain outline when there is no picture", () => {
    const { container } = render(<GarmentPicture src="" alt="Blue Kurta" sizes="100px" />);
    expect(screen.queryByAltText("Blue Kurta")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("falls back to the outline when the picture cannot be loaded", () => {
    const { container } = render(
      <GarmentPicture src="https://images.test/gone.png" alt="Blue Kurta" sizes="100px" />,
    );

    fireEvent.error(screen.getByAltText("Blue Kurta"));

    expect(screen.queryByAltText("Blue Kurta")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("gives a replacement picture its own chance after an earlier one failed", () => {
    const { rerender } = render(
      <GarmentPicture src="https://images.test/gone.png" alt="Blue Kurta" sizes="100px" />,
    );
    fireEvent.error(screen.getByAltText("Blue Kurta"));

    rerender(<GarmentPicture src="https://images.test/new.png" alt="Blue Kurta" sizes="100px" />);

    expect(screen.getByAltText("Blue Kurta")).toBeInTheDocument();
  });
});
