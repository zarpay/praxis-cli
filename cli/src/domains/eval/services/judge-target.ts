import type { Judge } from "@/domains/eval/models/judge.js";
import type { JudgmentTarget } from "@/domains/eval/models/judgment-target.js";
import type { ProviderRequest, ProviderResult } from "@/domains/eval/types.js";

import { PraxisError, errors } from "@/core/errors.js";
import judgeTools from "@/domains/eval/prompts/judge-tools.js";
import systemPrompt from "@/domains/eval/prompts/system-prompt.js";
import validationQuestion from "@/domains/eval/prompts/validation-question.js";
import resolveProvider from "@/domains/eval/services/providers/resolve-provider.js";

/**
 * Obtains one verdict for one target from one judge.
 *
 * Praxis owns the boundary: it resolves the API key, renders the
 * prompts, and materializes the judge's settings; the provider only
 * executes the request. No caching and no state — every call reaches
 * the backend, and the usage comes back with the verdict rather than
 * being stashed for a later read.
 *
 * @param root - Project root, for resolving a `./relative` provider
 * @throws PraxisError when the key is missing, the provider cannot be
 *   resolved, or (wrapped) when the provider itself fails
 */
export default async function judgeTarget(
  target: JudgmentTarget,
  judge: Judge,
  root?: string,
): Promise<ProviderResult> {
  const provider = await resolveProvider(judge.provider, root);

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
    tools: judgeTools(),
    model: judge.model,
    temperature: judge.temperature,
    baseUrl: judge.baseUrl,
    apiKey: judge.apiKey(),
    options: judge.options,
  };

  try {
    return await provider.judge(request);
  } catch (err) {
    if (err instanceof PraxisError) throw err;

    throw errors.judgeProviderFailed(provider.name, (err as Error).message);
  }
}
