import { describe, expect, it } from "vitest";

import {
  addDays,
  daysAgo,
  friendlyDay,
  monthLabel,
  parseDay,
  spanInWords,
  toIso,
  todayIso,
} from "./dates";

describe("parseDay", () => {
  it("reads the day in the reader's own timezone, not UTC", () => {
    const date = parseDay("2026-09-14");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8);
    expect(date.getDate()).toBe(14);
  });

  it("survives a round trip", () => {
    expect(toIso(parseDay("2025-01-05"))).toBe("2025-01-05");
  });

  it("gives today in the same shape the API expects", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("addDays", () => {
  it("moves forward", () => {
    expect(addDays("2026-09-14", 3)).toBe("2026-09-17");
  });

  it("moves back", () => {
    expect(addDays("2026-09-14", -14)).toBe("2026-08-31");
  });

  it("crosses a year boundary", () => {
    expect(addDays("2025-12-30", 5)).toBe("2026-01-04");
  });

  it("handles a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("daysAgo", () => {
  it("counts back", () => {
    expect(daysAgo("2026-09-01", "2026-09-14")).toBe(13);
  });

  it("is zero for the same day", () => {
    expect(daysAgo("2026-09-14", "2026-09-14")).toBe(0);
  });

  it("goes negative for a day still to come", () => {
    expect(daysAgo("2026-09-20", "2026-09-14")).toBe(-6);
  });

  it("is not thrown off by daylight saving", () => {
    // Clocks change inside this range in much of the world, so a naive
    // millisecond division would come back 89.958 and round wrong.
    expect(daysAgo("2026-03-01", "2026-05-30")).toBe(90);
  });
});

describe("friendlyDay", () => {
  const TODAY = "2026-09-14";

  it("says Today", () => {
    expect(friendlyDay(TODAY, TODAY)).toBe("Today");
  });

  it("says Yesterday", () => {
    expect(friendlyDay("2026-09-13", TODAY)).toBe("Yesterday");
  });

  it("names the weekday within the past week", () => {
    expect(friendlyDay("2026-09-11", TODAY)).toBe("Last Friday");
  });

  it("switches to a date once a week has passed", () => {
    expect(friendlyDay("2026-09-01", TODAY)).toBe("1 Sep");
  });

  it("adds the year once it is a different one", () => {
    expect(friendlyDay("2025-12-25", TODAY)).toBe("25 Dec 2025");
  });

  it("handles a day still to come", () => {
    expect(friendlyDay("2026-09-15", TODAY)).toBe("Tomorrow");
  });
});

describe("spanInWords", () => {
  it("counts single days while the number is small", () => {
    expect(spanInWords(1)).toBe("1 day");
    expect(spanInWords(9)).toBe("9 days");
  });

  it("switches to weeks", () => {
    expect(spanInWords(21)).toBe("3 weeks");
  });

  it("switches to months", () => {
    expect(spanInWords(90)).toBe("3 months");
  });

  it("stops counting past a year", () => {
    expect(spanInWords(400)).toBe("over a year");
    expect(spanInWords(800)).toBe("over 2 years");
  });

  it("says today rather than zero days", () => {
    expect(spanInWords(0)).toBe("today");
  });
});

describe("monthLabel", () => {
  it("spells the month out", () => {
    expect(monthLabel("2026-09-14")).toBe("September 2026");
  });
});
