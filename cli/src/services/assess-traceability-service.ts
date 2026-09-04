import type { Service, TraceabilityAssessment } from "@/types.js";

import curatorSystemPrompt from "@/prompts/curator-system-prompt.js";
import traceabilityQuestion from "@/prompts/traceability-question.js";
import traceabilityTools from "@/prompts/traceability-tools.js";
import requestCuratorCompletionService from "@/services/request-curator-completion-service.js";

/** One proposal to trace against its spec at ratification. */
interface AssessTraceabilityInput {
  /** Project-relative spec path the proposal claims to belong to. */
  specPath: string;
  specContent: string;
  statement: string;
}

/**
 * The ratifier's traceability aid (04): which spec criterion grounds
 * the proposal? Evidence for the human call, never the call itself.
 *
 * Fail-safe direction: a claim of traceability without a grounding
 * location reads as not traceable — a generous reading here corrupts
 * every rate computed under the axiom later.
 */
const assessTraceabilityService: Service<
  AssessTraceabilityInput,
  Promise<TraceabilityAssessment>
> = async (cfg, { specPath, specContent, statement }) => {
  const completion = await requestCuratorCompletionService(cfg, {
    systemPrompt: curatorSystemPrompt(),
    userPrompt: traceabilityQuestion({ specPath, specContent, statement }),
    tools: traceabilityTools(),
  });

  const wire = completion.args as {
    traceable?: boolean;
    grounding?: string | null;
    quoted_basis?: string;
    reasoning?: string;
  };

  const grounding = wire.grounding ?? null;
  const traceable = wire.traceable === true && grounding !== null;

  return {
    traceable,
    grounding: traceable ? grounding : null,
    quotedBasis: wire.quoted_basis ?? "",
    reasoning: wire.reasoning ?? "",
    usage: completion.usage,
  };
};

export default assessTraceabilityService;
