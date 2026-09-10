// The axiom taxonomy: lifecycle, drafts, triage suggestions, and
// the curator's assessments.

import type { AxiomFile } from "@/models/axiom-file.js";
import type { StoreProblem } from "@/types/shared.js";

/** An axiom's lifecycle state — never deleted. `proposed` is historical: acceptance activates directly. */
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

/** A draft category the curator proposes from a critique cluster. */
export interface AxiomDraft {
  /** Names the recurring issue — never restates the spec's rule. */
  statement: string;
  /** The spec passage the curator grounds the draft in — traceability's aid. */
  groundingHint: string;
}

/** What the curator suggests doing with one cluster; a human decides. */
export type TriageSuggestion =
  | { kind: "assign"; axiomId: string }
  | { kind: "propose"; draft: AxiomDraft }
  | { kind: "hold"; why: string };

/** One cluster of critiques the curator grouped, with its suggestion. */
export interface TriageCluster {
  critiqueIds: string[];
  rationale: string;
  suggestion: TriageSuggestion;
}

/** One critique's labeling outcome, streamed as the pass runs. */
export interface LabelProgressEvent {
  /** Completed calls so far, this event included. */
  done: number;
  /** Critiques the pass will consider (specs with active axioms only). */
  total: number;
  critiqueId: string;
  filePath: string;
  /** The critique's text, for the human watching the stream. */
  text: string;
  outcome: "labeled" | "unmatched" | "failed";
  /** The axiom labeled under, when outcome is "labeled". */
  axiomId: string | null;
}
