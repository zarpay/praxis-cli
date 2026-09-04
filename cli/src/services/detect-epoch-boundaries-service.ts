import type { EpochBoundary, LedgerRunRecord, ReviewerConfig, Service } from "@/types.js";

import { Reviewer } from "@/models/reviewer.js";
import { RunStore } from "@/stores/run-store.js";

/** The reviewers a boundary check covers — a run passes its selected subset. */
interface DetectEpochBoundariesInput {
  reviewers: ReviewerConfig[];
}

/**
 * The reviewers whose behavioral hash the ledger has never seen (02).
 *
 * Detection is set-wise, not last-run-wise: contributors on different
 * praxis versions interleave runs under different hashes, and comparing
 * against "the last run" would re-announce known epochs on every
 * alternation. A boundary is a hash absent from the reviewer's entire
 * history. A reviewer with no history at all is bootstrap, not a
 * boundary — a new instrument, not a change to one.
 */
const detectEpochBoundariesService: Service<DetectEpochBoundariesInput, EpochBoundary[]> = (
  cfg,
  { reviewers },
) => {
  const runs = new RunStore(cfg).runs();
  const boundaries: EpochBoundary[] = [];

  for (const reviewerConfig of reviewers) {
    const { name, model, hash } = Reviewer.fromConfig(reviewerConfig).cacheIdentity();
    const history = runs.filter((run) => run.reviewer_name === name);

    if (history.length === 0) continue;

    if (history.some((run) => run.reviewer_hash === hash)) continue;

    const latest = latestRun(history);

    boundaries.push({
      reviewerName: name,
      currentHash: hash,
      currentModel: model,
      previousHash: latest.reviewer_hash,
      previousModel: latest.reviewer_model,
      lastRunTimestamp: latest.timestamp,
    });
  }

  return boundaries;
};

export default detectEpochBoundariesService;

/** The most recent run — what the boundary is named against. */
function latestRun(history: LedgerRunRecord[]): LedgerRunRecord {
  return history.reduce((latest, run) => (run.timestamp > latest.timestamp ? run : latest));
}
