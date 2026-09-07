import type { LedgerCritiqueRecord, Service } from "@/types.js";

import { TriageStore } from "@/stores/triage-store.js";

/** The critiques to label, as read from the runs partition. */
interface JoinCritiqueLabelsInput {
  critiques: LedgerCritiqueRecord[];
}

/**
 * The effective label of every critique: critiques
 * are born unlabeled, and labels live in triage assignment records —
 * the matcher's and a human's alike. This join is the ONE place a
 * critique's axiom identity is decided for every reader, fixing the
 * hole where human assignments never counted.
 *
 * Precedence, newest record wins per critique: an assignment labels, a
 * dismissal unlabels. A historical inline label (a checklist-born
 * record from before the redesign) stands unless a record supersedes
 * it — committed evidence keeps counting.
 */
const joinCritiqueLabelsService: Service<JoinCritiqueLabelsInput, LedgerCritiqueRecord[]> = (
  cfg,
  { critiques },
) => {
  const records = new TriageStore(cfg).records();
  const effective = new Map<string, { axiomId: string | null; axiomVersion: number | null }>();

  for (const record of records) {
    if (record.kind === "assignment") {
      effective.set(record.critique_id, {
        axiomId: record.axiom_id,
        axiomVersion: record.axiom_version,
      });
    }

    if (record.kind === "dismissal") {
      effective.set(record.critique_id, { axiomId: null, axiomVersion: null });
    }
  }

  return critiques.map((critique) => {
    const label = effective.get(critique.id);

    if (label === undefined) return critique;

    return { ...critique, axiom_id: label.axiomId, axiom_version: label.axiomVersion };
  });
};

export default joinCritiqueLabelsService;
