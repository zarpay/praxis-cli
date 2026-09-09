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
 * The precedence is `TriageStore.decisions()`: a standing dismissal
 * unlabels (a dismissed critique is not evidence), otherwise the newest
 * assignment to an unrejected axiom labels. A historical inline label
 * (a checklist-born record from before the redesign) stands unless a
 * record supersedes it — committed evidence keeps counting.
 */
const joinCritiqueLabelsService: Service<JoinCritiqueLabelsInput, LedgerCritiqueRecord[]> = (
  cfg,
  { critiques },
) => {
  const decisions = new TriageStore(cfg).decisions();

  return critiques.map((critique) => {
    const decision = decisions.get(critique.id);

    if (decision === undefined) return critique;

    if (decision.dismissed) return { ...critique, axiom_id: null, axiom_version: null };

    if (decision.assignment === null) return critique;

    return {
      ...critique,
      axiom_id: decision.assignment.axiom_id,
      axiom_version: decision.assignment.axiom_version,
    };
  });
};

export default joinCritiqueLabelsService;
