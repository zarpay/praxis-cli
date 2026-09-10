import { describe, expect, it } from "vitest";

import { badge, badgeBlock, verdictTally } from "@framework/views/badges.js";

describe("badge", () => {
  it("builds one [LABEL] value entry", () => {
    expect(badge("PASS", "green", 3)).toEqual({ badge: "PASS", color: "green", value: 3 });
  });

  it("allows a bare label with no value", () => {
    expect(badge("CACHE", "cyan")).toEqual({ badge: "CACHE", color: "cyan", value: undefined });
  });
});

describe("badgeBlock", () => {
  it("gives every badge in a block one shared indent", () => {
    const block = badgeBlock([
      ["PASS", "green", 1],
      ["FAIL", "red", 2],
    ]);

    expect(block).toEqual([
      { badge: "PASS", color: "green", value: 1, indent: 2 },
      { badge: "FAIL", color: "red", value: 2, indent: 2 },
    ]);
  });
});

describe("verdictTally", () => {
  it("renders the conventional pass/warn/fail/not-validated tally, in that order", () => {
    const tally = verdictTally({ pass: 5, warn: 1, fail: 0, notValidated: 2 });

    expect(tally.map((entry) => entry.badge)).toEqual(["PASS", "WARN", "FAIL", "NOT VALIDATED"]);
    expect(tally.map((entry) => entry.value)).toEqual([5, 1, 0, 2]);
  });
});
