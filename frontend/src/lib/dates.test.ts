import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  daysAgo,
  friendlyDay,
  monthGrid,
  monthLabel,
  parseDay,
  spanInWords,
  startOfMonth,
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

describe("startOfMonth", () => {
  it("snaps to the first", () => {
    expect(startOfMonth("2026-09-23")).toBe("2026-09-01");
  });
});

describe("addMonths", () => {
  it("steps forward", () => {
    expect(addMonths("2026-09-01", 1)).toBe("2026-10-01");
  });

  it("steps back across a year", () => {
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
  });

  it("does not skip February when stepping off a 31st", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
  });
});

describe("monthGrid", () => {
  it("always draws six full rows, so the page does not jump height", () => {
    for (const month of ["2026-02-01", "2026-09-01", "2026-08-01", "2026-11-01"]) {
      expect(monthGrid(month)).toHaveLength(42);
    }
  });

  it("starts on a Monday", () => {
    const first = monthGrid("2026-09-01")[0];
    expect(parseDay(first.date).getDay()).toBe(1);
  });

  it("pads with the days either side and marks them as outside the month", () => {
    const grid = monthGrid("2026-09-01");
    expect(grid[0]).toEqual({ date: "2026-08-31", inMonth: false });
    expect(grid[1]).toEqual({ date: "2026-09-01", inMonth: true });
  });

  it("holds every day of the month exactly once", () => {
    const inside = monthGrid("2026-09-01").filter((day) => day.inMonth);
    expect(inside).toHaveLength(30);
    expect(new Set(inside.map((day) => day.date)).size).toBe(30);
  });

  it("handles a month that starts on a Monday with no padding at the front", () => {
    const grid = monthGrid("2026-06-01");
    expect(grid[0]).toEqual({ date: "2026-06-01", inMonth: true });
  });

  it("handles February in a leap year", () => {
    const inside = monthGrid("2028-02-01").filter((day) => day.inMonth);
    expect(inside).toHaveLength(29);
  });

  it("runs in an unbroken line of days", () => {
    const grid = monthGrid("2026-09-01");
    for (let i = 1; i < grid.length; i += 1) {
      expect(grid[i].date).toBe(addDays(grid[i - 1].date, 1));
    }
  });
});
