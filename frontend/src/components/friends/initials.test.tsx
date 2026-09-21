import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Initials } from "./initials";

function colourOf(name: string, id: number): string {
  const { container } = render(<Initials name={name} id={id} />);
  return (container.firstChild as HTMLElement).className;
}

describe("Initials", () => {
  it("takes the first letter of the first and last word", () => {
    render(<Initials name="Ali Khan" id={1} />);
    expect(screen.getByText("AK")).toBeInTheDocument();
  });

  it("takes two letters from a single word", () => {
    render(<Initials name="Sara" id={1} />);
    expect(screen.getByText("SA")).toBeInTheDocument();
  });

  it("uses the first and last of three words, not the middle", () => {
    render(<Initials name="Ali Raza Khan" id={1} />);
    expect(screen.getByText("AK")).toBeInTheDocument();
  });

  it("does not fall over on an empty name", () => {
    render(<Initials name="   " id={1} />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("gives two people with the same name different colours", () => {
    // This is the point: two friends called Ali Khan must not look identical.
    expect(colourOf("Ali Khan", 7)).not.toBe(colourOf("Ali Khan", 8));
  });

  it("gives the same person the same colour every time", () => {
    expect(colourOf("Ali Khan", 7)).toBe(colourOf("Ali Khan", 7));
  });

  it("is hidden from screen readers, since the name is already read out", () => {
    const { container } = render(<Initials name="Ali Khan" id={1} />);
    expect(container.firstChild).toHaveAttribute("aria-hidden");
  });
});
