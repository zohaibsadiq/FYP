import type { Slot } from "@/types/wardrobe";

// One silhouette per slot, drawn in a 100 x 100 box. The photo guide reuses the
// same outline for all four of its pictures, so a new slot needs one shape here
// rather than four drawings.
export const GARMENT_SHAPES: Record<Slot, string> = {
  TOP: "M32 24 L44 18 Q50 26 56 18 L68 24 L80 37 L69 46 L69 82 L31 82 L31 46 L20 37 Z",
  BOTTOM: "M33 16 L67 16 L71 86 L55 86 L50 48 L45 86 L29 86 Z",
  FULL_BODY:
    "M38 20 L44 15 Q50 22 56 15 L62 20 L70 32 L62 37 L58 46 L74 88 L26 88 L42 46 L38 37 L30 32 Z",
  OUTERWEAR: "M30 22 L44 16 Q50 24 56 16 L70 22 L82 36 L70 45 L70 86 L30 86 L30 45 L18 36 Z",
  FOOTWEAR:
    "M14 76 L14 66 Q16 58 26 56 L48 52 Q57 50 61 42 L63 38 L77 38 Q82 50 82 68 Q86 70 86 76 Z",
  ACCESSORY: "M24 44 L76 44 L80 84 L20 84 Z",
  HEADWEAR: "M24 64 Q24 34 50 34 Q76 34 76 58 Q88 58 92 66 L76 68 L24 68 Z",
  // Nothing is seeded under this slot, but an account can add a category to it.
  OTHER: "M26 30 Q26 26 30 26 L70 26 Q74 26 74 30 L74 74 Q74 78 70 78 L30 78 Q26 78 26 74 Z",
};

/** Drawn in the surface colour on top of the shape, to cut a detail into it. */
export const SHAPE_CUTS: Partial<Record<Slot, string>> = {
  OUTERWEAR: "M50 21 L50 86",
};

/** Drawn in the shape colour beyond its outline, for a part that sticks out. */
export const SHAPE_LINES: Partial<Record<Slot, string>> = {
  ACCESSORY: "M37 45 Q37 21 50 21 Q63 21 63 45",
};
