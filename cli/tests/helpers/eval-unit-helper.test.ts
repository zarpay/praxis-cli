import type { EvalUnit } from "@/types.js";

import { describe, expect, it } from "vitest";

import { isCohortUnit } from "@/helpers/eval-unit-helper.js";

/** A unit over the given path and members. */
function unit(path: string, files: string[]): EvalUnit {
  return { path, files };
}

describe("isCohortUnit", () => {
  it("is false for a by_file unit, whose path is its only member", () => {
    expect(isCohortUnit(unit("/p/src/a.ts", ["/p/src/a.ts"]))).toBe(false);
  });

  it("is true for a directory holding several members", () => {
    expect(
      isCohortUnit(unit("/p/src/loyalty", ["/p/src/loyalty/a.ts", "/p/src/loyalty/b.ts"])),
    ).toBe(true);
  });

  it("is true for a directory holding exactly one member — the unit is still the directory", () => {
    expect(isCohortUnit(unit("/p/src/loyalty", ["/p/src/loyalty/a.ts"]))).toBe(true);
  });

  it("is true for a unit with no members at all", () => {
    expect(isCohortUnit(unit("/p/src/empty", []))).toBe(true);
  });
});
