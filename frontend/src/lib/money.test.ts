import { describe, expect, it } from "vitest";

import { currencySymbol, money, savingLabel } from "./money";

describe("money", () => {
  it("writes rupees the way a price tag does", () => {
    expect(money("4999")).toBe("Rs 4,999");
  });

  it("groups thousands so a long number can be read at a glance", () => {
    expect(money(144155)).toBe("Rs 144,155");
  });

  it("leaves off the paisa when there are none", () => {
    expect(money("2690.00")).toBe("Rs 2,690");
  });

  it("keeps the paisa when the shop charges them", () => {
    expect(money("999.80")).toBe("Rs 999.80");
  });

  it("uses the same grouping everywhere, not the browser's idea of it", () => {
    // Two people on different phones must read the same price the same way.
    expect(money(100000)).toBe("Rs 100,000");
  });

  it("knows the one other currency worth a symbol", () => {
    expect(money(25, "USD")).toBe("$ 25");
    expect(currencySymbol("PKR")).toBe("Rs");
  });

  it("falls back to the code for a currency it does not know", () => {
    expect(money(10, "XYZ")).toBe("XYZ 10");
  });

  it("gives nothing back for something that is not a number", () => {
    expect(money("free")).toBe("");
    expect(money("")).toBe("");
  });

  it("handles zero without pretending it is missing", () => {
    expect(money(0)).toBe("Rs 0");
  });
});

describe("savingLabel", () => {
  it("says how much is off", () => {
    expect(savingLabel("3999")).toBe("Rs 3,999 off");
  });

  it("stays quiet when nothing is off", () => {
    expect(savingLabel(null)).toBe("");
    expect(savingLabel("0")).toBe("");
  });

  it("never announces a negative saving", () => {
    expect(savingLabel("-50")).toBe("");
  });
});
