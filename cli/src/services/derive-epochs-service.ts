import type { DeriveEpochsInput, Epoch, EpochSeries, LedgerRunRecord, Service } from "@/types.js";

/**
 * Epochs, derived — never stored (02): per reviewer name, the maximal
 * intervals of stable behavioral hash, in first-seen order, each with
 * its named opening boundary and its epoch-opening corpus baseline.
 *
 * Derivation is set-wise like detection: runs are grouped by hash, so
 * contributors interleaving known hashes extend their epochs rather
 * than fragmenting them. An epoch's boundary label names what changed
 * against the previously seen epoch — a model swap says so; anything
 * else is config or prompt surface. Rule 6's engine: nothing charts
 * across these boundaries, and each renders as a first-class event.
 */
const deriveEpochsService: Service<DeriveEpochsInput, EpochSeries[]> = (_cfg, { runs }) => {
  const byReviewer = new Map<string, LedgerRunRecord[]>();

  for (const run of [...runs].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    const series = byReviewer.get(run.reviewer_name) ?? [];
    series.push(run);
    byReviewer.set(run.reviewer_name, series);
  }

  return [...byReviewer.entries()].map(([reviewerName, reviewerRuns]) => ({
    reviewerName,
    epochs: epochsOf(reviewerRuns),
  }));
};

export default deriveEpochsService;

/** One reviewer's epochs: grouped by hash, ordered by first appearance. */
function epochsOf(runs: LedgerRunRecord[]): Epoch[] {
  const byHash = new Map<string, LedgerRunRecord[]>();

  for (const run of runs) {
    const epoch = byHash.get(run.reviewer_hash) ?? [];
    epoch.push(run);
    byHash.set(run.reviewer_hash, epoch);
  }

  const epochs: Epoch[] = [];
  let previous: LedgerRunRecord | null = null;

  for (const [hash, epochRuns] of byHash) {
    const first = epochRuns[0];

    epochs.push({
      reviewerHash: hash,
      reviewerModel: first.reviewer_model,
      runs: epochRuns,
      baseline: epochRuns.find((run) => run.baseline) ?? null,
      openedBy: previous === null ? null : boundary(previous, first),
    });

    previous = first;
  }

  return epochs;
}

/** The named event that opened an epoch (07 rule 6: first-class, named). */
function boundary(previous: LedgerRunRecord, first: LedgerRunRecord) {
  const label =
    previous.reviewer_model === first.reviewer_model
      ? "config or prompt surface changed"
      : `model → ${first.reviewer_model}`;

  return { label, at: first.timestamp };
}
