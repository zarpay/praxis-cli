import type { PraxisConfig } from "@/models/praxis-config.js";
import type { NoInput, Service, StatusReport } from "@/types.js";

import { Reviewer } from "@/models/reviewer.js";
import discoverDomainsService from "@/services/discover-domains-service.js";
import resolveUnitsService from "@/services/resolve-units-service.js";
import { VerdictStore } from "@/stores/verdict-store.js";

/**
 * Counts each reviewer's cached verdicts across every spec target.
 *
 * Reads only: no API keys, no reviewing. The targets come from the eval
 * layer's own discovery, so coverage counts what a run would actually
 * review rather than a second-guess at it — a file with no cached
 * verdict is "not validated", which is the number that tells you a run
 * is overdue.
 *
 * One row per reviewer, never pooled: reviewers are separate instruments, and
 * averaging them would hide exactly the disagreement worth seeing.
 */
const tallyValidationService: Service<NoInput, StatusReport["validation"]> = (cfg) => {
  const targets = targetPaths(cfg);

  // One cache namespace per reviewer; the un-namespaced cache when no
  // reviewers are configured at all.
  const readers =
    cfg.reviewers.length > 0
      ? cfg.reviewers.map((reviewer) => ({
          reviewer: reviewer.name,
          cache: new VerdictStore(cfg, {
            reviewer: Reviewer.fromConfig(reviewer).cacheIdentity(),
          }),
        }))
      : [{ reviewer: null, cache: new VerdictStore(cfg) }];

  return readers.map(({ reviewer, cache }) => {
    const row = {
      reviewer,
      pass: 0,
      warn: 0,
      fail: 0,
      notValidated: 0,
    };

    for (const targetPath of targets) {
      const cached = cache.readEntry({ targetPath });

      if (!cached) {
        row.notValidated++;
      } else if (cached.result.compliant) {
        row.pass++;
      } else if (cached.result.severity === "warning") {
        row.warn++;
      } else {
        row.fail++;
      }
    }

    return row;
  });
};

export default tallyValidationService;

/**
 * The path of every unit a run would review — asked of the eval
 * layer's own discovery, so coverage counts what a run actually
 * covers rather than a second guess at it.
 */
function targetPaths(cfg: PraxisConfig): string[] {
  const domains = discoverDomainsService(cfg, {});

  return domains.flatMap((domain) => resolveUnitsService(cfg, { domain }).map((unit) => unit.path));
}
