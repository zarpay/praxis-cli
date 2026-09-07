import type { GateAssessment, Service } from "@/types.js";

import curatorSystemPrompt from "@/prompts/curator-system-prompt.js";
import gateQuestion from "@/prompts/gate-question.js";
import gateTools from "@/prompts/gate-tools.js";
import triageAxiomLine from "@/prompts/triage-axiom-line.js";
import requestCuratorCompletionService from "@/services/request-curator-completion-service.js";

/** One candidate axiom for the authoring gate. */
interface AssessAxiomGateInput {
  statement: string;
  violatingExample: string;
  compliantExample: string;
  /** The taxonomy on record — active and proposed — for the duplication check. */
  existing: { id: string; statement: string }[];
}

/**
 * The authoring gate: one candidate axiom, one assessment —
 * appropriate, not_appropriate, or split with the judgment half
 * redrafted — plus the duplication check: a candidate whose
 * remediation an existing axiom already carries names it in
 * `duplicateOf`, so the evidence folds instead of splitting into a
 * twin. Advisory by design: the caller shows it to a human.
 *
 * Fail-safe directions: an unrecognized wire assessment reads as
 * `not_appropriate` (the gate refuses, never admits), and a
 * `duplicate_of` naming an id outside the provided taxonomy reads as
 * null (a hallucinated id must never redirect evidence).
 */
const assessAxiomGateService: Service<AssessAxiomGateInput, Promise<GateAssessment>> = async (
  cfg,
  { statement, violatingExample, compliantExample, existing },
) => {
  const existingAxioms = existing
    .map((axiom) => triageAxiomLine({ id: axiom.id, statement: axiom.statement }))
    .join("\n");

  const completion = await requestCuratorCompletionService(cfg, {
    systemPrompt: curatorSystemPrompt(),
    userPrompt: gateQuestion({ statement, violatingExample, compliantExample, existingAxioms }),
    tools: gateTools(),
  });

  const wire = completion.args as {
    assessment?: string;
    reasoning?: string;
    judgment_half?: string | null;
    duplicate_of?: string | null;
  };

  const assessment =
    wire.assessment === "appropriate" || wire.assessment === "split"
      ? wire.assessment
      : "not_appropriate";

  const knownIds = new Set(existing.map((axiom) => axiom.id));
  const wireDuplicate = wire.duplicate_of ?? null;
  const duplicateOf = wireDuplicate !== null && knownIds.has(wireDuplicate) ? wireDuplicate : null;

  return {
    assessment,
    reasoning: wire.reasoning ?? "",
    judgmentHalf: assessment === "split" ? (wire.judgment_half ?? null) : null,
    duplicateOf,
    usage: completion.usage,
  };
};

export default assessAxiomGateService;
