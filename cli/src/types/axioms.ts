// The axiom taxonomy: lifecycle, drafts, triage suggestions, and
// the curator's assessments.

import type { AxiomFile } from "@/models/axiom-file.js";
import type { ProviderUsage } from "@/types/extension-points.js";
import type { PendingCritique } from "@/types/ledger.js";
import type { Severity, StoreProblem } from "@/types/shared.js";

/** An axiom's lifecycle state: proposed until ratified, never deleted. */
export type AxiomStatus = "proposed" | "active" | "deprecated";

/** How the axiom is evaluated; `agentic` is schema-only until built. */
export type AxiomMode = "judgment" | "agentic";

/** The store's contents, plus what could not be read. */
export interface ListAxiomsResult {
  /** Sorted by introduced date, id as tiebreak — random ids carry no order. */
  axioms: AxiomFile[];
  /** Files that failed validation: reported, never fatal to the sweep. */
  problems: StoreProblem[];
}

/** A draft axiom the curator proposes from a critique cluster. */
export interface AxiomDraft {
  statement: string;
  severity: Severity;
  violatingExample: string;
  compliantExample: string;
  /** The spec passage the curator grounds the draft in — ratification's aid. */
  groundingHint: string;
}

/** What the curator suggests doing with one cluster; a human decides. */
export type TriageSuggestion =
  | { kind: "assign"; axiomId: string }
  | { kind: "propose"; draft: AxiomDraft }
  | { kind: "unassignable"; why: string };

/** One cluster of critiques the curator grouped, with its suggestion. */
export interface TriageCluster {
  critiqueIds: string[];
  rationale: string;
  suggestion: TriageSuggestion;
}

/** The authoring gate's verdict on one candidate axiom. */
export interface GateAssessment {
  assessment: "appropriate" | "not_appropriate" | "split";
  reasoning: string;
  /** On split: the judgment half, redrafted as the admissible statement. */
  judgmentHalf: string | null;
  /** An existing axiom with the same remediation — fold there, never draft a twin. */
  duplicateOf: string | null;
  usage: ProviderUsage | null;
}

/** The curator's spec-traceability aid at ratification. */
export interface TraceabilityAssessment {
  traceable: boolean;
  /** `<spec path>#<section>` when traceable. */
  grounding: string | null;
  /** The spec passage that grounds the axiom, quoted verbatim. */
  quotedBasis: string;
  reasoning: string;
  usage: ProviderUsage | null;
}

/** One spec's pending critiques, ready for the curator to organize. */
export interface OrganizeTriageInput {
  /** Project-relative spec path, as the critiques record it. */
  specPath: string;
  specContent: string;
  critiques: PendingCritique[];
  /** Established axioms the critiques may fold into: id + statement. */
  axioms: { id: string; statement: string }[];
}

/** One critique's labeling outcome, streamed as the pass runs. */
export interface LabelProgressEvent {
  /** Completed calls so far, this event included. */
  done: number;
  /** Critiques the pass will consider (specs with active axioms only). */
  total: number;
  critiqueId: string;
  filePath: string;
  outcome: "labeled" | "unmatched" | "failed";
  /** The axiom labeled under, when outcome is "labeled". */
  axiomId: string | null;
}
