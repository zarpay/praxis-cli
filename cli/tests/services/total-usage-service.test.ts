import type { ProviderUsage } from "@/types.js";

import { describe, expect, it } from "vitest";

import totalUsageService from "@/services/total-usage-service.js";
import { testConfig } from "@tests/helpers/test-config.js";

const cfg = testConfig("/tmp/praxis-total-usage");

/** One call's usage, defaulting to a fully-reported one. */
function usage(overrides: Partial<ProviderUsage> = {}): ProviderUsage {
  return { promptTokens: 100, completionTokens: 20, costUsd: 0.001, ...overrides };
}

describe("totalUsageService", () => {
  it("sums each field across the calls that reported", () => {
    const total = totalUsageService(cfg, { usages: [usage(), usage()] });

    expect(total).toEqual({ promptTokens: 200, completionTokens: 40, costUsd: 0.002 });
  });

  it("is null when nothing reported — a cached run spent nothing it can name", () => {
    expect(totalUsageService(cfg, { usages: [null, null] })).toBeNull();
    expect(totalUsageService(cfg, { usages: [] })).toBeNull();
  });

  it("ignores the calls that reported nothing rather than counting them as zero", () => {
    const total = totalUsageService(cfg, { usages: [null, usage(), null] });

    expect(total).toEqual({ promptTokens: 100, completionTokens: 20, costUsd: 0.001 });
  });

  it("totals each field independently, so tokens without cost do not zero the cost", () => {
    const tokensOnly = usage({ costUsd: null });
    const total = totalUsageService(cfg, { usages: [tokensOnly, usage()] });

    expect(total?.promptTokens).toBe(200);
    // One backend reported no cost; the other's $0.001 must survive intact
    // rather than being averaged or zeroed by its silent neighbour.
    expect(total?.costUsd).toBe(0.001);
  });

  it("leaves a field null when no call reported it at all", () => {
    const noCost = usage({ costUsd: null });
    const total = totalUsageService(cfg, { usages: [noCost, noCost] });

    expect(total?.costUsd).toBeNull();
    expect(total?.promptTokens).toBe(200);
  });
});
