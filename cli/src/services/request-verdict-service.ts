import type { ReviewSubject } from "@/models/review-subject.js";
import type { Reviewer } from "@/models/reviewer.js";
import type { ProviderRequest, ProviderResult } from "@/types.js";

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
 * @param root - Project root, for resolving a `./relative` provider
 * @throws PraxisError when the key is missing, the provider cannot be
 *   resolved, or (wrapped) when the provider itself fails
 */
export default async function requestVerdict(
  target: ReviewSubject,
  reviewer: Reviewer,
  root?: string,
): Promise<ProviderResult> {
  const provider = await resolveProviderService(reviewer.provider, root);

  const request: ProviderRequest = {
    systemPrompt: systemPrompt(),
    userPrompt: validationQuestion({
      specContent: target.specContent,
      targetContent: target.targetContent,
      targetPath: target.targetPath,
      kind: target.kind,
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
    return await provider.review(request);
  } catch (err) {
    if (err instanceof PraxisError) throw err;

    throw errors.reviewProviderFailed(provider.name, (err as Error).message);
  }
}
