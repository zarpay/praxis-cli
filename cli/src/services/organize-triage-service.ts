import type {
  AxiomDraft,
  OrganizeTriageInput,
  ProviderUsage,
  Service,
  TriageCluster,
  TriageSuggestion,
} from "@/types.js";

import curatorSystemPrompt from "@/prompts/curator-system-prompt.js";
import triageAxiomLine from "@/prompts/triage-axiom-line.js";
import triageAxiomsFallback from "@/prompts/triage-axioms-fallback.js";
import triageCritiqueLine from "@/prompts/triage-critique-line.js";
import triageQuestion from "@/prompts/triage-question.js";
import triageTools from "@/prompts/triage-tools.js";
import requestCuratorCompletionService from "@/services/request-curator-completion-service.js";

/** The curator's organization of one spec's pending critiques. */
interface TriageOrganization {
  clusters: TriageCluster[];
  usage: ProviderUsage | null;
}

/** The triage tool's wire shape for one cluster, before validation. */
interface TriageWireCluster {
  critique_ids?: string[];
  rationale?: string;
  suggestion?: string;
  axiom_id?: string | null;
  draft?: {
    statement?: string;
    grounding_hint?: string;
  } | null;
  why_held?: string | null;
}

/**
 * The curator's organization of one spec's pending critiques.
 *
 * Renders the prompts, makes one completion call, and validates the
 * organization defensively: a cluster citing an unknown critique id or
 * an unknown established axiom is demoted to `hold` rather than
 * trusted — a curator hallucination must cost human attention, never
 * corrupt an assignment.
 */
const organizeTriageService: Service<OrganizeTriageInput, Promise<TriageOrganization>> = async (
  cfg,
  input,
) => {
  const critiqueLines = input.critiques
    .map((critique) =>
      triageCritiqueLine({
        id: critique.id,
        filePath: critique.filePath,
        reviewerName: critique.reviewerName,
        severity: critique.severity,
        text: critique.text,
      }),
    )
    .join("\n");
  const axiomItems = input.axioms.map((axiom) =>
    triageAxiomLine({ id: axiom.id, statement: axiom.statement }),
  );
  const axiomLines = axiomItems.length === 0 ? triageAxiomsFallback() : axiomItems.join("\n");
  const userPrompt = triageQuestion({
    specPath: input.specPath,
    specContent: input.specContent,
    axiomLines,
    critiqueLines,
  });

  const completion = await requestCuratorCompletionService(cfg, {
    systemPrompt: curatorSystemPrompt(),
    userPrompt,
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

/** The cluster's suggestion, demoted to hold when malformed. */
function normalizeSuggestion(wire: TriageWireCluster, knownAxioms: Set<string>): TriageSuggestion {
  if (wire.suggestion === "assign" && wire.axiom_id && knownAxioms.has(wire.axiom_id)) {
    return { kind: "assign", axiomId: wire.axiom_id };
  }

  if (wire.suggestion === "propose" && wire.draft?.statement) {
    return { kind: "propose", draft: normalizeDraft(wire.draft) };
  }

  return {
    kind: "hold",
    why: wire.why_held ?? "The curator's suggestion did not validate.",
  };
}

/** A wire draft with safe defaults for anything the model left thin. */
function normalizeDraft(draft: NonNullable<TriageWireCluster["draft"]>): AxiomDraft {
  return {
    statement: draft.statement ?? "",
    groundingHint: draft.grounding_hint ?? "",
  };
}
