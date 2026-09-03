import type { PraxisConfig } from "@/models/praxis-config.js";
import type { BuildVerdictReportInput, Service, VerdictReport } from "@/types.js";

import { ReviewSubject } from "@/models/review-subject.js";
import { SpecStore } from "@/stores/spec-store.js";

/**
 * Classifies a target's cached verdict, including whether it is stale.
 *
 * Staleness takes priority: when the recomputed content hash differs
 * from the cached one, the status is "stale" whatever the cached result
 * said, because that result described inputs that no longer exist. An
 * uncomputable hash — the target or its spec is gone — skips the check
 * rather than inventing an answer.
 *
 * This reads the target and its spec, which is why it is a service and
 * not a view: deciding *what happened* is work, rendering it is not.
 */
const buildVerdictReportService: Service<BuildVerdictReportInput, VerdictReport> = (
  config,
  { targetPath, cacheData },
) => {
  const currentHash = recomputeHash(config, targetPath, cacheData?.document.spec_path);

  if (!cacheData) {
    return { targetPath, status: "not_validated", cacheData: null, currentHash, isStale: false };
  }

  if (currentHash !== null && cacheData.content_hash !== currentHash) {
    return { targetPath, status: "stale", cacheData, currentHash, isStale: true };
  }

  if (cacheData.result.compliant) {
    return { targetPath, status: "pass", cacheData, currentHash, isStale: false };
  }

  return {
    targetPath,
    status: cacheData.result.severity === "warning" ? "warn" : "fail",
    cacheData,
    currentHash,
    isStale: false,
  };
};

export default buildVerdictReportService;

/**
 * The content hash the target would produce right now.
 *
 * Null when it cannot be computed — the target is gone, or its spec is
 * — because "unknown" and "changed" are different answers and only one
 * of them should mark a verdict stale.
 *
 * When the cache recorded which spec was used, that one is rehashed;
 * otherwise the spec is rediscovered the way a run would.
 */
function recomputeHash(
  config: PraxisConfig,
  targetPath: string,
  specPath: string | undefined,
): string | null {
  try {
    const store = new SpecStore(config);
    const governing = specPath ?? store.governingPath(targetPath);

    return ReviewSubject.resolve({
      targetPath,
      specPath: governing,
      root: config.root,
    }).contentHash();
  } catch {
    return null;
  }
}
