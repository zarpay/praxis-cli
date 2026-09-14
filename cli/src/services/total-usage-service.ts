import type { ProviderUsage, Service } from "@/types.js";

/** The usages to total; nulls are calls that reported nothing. */
interface TotalUsageInput {
  usages: (ProviderUsage | null)[];
}

/**
 * Provider usage summed across a run's calls.
 *
 * Null when nothing was reported — a run answered entirely from cache
 * spent nothing, and showing `$0.0000` would claim a measurement that
 * was never taken. Each field totals independently for the same reason:
 * a backend that reports tokens but not cost should not zero the cost.
 */
const totalUsageService: Service<TotalUsageInput, ProviderUsage | null> = (_cfg, { usages }) => {
  const reported = usages.filter((usage): usage is ProviderUsage => usage !== null);

  if (reported.length === 0) return null;

  return {
    promptTokens: total(reported.map((usage) => usage.promptTokens)),
    completionTokens: total(reported.map((usage) => usage.completionTokens)),
    costUsd: total(reported.map((usage) => usage.costUsd)),
  };
};

export default totalUsageService;

/** Sum of the reported values; null when none were reported. */
function total(values: (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);

  if (known.length === 0) return null;

  return known.reduce((sum, value) => sum + value, 0);
}
