import type { Service } from "@/types.js";

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
 * State is decided the way every reader decides it: the newest triage
 * record per critique wins (an assignment labels, a dismissal
 * dismisses), a current unmatched record means the curate queue, a
 * stale one or no record means untriaged. Checklist-born critiques
 * (historical inline labels) count as labeled unless superseded.
 */
const buildCritiquesReportService: Service<BuildCritiquesReportInput, CritiquesReport> = (
  cfg,
  { target, axiom, state },
) => {
  const records = new TriageStore(cfg).records();
  const latest = new Map<string, { state: CritiqueState; axiomId: string | null }>();
  const unmatchedSets = new Map<string, string>();

  for (const record of records) {
    if (record.kind === "assignment") {
      latest.set(record.critique_id, { state: "labeled", axiomId: record.axiom_id });
    }

    if (record.kind === "dismissal") {
      latest.set(record.critique_id, { state: "dismissed", axiomId: null });
    }

    if (record.kind === "unmatched") {
      latest.set(record.critique_id, { state: "unmatched", axiomId: null });
      unmatchedSets.set(record.critique_id, [...record.considered].sort().join(","));
    }
  }

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
    const decided = latest.get(critique.id);
    const row = rowFor(critique, decided, unmatchedSets.get(critique.id), activeSet);

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
    file_path: string;
    spec_path: string;
    reviewer_name: string;
    severity: string;
    text: string;
    axiom_id: string | null;
  },
  decided: { state: CritiqueState; axiomId: string | null } | undefined,
  unmatchedSet: string | undefined,
  activeSet: string,
): CritiqueRow {
  const base = {
    id: critique.id,
    filePath: critique.file_path,
    specPath: critique.spec_path,
    reviewerName: critique.reviewer_name,
    severity: critique.severity,
    text: critique.text,
  };

  if (decided !== undefined) {
    // A stale unmatched verdict re-queues for triage; anything else stands.
    if (decided.state === "unmatched" && unmatchedSet !== activeSet) {
      return { ...base, state: "untriaged", axiomId: null };
    }

    return { ...base, state: decided.state, axiomId: decided.axiomId };
  }

  // No record: a historical inline label stands; otherwise untriaged.
  if (critique.axiom_id !== null) {
    return { ...base, state: "labeled", axiomId: critique.axiom_id };
  }

  return { ...base, state: "untriaged", axiomId: null };
}
