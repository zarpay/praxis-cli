import type {
  AxiomDraft,
  AxiomScope,
  OrganizeTriageInput,
  Severity,
  TriageCluster,
  TriageOrganization,
  Service,
  TriageSuggestion,
  TriageWireCluster,
} from "@/types.js";

import curatorSystemPrompt from "@/prompts/curator-system-prompt.js";
import triageQuestion from "@/prompts/triage-question.js";
import triageTools from "@/prompts/triage-tools.js";
import requestCuratorCompletionService from "@/services/request-curator-completion-service.js";

/**
 * The curator's organization of one spec's pending critiques (04).
 *
 * Renders the prompts, makes one completion call, and validates the
 * organization defensively: a cluster citing an unknown critique id or
 * an unknown established axiom is demoted to `unassignable` rather than
 * trusted — a curator hallucination must cost human attention, never
 * corrupt an assignment.
 */
const organizeTriageService: Service<OrganizeTriageInput, Promise<TriageOrganization>> = async (
  config,
  input,
) => {
  const completion = await requestCuratorCompletionService(config, {
    systemPrompt: curatorSystemPrompt(),
    userPrompt: triageQuestion(input),
    tools: triageTools(),
  });

  const wire = (completion.args as { clusters?: TriageWireCluster[] }).clusters ?? [];
  const knownCritiques = new Set(input.critiques.map((critique) => critique.id));
  const knownAxioms = new Set(input.axioms.map((axiom) => axiom.id));

  const clusters = wire
    .map((cluster) => normalizeCluster(cluster, knownCritiques, knownAxioms))
    .filter((cluster) => cluster.critiqueIds.length > 0);

  return { clusters, usage: completion.usage };
};

export default organizeTriageService;

/** One wire cluster, validated into the domain shape. */
function normalizeCluster(
  wire: TriageWireCluster,
  knownCritiques: Set<string>,
  knownAxioms: Set<string>,
): TriageCluster {
  const critiqueIds = (wire.critique_ids ?? []).filter((id) => knownCritiques.has(id));
  const rationale = wire.rationale ?? "";

  return { critiqueIds, rationale, suggestion: normalizeSuggestion(wire, knownAxioms) };
}

/** The cluster's suggestion, demoted to unassignable when malformed. */
function normalizeSuggestion(wire: TriageWireCluster, knownAxioms: Set<string>): TriageSuggestion {
  if (wire.suggestion === "assign" && wire.axiom_id && knownAxioms.has(wire.axiom_id)) {
    return { kind: "assign", axiomId: wire.axiom_id };
  }

  if (wire.suggestion === "propose" && wire.draft?.statement) {
    return { kind: "propose", draft: normalizeDraft(wire.draft) };
  }

  return {
    kind: "unassignable",
    why: wire.why_unassignable ?? "The curator's suggestion did not validate.",
  };
}

/** A wire draft with safe defaults for anything the model left thin. */
function normalizeDraft(draft: NonNullable<TriageWireCluster["draft"]>): AxiomDraft {
  const severity: Severity = draft.severity === "warning" ? "warning" : "error";
  const scope: AxiomScope = draft.scope === "file+context" ? "file+context" : "file";

  return {
    statement: draft.statement ?? "",
    severity,
    scope,
    violatingExample: draft.violating_example ?? "(no example drafted)",
    compliantExample: draft.compliant_example ?? "(no example drafted)",
    groundingHint: draft.grounding_hint ?? "",
  };
}
