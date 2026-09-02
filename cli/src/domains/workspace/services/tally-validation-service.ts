import type { StatusReport, TallyValidationInput } from "@/domains/workspace/types.js";

import { VerdictCache } from "@/domains/eval/models/verdict-cache.js";
import cacheIdentity from "@/domains/eval/services/build-cache-identity-service.js";
import listTargetPaths from "@/domains/eval/services/list-target-paths-service.js";
import readVerdictEntry from "@/domains/eval/services/read-verdict-entry-service.js";
import { joinPath } from "@/framework/paths.js";

/**
 * Counts each reviewer's cached verdicts across every spec target.
 *
 * Reads only: no API keys, no reviewing. The targets come from the eval
 * layer's own discovery, so coverage counts what a run would actually
 * reviewer rather than a second guess at it — a file with no cached
 * verdict is "not validated", which is the number that tells you a run
 * is overdue.
 *
 * One row per reviewer, never pooled: reviewers are separate instruments, and
 * averaging them would hide exactly the disagreement worth seeing.
 */
export default function tallyValidation({
  root,
  config,
}: TallyValidationInput): StatusReport["validation"] {
  const targets = listTargetPaths({
    root,
    sources: config.sources,
    specFilePattern: config.specFilePattern,
    absoluteIgnore: config.ignore.map((p) => joinPath(root, p)),
  });

  // One cache namespace per reviewer; the un-namespaced cache when no
  // reviewers are configured at all.
  const readers =
    config.reviewers.length > 0
      ? config.reviewers.map((reviewer) => ({
          reviewer: reviewer.name,
          cache: new VerdictCache({ projectRoot: root, reviewer: cacheIdentity(reviewer) }),
        }))
      : [{ reviewer: null, cache: new VerdictCache({ projectRoot: root }) }];

  return readers.map(({ reviewer, cache }) => {
    const row = {
      reviewer,
      pass: 0,
      warn: 0,
      fail: 0,
      notValidated: 0,
    };

    for (const targetPath of targets) {
      const cached = readVerdictEntry({ cache, targetPath });

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
}
