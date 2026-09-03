import { describe, expect, it } from "vitest";

import { SMALL_N_FLOOR, rateCell } from "@/helpers/metrics-helper.js";

describe("rateCell", () => {
  it("renders the rate with its denominator shown — never a bare count", () => {
    const cell = rateCell(3, 41);

    expect(cell.display).toBe("3/41 (7.3%)");
    expect(cell.rate).toBeCloseTo(3 / 41);
  });

  it("suppresses a cell one under the floor as insufficient data", () => {
    const cell = rateCell(2, SMALL_N_FLOOR - 1);

    expect(cell.rate).toBeNull();
    expect(cell.display).toBe(`insufficient data (n<${SMALL_N_FLOOR})`);
  });

  it("renders a cell exactly at the floor", () => {
    const cell = rateCell(1, SMALL_N_FLOOR);

    expect(cell.rate).not.toBeNull();
    expect(cell.display).toContain(`1/${SMALL_N_FLOOR}`);
  });

  it("renders a clean zero rate — zero violations is a claim, not absence", () => {
    const cell = rateCell(0, 20);

    expect(cell.display).toBe("0/20 (0.0%)");
  });
});
