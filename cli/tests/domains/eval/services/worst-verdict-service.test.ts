import type { Verdict } from "@/domains/eval/types.js";

import { describe, expect, it } from "vitest";

import worstVerdict from "@/domains/eval/services/worst-verdict-service.js";

/** A verdict with only the fields ranking depends on. */
function verdict(fields: Partial<Verdict>): Verdict {
  return { compliant: true, severity: "error", issues: [], reason: "", ...fields };
}

const pass = verdict({ compliant: true });
const warn = verdict({ compliant: false, severity: "warning" });
const error = verdict({ compliant: false, severity: "error" });

describe("worstVerdict", () => {
  it("returns null when there are no verdicts", () => {
    expect(worstVerdict([])).toBeNull();
  });

  it("returns the only verdict there is", () => {
    expect(worstVerdict([pass])).toBe(pass);
  });

  it("ranks a warning above a pass", () => {
    expect(worstVerdict([pass, warn])).toBe(warn);
  });

  it("ranks an error above a warning", () => {
    expect(worstVerdict([warn, error])).toBe(error);
  });

  it("ignores severity on a compliant verdict", () => {
    const compliantButSevere = verdict({ compliant: true, severity: "error" });

    expect(worstVerdict([compliantButSevere, warn])).toBe(warn);
  });

  it("is order-independent", () => {
    expect(worstVerdict([error, warn, pass])).toBe(error);
    expect(worstVerdict([pass, warn, error])).toBe(error);
  });
});
