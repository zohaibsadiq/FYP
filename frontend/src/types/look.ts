import type { GarmentListItem, Slot } from "./wardrobe";

export interface LookMatch {
  item: GarmentListItem;
  /** 0 to 100, how close the colour is. */
  score: number;
  /** The same score in words: "Very close", "A bit different". */
  verdict: string;
}

export interface LookPart {
  /** Empty when the photo held one garment rather than a whole outfit. */
  slot: Slot | "";
  slot_label: string;
  hex: string;
  color_name: string;
  matches: LookMatch[];
  best_score: number;
  /** True when the closet holds nothing for this part of the look. */
  missing: boolean;
}

/** Why a photo could not be read. Empty when it was. */
export type LookProblem =
  | ""
  | "unreadable"
  | "too_small"
  | "no_subject"
  | "nothing_found";

export interface LookResult {
  parts: LookPart[];
  how_close: number;
  verdict: string;
  /** What to know about how the photo was read. Always worth showing. */
  note: string;
  code: LookProblem;
  is_full_length: boolean;
  one_garment_only: boolean;
  /** The photo as a data URI. Nothing is stored on the server. */
  preview: string;
}
