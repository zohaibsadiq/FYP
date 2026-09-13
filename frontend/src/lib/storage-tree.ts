import type { StorageNode } from "@/types/wardrobe";

/** What a place takes with it: the places nested inside, and the items in all of them. */
export function measure(node: StorageNode): { places: number; items: number } {
  return node.children.reduce(
    (total, child) => {
      const inner = measure(child);
      return { places: total.places + 1 + inner.places, items: total.items + inner.items };
    },
    { places: 0, items: node.item_count },
  );
}

/** Levels nested inside this one. A drawer holding nothing is 0. */
export function levelsInside(node: StorageNode): number {
  return node.children.length === 0
    ? 0
    : 1 + Math.max(...node.children.map((child) => levelsInside(child)));
}

/** This place and everything inside it, so none can be picked as its own parent. */
export function idsWithin(node: StorageNode): number[] {
  return [node.id, ...node.children.flatMap((child) => idsWithin(child))];
}
