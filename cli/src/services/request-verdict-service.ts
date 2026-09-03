import type {
  ChecklistAxiom,
  Critique,
  ProviderRequest,
  ProviderResult,
  RequestVerdictInput,
  Service,
} from "@/types.js";

import { PraxisError, errors } from "@/helpers/errors-helper.js";
import reviewTools from "@/prompts/review-tools.js";
import systemPrompt from "@/prompts/system-prompt.js";
import validationQuestion from "@/prompts/validation-question.js";
import resolveProviderService from "@/services/resolve-provider-service.js";

/**
 * Obtains one verdict for one target from one reviewer.
 *
 * Praxis owns the boundary: it resolves the API key, renders the
 * prompts, and materializes the reviewer's settings; the provider only
 * executes the request. No caching and no state — every call reaches
 * the backend, and the usage comes back with the verdict rather than
 * being stashed for a later read.
 *
 * @throws PraxisError when the key is missing, the provider cannot be
 *   resolved, or (wrapped) when the provider itself fails
 */
const requestVerdictService: Service<RequestVerdictInput, Promise<ProviderResult>> = async (
  config,
  { target, reviewer },
) => {
  const provider = await resolveProviderService(config, { spec: reviewer.provider });

  const request: ProviderRequest = {
    systemPrompt: systemPrompt(),
    userPrompt: validationQuestion({
      specContent: target.specContent,
      targetContent: target.targetContent,
      targetPath: target.targetPath,
      kind: target.kind,
      checklist: target.checklist,
      exemplars: target.assist.exemplars,
      context: target.assist.context,
    }),
    tools: reviewTools(),
    model: reviewer.model,
    temperature: reviewer.temperature,
    baseUrl: reviewer.baseUrl,
    apiKey: reviewer.apiKey(),
    options: reviewer.options,
  };

  try {
    const { verdict, usage } = await provider.review(request);

    return {
      verdict: { ...verdict, issues: normalizeCritiques(verdict.issues, target.checklist) },
      usage,
    };
  } catch (err) {
    if (err instanceof PraxisError) throw err;

    throw errors.reviewProviderFailed(provider.name, (err as Error).message);
  }
};

export default requestVerdictService;

/**
 * Settles each critique's channel against the actual checklist.
 *
 * A cited id that matches a checklist axiom gets that axiom's version —
 * the assignment provenance the ledger records (04-t). A cited id the
 * checklist does not carry is a hallucination and demotes to the open
 * channel: an unratified id must never enter the ledger as an
 * assignment. A bare string (a custom provider still returning v1
 * issues) is an open-channel critique as-is.
 */
function normalizeCritiques(
  issues: readonly (Critique | string)[],
  checklist: readonly ChecklistAxiom[],
): Critique[] {
  const versions = new Map(checklist.map((axiom) => [axiom.id, axiom.version]));

  return issues.map((issue) => {
    if (typeof issue === "string") return { text: issue, axiomId: null, axiomVersion: null };

    const version = issue.axiomId === null ? undefined : versions.get(issue.axiomId);

    if (version === undefined) return { ...issue, axiomId: null, axiomVersion: null };

    return { ...issue, axiomVersion: version };
  });
}
