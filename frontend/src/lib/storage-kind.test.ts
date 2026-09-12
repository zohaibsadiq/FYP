import { describe, expect, it } from "vitest";

import { guessStorageKind } from "./storage-kind";

describe("guessStorageKind", () => {
  it.each([
    ["Bedroom", "ROOM"],
    ["bedroom", "ROOM"],
    ["Kitchen", "ROOM"],
    ["Main wardrobe", "WARDROBE"],
    ["almari", "WARDROBE"],
    ["Cupboard by the door", "WARDROBE"],
    ["Top drawer", "DRAWER"],
    ["drawers", "DRAWER"],
    ["Shoe rack", "SHELF"],
    ["Second shelf", "SHELF"],
    ["Hanging rail", "RAIL"],
    ["Hanger 4", "HANGER"],
    ["Winter box", "BOX"],
    ["Suitcase under the bed", "SUITCASE"],
    ["Cabinet", "CABINET"],
  ])("reads %s as %s", (name, expected) => {
    expect(guessStorageKind(name)).toBe(expected);
  });

  it("does not read the bin inside cabinet", () => {
    expect(guessStorageKind("cabinet")).toBe("CABINET");
  });

  it("falls back to Other when nothing in the name says what it is", () => {
    expect(guessStorageKind("Ammi's corner")).toBe("OTHER");
    expect(guessStorageKind("")).toBe("OTHER");
  });
});
