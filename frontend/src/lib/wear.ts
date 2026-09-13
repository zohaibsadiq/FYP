import { friendlyDay, spanInWords } from "./dates";
import type { GarmentListItem } from "@/types/wardrobe";

/** Within this many days, wearing it again is worth pointing out before it happens. */
export const RECENTLY = 3;

/** Past this, it is worth reminding the owner the thing exists. */
export const NEGLECTED = 90;

export interface LastWorn {
  /** "Not worn yet", "Worn today", "Worn 3 days ago". */
  when: string;
  /** What it was worn for, when that was written down. Empty otherwise. */
  occasion: string;
  /** The day itself, for a screen that wants to show the date as well. */
  date: string | null;
  /** Worn in the last few days, so repeating it is worth flagging. */
  recent: boolean;
  /** Untouched for months. */
  neglected: boolean;
}

/**
 * One phrase covering when something was last worn.
 *
 * Days are turned into words on purpose. "Worn 2 days ago" needs no working
 * out, where a bare date leaves the reader counting back from today.
 */
export function lastWorn(
  item: Pick<GarmentListItem, "wear_count" | "last_worn_date" | "days_since_worn" | "last_worn_note">,
): LastWorn {
  const gap = item.days_since_worn;

  if (item.last_worn_date === null || gap === null) {
    return {
      when: item.wear_count === 0 ? "Not worn yet" : "Worn before, no day recorded",
      occasion: item.last_worn_note ?? "",
      date: null,
      recent: false,
      neglected: item.wear_count === 0,
    };
  }

  const when =
    gap === 0 ? "Worn today" : gap === 1 ? "Worn yesterday" : `Worn ${spanInWords(gap)} ago`;

  return {
    when,
    occasion: item.last_worn_note ?? "",
    date: item.last_worn_date,
    recent: gap <= RECENTLY,
    neglected: gap >= NEGLECTED,
  };
}

/** "Worn 3 days ago, for Ayesha's mehndi" as a single sentence. */
export function lastWornSentence(worn: LastWorn): string {
  return worn.occasion ? `${worn.when}, for ${worn.occasion}` : worn.when;
}

/** "Yesterday, for Ayesha's mehndi" for one row of the history list. */
export function wearLine(worn_on: string, note: string): string {
  return note ? `${friendlyDay(worn_on)}, for ${note}` : friendlyDay(worn_on);
}
