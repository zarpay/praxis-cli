import type { AssessAxiomGateInput, GateAssessment } from "@/types.js";

import curatorSystemPrompt from "@/prompts/curator-system-prompt.js";
import gateQuestion from "@/prompts/gate-question.js";
import gateTools from "@/prompts/gate-tools.js";
import requestCuratorCompletionService from "@/services/request-curator-completion-service.js";

/**
 * The authoring gate (03): one candidate axiom, one assessment —
 * appropriate, not_appropriate, or split with the judgment half
 * redrafted. Advisory by design: the caller shows it to a human.
 *
 * An unrecognized wire value reads as `not_appropriate`: the gate's
 * fail-safe direction is refusing a candidate, never admitting one.
 */
export default async function assessAxiomGate({
  root,
  curator,
  statement,
  violatingExample,
  compliantExample,
}: AssessAxiomGateInput): Promise<GateAssessment> {
  const completion = await requestCuratorCompletionService({
    root,
    curator,
    systemPrompt: curatorSystemPrompt(),
    userPrompt: gateQuestion({ statement, violatingExample, compliantExample }),
    tools: gateTools(),
  });

  const wire = completion.args as {
    assessment?: string;
    reasoning?: string;
    judgment_half?: string | null;
  };

  const assessment =
    wire.assessment === "appropriate" || wire.assessment === "split"
      ? wire.assessment
      : "not_appropriate";

  return {
    assessment,
    reasoning: wire.reasoning ?? "",
    judgmentHalf: assessment === "split" ? (wire.judgment_half ?? null) : null,
    usage: completion.usage,
  };
}
