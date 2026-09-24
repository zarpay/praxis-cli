import type { NoInput, Orientation, Service } from "@/types.js";

import deriveTriageStateService from "@/services/derive-triage-state-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { RunStore } from "@/stores/run-store.js";

/**
 * The orientation screen's facts: counts and staleness at a
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

  // Configured reviewers only. The ledger remembers every reviewer that
  // ever ran, and reports are right to show them — but this screen is
  // what someone reads returning after a week, and "v32: 6 failing"
  // about a reviewer that no longer exists is an action they cannot
  // take. History belongs to `eval report`; this is current state.
  const configured = new Set(cfg.reviewers.map((reviewer) => reviewer.name));
  const latestCorpusByReviewer = new Map<string, { reviewerName: string; errors: number }>();

  for (const run of runs) {
    if (run.scope !== "corpus") continue;

    if (!configured.has(run.reviewer_name)) continue;

    latestCorpusByReviewer.set(run.reviewer_name, {
      reviewerName: run.reviewer_name,
      errors: run.fail_count,
    });
  }

  const debtLine = latestCorpusByReviewer.size === 0 ? null : [...latestCorpusByReviewer.values()];

  return {
    lastRun,
    pendingTriage: state.pending.length,
    awaitingCuration: state.unidentified.length,
    activeAxioms: axioms.filter((axiom) => axiom.status === "active").length,
    debtLine,
  };
};

export default buildOrientationService;
