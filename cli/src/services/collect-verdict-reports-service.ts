import type { CollectVerdictReportsInput, CollectVerdictReportsResult, Service } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { exists } from "@/helpers/files-helper.js";
import { resolvePath } from "@/helpers/paths-helper.js";
import { Reviewer } from "@/models/reviewer.js";
import buildVerdictReportService from "@/services/build-verdict-report-service.js";
import { VerdictStore } from "@/stores/verdict-store.js";

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
const collectVerdictReportsService: Service<
  CollectVerdictReportsInput,
  CollectVerdictReportsResult
> = (config, { targetPath }) => {
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
      report: buildVerdictReportService(config, {
        targetPath: absolutePath,
        cacheData: new VerdictStore(config, {
          reviewer: Reviewer.fromConfig(reviewer).cacheIdentity(),
        }).readEntry({ targetPath: absolutePath }),
      }),
    })),
  };
};

export default collectVerdictReportsService;
