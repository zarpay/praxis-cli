import type {
  CollectVerdictReportsInput,
  CollectVerdictReportsResult,
} from "@/domains/eval/types.js";

import { Reviewer } from "@/domains/eval/models/reviewer.js";
import { VerdictCache } from "@/domains/eval/models/verdict-cache.js";
import buildVerdictReport from "@/domains/eval/services/build-verdict-report-service.js";
import readVerdictEntry from "@/domains/eval/services/read-verdict-entry-service.js";
import { errors } from "@/framework/errors.js";
import { exists } from "@/framework/files.js";
import { resolvePath } from "@/framework/paths.js";

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
