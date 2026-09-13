import { describe, expect, it } from "vitest";

import { lastWorn, lastWornSentence, wearLine } from "./wear";
import { addDays, todayIso } from "./dates";
import type { GarmentListItem } from "@/types/wardrobe";

type Worn = Pick<
  GarmentListItem,
  "wear_count" | "last_worn_date" | "days_since_worn" | "last_worn_note"
>;

function item(overrides: Partial<Worn> = {}): Worn {
  return {
    wear_count: 3,
    last_worn_date: "2026-09-11",
    days_since_worn: 3,
    last_worn_note: "",
    ...overrides,
  };
}

describe("lastWorn", () => {
  it("says so plainly when it has never been worn", () => {
    const worn = lastWorn(item({ wear_count: 0, last_worn_date: null, days_since_worn: null }));
    expect(worn.when).toBe("Not worn yet");
    expect(worn.neglected).toBe(true);
  });

  it("handles a count with no day behind it, rather than showing nothing", () => {
    const worn = lastWorn(item({ wear_count: 2, last_worn_date: null, days_since_worn: null }));
    expect(worn.when).toBe("Worn before, no day recorded");
  });

  it("says today and yesterday in words", () => {
    expect(lastWorn(item({ days_since_worn: 0 })).when).toBe("Worn today");
    expect(lastWorn(item({ days_since_worn: 1 })).when).toBe("Worn yesterday");
  });

  it("counts days while the number is small", () => {
    expect(lastWorn(item({ days_since_worn: 5 })).when).toBe("Worn 5 days ago");
  });

  it("switches to weeks and months rather than counting high", () => {
    expect(lastWorn(item({ days_since_worn: 21 })).when).toBe("Worn 3 weeks ago");
    expect(lastWorn(item({ days_since_worn: 120 })).when).toBe("Worn 4 months ago");
  });

  it("flags something worn in the last few days", () => {
    expect(lastWorn(item({ days_since_worn: 2 })).recent).toBe(true);
    expect(lastWorn(item({ days_since_worn: 3 })).recent).toBe(true);
    expect(lastWorn(item({ days_since_worn: 4 })).recent).toBe(false);
  });

  it("flags something untouched for months", () => {
    expect(lastWorn(item({ days_since_worn: 89 })).neglected).toBe(false);
    expect(lastWorn(item({ days_since_worn: 90 })).neglected).toBe(true);
  });

  it("carries the occasion through", () => {
    expect(lastWorn(item({ last_worn_note: "Office" })).occasion).toBe("Office");
  });

  it("survives an older response with no occasion field at all", () => {
    const legacy = { wear_count: 1, last_worn_date: "2026-09-11", days_since_worn: 3 } as Worn;
    expect(lastWorn(legacy).occasion).toBe("");
  });
});

describe("lastWornSentence", () => {
  it("adds the occasion when there is one", () => {
    expect(lastWornSentence(lastWorn(item({ days_since_worn: 1, last_worn_note: "Mehndi" })))).toBe(
      "Worn yesterday, for Mehndi",
    );
  });

  it("leaves it out when there is not", () => {
    expect(lastWornSentence(lastWorn(item({ days_since_worn: 1 })))).toBe("Worn yesterday");
  });
});

describe("wearLine", () => {
  it("names the day and what it was for", () => {
    expect(wearLine(addDays(todayIso(), -1), "Office")).toBe("Yesterday, for Office");
  });

  it("gives the day alone when nothing was written down", () => {
    expect(wearLine(todayIso(), "")).toBe("Today");
  });
});
