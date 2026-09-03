import type { StatusReport, TallyValidationInput } from "@/types.js";

import { joinPath } from "@/helpers/paths-helper.js";
import { Reviewer } from "@/models/reviewer.js";
import listTargetPathsService from "@/services/list-target-paths-service.js";
import { VerdictStore } from "@/stores/verdict-store.js";

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
  const targets = listTargetPathsService({
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
          cache: new VerdictStore({
            projectRoot: root,
            reviewer: Reviewer.fromConfig(reviewer).cacheIdentity(),
          }),
        }))
      : [{ reviewer: null, cache: new VerdictStore({ projectRoot: root }) }];

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
}
