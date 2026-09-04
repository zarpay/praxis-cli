import type { NoInput, Orientation, Service } from "@/types.js";

import { Reviewer } from "@/models/reviewer.js";
import deriveCalibrationStatusService from "@/services/derive-calibration-status-service.js";
import deriveTriageStateService from "@/services/derive-triage-state-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { RunStore } from "@/stores/run-store.js";

/**
 * The orientation screen's facts (09-h): counts and staleness at a
 * glance — the entry point for a human returning after a week, and an
 * agent's cheapest situational poll's human twin.
 */
const buildOrientationService: Service<NoInput, Orientation> = (cfg) => {
  const runs = new RunStore(cfg).runs().sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const state = deriveTriageStateService(cfg, {});
  const { axioms } = new AxiomStore(cfg).all();

  const last = runs[runs.length - 1];
  const lastRun =
    last === undefined
      ? null
      : {
          at: last.timestamp,
          reviewerName: last.reviewer_name,
          anchored: last.commit_sha !== null,
        };

  const latestCorpusByReviewer = new Map<string, { reviewerName: string; errors: number }>();

  for (const run of runs) {
    if (run.scope !== "corpus") continue;

    latestCorpusByReviewer.set(run.reviewer_name, {
      reviewerName: run.reviewer_name,
      errors: run.fail_count,
    });
  }

  const debtLine = latestCorpusByReviewer.size === 0 ? null : [...latestCorpusByReviewer.values()];

  const reviewerModels = cfg.reviewers.map((config) => Reviewer.fromConfig(config));
  const calibration = deriveCalibrationStatusService(cfg, { reviewers: reviewerModels });

  return {
    lastRun,
    pendingTriage: state.pending.length,
    proposalsPending: axioms.filter((axiom) => axiom.status === "proposed").length,
    activeAxioms: axioms.filter((axiom) => axiom.status === "active").length,
    calibration: calibration.banner,
    debtLine,
  };
};

export default buildOrientationService;
