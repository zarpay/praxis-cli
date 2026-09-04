import type { CalibrationCase } from "@/models/calibration-case.js";
import type { Reviewer } from "@/models/reviewer.js";
import type { LedgerCalibrationRecord, ReviewerCalibrationStatus, Service } from "@/types.js";

import { exists, readText } from "@/helpers/files-helper.js";
import { hash8 } from "@/helpers/hash-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import { CalibrationCaseStore } from "@/stores/calibration-case-store.js";
import { CalibrationStore } from "@/stores/calibration-store.js";

/** Whose interpretability is being asked about. */
interface DeriveCalibrationStatusInput {
  reviewers: Reviewer[];
}

/** Per-reviewer status plus the facts every consumer re-derives otherwise. */
interface DeriveCalibrationStatusResult {
  statuses: ReviewerCalibrationStatus[];
  /** True when any reviewer is stale or absent — `status --json`'s poll bit. */
  anyStale: boolean;
}

/**
 * Each reviewer's interpretability state (06-g): **calibrated** when its
 * latest record matches the current reviewer identity, the current case
 * set, and every case's live spec; **stale** when any of those changed
 * under it ("stale = the reviewer changed under you" — and the case set
 * or a governed spec changing is the same event seen from the other
 * side); **absent** when no record exists for the reviewer at all.
 *
 * Pure read: stores and disk, never a model call.
 */
const deriveCalibrationStatusService: Service<
  DeriveCalibrationStatusInput,
  DeriveCalibrationStatusResult
> = (cfg, { reviewers }) => {
  const store = new CalibrationStore(cfg);
  const caseStore = new CalibrationCaseStore(cfg);
  const { cases } = caseStore.all();
  const caseSetHash = caseStore.caseSetHash();

  const statuses = reviewers.map((reviewer) => {
    const latest = store.latestByName(reviewer.name);

    return statusOf(cfg.root, reviewer, latest, cases, caseSetHash);
  });

  const anyStale = statuses.some((status) => status.state !== "calibrated");

  return { statuses, anyStale };
};

export default deriveCalibrationStatusService;

/** One reviewer's state against the frozen set and the live tree. */
function statusOf(
  root: string,
  reviewer: Reviewer,
  latest: LedgerCalibrationRecord | null,
  cases: CalibrationCase[],
  caseSetHash: string,
): ReviewerCalibrationStatus {
  const base = { reviewer: reviewer.name, lastCalibratedAt: latest?.timestamp ?? null };

  if (!latest) {
    return {
      ...base,
      state: "absent",
      detail: "never calibrated — run `praxis calibrate run` once cases exist (06)",
    };
  }

  if (latest.reviewer_hash !== reviewer.hash()) {
    return {
      ...base,
      state: "stale",
      detail: `reviewer identity changed since ${dateOf(latest.timestamp)} — recalibrate`,
    };
  }

  if (latest.case_set_hash !== caseSetHash) {
    return {
      ...base,
      state: "stale",
      detail: `the case set changed since ${dateOf(latest.timestamp)} — recalibrate`,
    };
  }

  const changedSpec = cases.find((currentCase) => liveSpecChanged(root, currentCase));

  if (changedSpec) {
    return {
      ...base,
      state: "stale",
      detail: `${changedSpec.expectation.spec_path} changed since its cases froze it — re-adjudicate or retire them (06)`,
    };
  }

  return {
    ...base,
    state: "calibrated",
    detail: `calibrated ${dateOf(latest.timestamp)}`,
  };
}

/** Whether a case's live spec no longer matches what the case froze. */
function liveSpecChanged(root: string, currentCase: CalibrationCase): boolean {
  const livePath = joinPath(root, currentCase.expectation.spec_path);

  if (!exists(livePath)) return true;

  return hash8(readText(livePath)) !== currentCase.specContentHash();
}

/** The date half of an ISO timestamp, for one-line details. */
function dateOf(timestamp: string): string {
  return timestamp.slice(0, 10);
}
