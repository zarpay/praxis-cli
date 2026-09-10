import type { CritiqueDecision, Service } from "@/types.js";

import { AxiomStore } from "@/stores/axiom-store.js";
import { RunStore } from "@/stores/run-store.js";
import { TriageStore } from "@/stores/triage-store.js";

/** How the listing narrows the ledger's critiques. */
interface BuildCritiquesReportInput {
  /** Project-relative path prefix — a file, or a directory's critiques. */
  target?: string;
  /** Only critiques whose effective label is this axiom. */
  axiom?: string;
  /** Only critiques in this lifecycle state. */
  state?: CritiqueState;
}

/** Where one critique stands in the review→label lifecycle. */
type CritiqueState = "untriaged" | "unmatched" | "labeled" | "dismissed";

/** One critique, with its id, its words, and where it stands. */
interface CritiqueRow {
  id: string;
  runId: string;
  /** When the run that produced it was recorded (ISO). */
  timestamp: string;
  filePath: string;
  specPath: string;
  reviewerName: string;
  severity: string;
  text: string;
  state: CritiqueState;
  /** The effective label, when state is "labeled". */
  axiomId: string | null;
}

/** The listing, with the whole ledger's tallies beside the rows. */
interface CritiquesReport {
  rows: CritiqueRow[];
  /** Every critique in the ledger by state, before filters. */
  totals: Record<CritiqueState, number>;
}

/**
 * The critique listing: every ledger critique with its id, its words,
 * and its lifecycle state — the browsing surface `axioms reassign`
 * works from.
 *
 * State is decided the way every reader decides it, through
 * `TriageStore.decisions()`: a standing dismissal dismisses, a standing
 * assignment labels, a current unmatched record means the curate queue,
 * a stale one or no record means untriaged. Checklist-born critiques
 * (historical inline labels) count as labeled unless superseded.
 */
const buildCritiquesReportService: Service<BuildCritiquesReportInput, CritiquesReport> = (
  cfg,
  { target, axiom, state },
) => {
  const decisions = new TriageStore(cfg).decisions();

  const active = new AxiomStore(cfg).active();
  const activeSet = active.map((entry) => `${entry.id}@${entry.version}`).join(",");

  const totals: Record<CritiqueState, number> = {
    untriaged: 0,
    unmatched: 0,
    labeled: 0,
    dismissed: 0,
  };

  const rows: CritiqueRow[] = [];

  for (const critique of new RunStore(cfg).critiques()) {
    const row = rowFor(critique, decisions.get(critique.id), activeSet);

    totals[row.state]++;

    if (target !== undefined && !row.filePath.startsWith(target)) continue;

    if (axiom !== undefined && row.axiomId !== axiom) continue;

    if (state !== undefined && row.state !== state) continue;

    rows.push(row);
  }

  return { rows, totals };
};

export default buildCritiquesReportService;

/** One ledger critique resolved into its current state. */
function rowFor(
  critique: {
    id: string;
    run_id: string;
    timestamp: string;
    file_path: string;
    spec_path: string;
    reviewer_name: string;
    severity: string;
    text: string;
    axiom_id: string | null;
  },
  decision: CritiqueDecision | undefined,
  activeSet: string,
): CritiqueRow {
  const base = {
    id: critique.id,
    runId: critique.run_id,
    timestamp: critique.timestamp,
    filePath: critique.file_path,
    specPath: critique.spec_path,
    reviewerName: critique.reviewer_name,
    severity: critique.severity,
    text: critique.text,
  };

  if (decision?.dismissed) return { ...base, state: "dismissed", axiomId: null };

  if (decision?.assignment) {
    return { ...base, state: "labeled", axiomId: decision.assignment.axiom_id };
  }

  if (decision?.unmatched) {
    // A stale unmatched verdict re-queues for triage; a current one awaits curation.
    const considered = [...decision.unmatched.considered].sort().join(",");
    const state: CritiqueState = considered === activeSet ? "unmatched" : "untriaged";

    return { ...base, state, axiomId: null };
  }

  // No record: a historical inline label stands; otherwise untriaged.
  if (critique.axiom_id !== null) {
    return { ...base, state: "labeled", axiomId: critique.axiom_id };
  }

  return { ...base, state: "untriaged", axiomId: null };
}
