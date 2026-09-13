import { describe, expect, it } from "vitest";

import { idsWithin, levelsInside, measure } from "./storage-tree";
import type { StorageNode } from "@/types/wardrobe";

function node(id: number, name: string, items: number, children: StorageNode[] = []): StorageNode {
  return { id, name, kind: "OTHER", kind_label: "Other", notes: "", item_count: items, children };
}

const TREE = node(1, "Bedroom", 0, [
  node(2, "Wardrobe", 1, [node(3, "Drawer 1", 4, [node(4, "Slot A", 2)])]),
  node(5, "Shoe rack", 3),
]);

describe("measure", () => {
  it("counts every place inside and every item in all of them", () => {
    expect(measure(TREE)).toEqual({ places: 4, items: 10 });
  });

  it("counts a leaf as taking nothing else with it", () => {
    expect(measure(node(9, "Empty drawer", 0))).toEqual({ places: 0, items: 0 });
  });

  it("still reports the items kept in a place with nothing inside it", () => {
    expect(measure(node(9, "Shelf", 7))).toEqual({ places: 0, items: 7 });
  });
});

describe("levelsInside", () => {
  it("is zero for a place holding no other place", () => {
    expect(levelsInside(node(9, "Drawer", 2))).toBe(0);
  });

  it("counts the deepest branch, not the number of children", () => {
    expect(levelsInside(TREE)).toBe(3);
    expect(levelsInside(TREE.children[0])).toBe(2);
    expect(levelsInside(TREE.children[1])).toBe(0);
  });
});

describe("idsWithin", () => {
  it("lists the place and everything nested in it", () => {
    expect(idsWithin(TREE).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
