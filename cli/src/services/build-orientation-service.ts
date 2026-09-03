import type { BuildDebtReportInput, Orientation } from "@/types.js";

import { CALIBRATION_STATUS } from "@/helpers/metrics-helper.js";
import { AxiomStore } from "@/models/axiom-store.js";
import { Ledger } from "@/models/ledger.js";

/**
 * The orientation screen's facts (09-h): counts and staleness at a
 * glance — the entry point for a human returning after a week, and an
 * agent's cheapest situational poll's human twin.
 */
export default function buildOrientation({ root }: BuildDebtReportInput): Orientation {
  const ledger = new Ledger({ projectRoot: root });
  const runs = ledger.runs().sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const state = ledger.triageState();
  const { axioms } = new AxiomStore({ projectRoot: root }).all();

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

  return {
    lastRun,
    pendingTriage: state.pending.length,
    proposalsPending: axioms.filter((axiom) => axiom.status === "proposed").length,
    activeAxioms: axioms.filter((axiom) => axiom.status === "active").length,
    calibration: CALIBRATION_STATUS,
    debtLine,
  };
}
