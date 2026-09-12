import type { StorageKind } from "@/types/wardrobe";

// Word boundaries rather than plain contains: "cabinet" holds the letters of
// "bin", and "bedroom" holds "room" with no boundary in front of it.
const KIND_HINTS: [RegExp, StorageKind][] = [
  [/\b(suitcase|luggage)s?\b/i, "SUITCASE"],
  [/\b(wardrobe|closet|cupboard|almari|almirah)s?\b/i, "WARDROBE"],
  [/\b(cabinet|chest)s?\b/i, "CABINET"],
  [/\bdrawers?\b/i, "DRAWER"],
  [/\b(shelf|shelves|rack)s?\b/i, "SHELF"],
  [/\b(hanger|peg|hook)s?\b/i, "HANGER"],
  [/\b(rail|rod|hanging)s?\b/i, "RAIL"],
  [/\b(box|boxes|bin|basket|carton)s?\b/i, "BOX"],
  [/(room|kitchen|lounge|hall|attic|garage|loft)s?\b/i, "ROOM"],
];

/**
 * Picks a kind from what someone typed, so a place created inside a picker
 * does not land in the tree labelled Other.
 */
export function guessStorageKind(name: string): StorageKind {
  for (const [pattern, kind] of KIND_HINTS) {
    if (pattern.test(name)) return kind;
  }
  return "OTHER";
}
