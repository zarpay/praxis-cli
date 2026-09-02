import type { CollectVerdictReportsInput, CollectVerdictReportsResult } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { exists } from "@/helpers/files-helper.js";
import { resolvePath } from "@/helpers/paths-helper.js";
import { Reviewer } from "@/models/reviewer.js";
import { VerdictCache } from "@/models/verdict-cache.js";
import buildVerdictReport from "@/services/build-verdict-report-service.js";
import readVerdictEntry from "@/services/read-verdict-entry-service.js";

/**
 * What every reviewer last recorded about one target.
 *
 * What `praxis eval verdict` reads. No API call and no key: it reports
 * what is cached, staleness included, so a reader can see a verdict
 * without paying for one.
 *
 * Reviewers are still needed — not to run, but to know which cache
 * namespaces hold their entries.
 *
 * @throws PraxisError when the target does not exist, or no reviewer is
 *   configured to have an opinion about it
 */
export default function collectVerdictReports({
  targetPath,
  root,
  config,
}: CollectVerdictReportsInput): CollectVerdictReportsResult {
  const absolutePath = resolvePath(targetPath);

  if (!exists(absolutePath)) {
    throw errors.documentNotFound(targetPath);
  }

  if (config.reviewers.length === 0) {
    throw errors.missingReviewers();
  }

  return {
    targetPath: absolutePath,
    // Named only when more than one reviewer could disagree.
    named: config.reviewers.length > 1,
    reports: config.reviewers.map((reviewer) => ({
      reviewer: reviewer.name,
      report: buildVerdictReport({
        targetPath: absolutePath,
        cacheData: readVerdictEntry({
          cache: new VerdictCache({
            projectRoot: root,
            reviewer: Reviewer.fromConfig(reviewer).cacheIdentity(),
          }),
          targetPath: absolutePath,
        }),
        specFilePattern: config.specFilePattern,
        root,
      }),
    })),
  };
}
