import type { Judge } from "@/domains/eval/models/judge.js";
import type { JudgmentTarget } from "@/domains/eval/models/judgment-target.js";
import type { CacheManager } from "@/domains/eval/services/verdict-cache.js";
import type { ProviderRequest, ProviderResult, Verdict } from "@/domains/eval/types.js";

import { PraxisError, errors } from "@/core/errors.js";
import judgeTools from "@/domains/eval/prompts/judge-tools.js";
import systemPrompt from "@/domains/eval/prompts/system-prompt.js";
import validationQuestion from "@/domains/eval/prompts/validation-question.js";
import { resolveProvider } from "@/domains/eval/services/providers/registry.js";

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
export async function judgeTarget(
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

/**
 * A verdict for one target, from cache when the inputs are unchanged.
 *
 * The cache-aware entry point both the full run and single-target
 * judging use, so the read/call/write sequence exists once. `cacheHit`
 * comes back with the verdict rather than being asked for afterwards,
 * and `usage` is null on a hit because nothing was spent.
 *
 * @param cache - Judge-namespaced cache, or null to always call
 * @throws PraxisError from `judgeTarget` on a cache miss
 */
export async function evaluateTarget({
  target,
  judge,
  cache,
  root,
}: {
  target: JudgmentTarget;
  judge: Judge;
  cache: CacheManager | null;
  root?: string;
}): Promise<{ verdict: Verdict; cacheHit: boolean; usage: ProviderResult["usage"] | null }> {
  const contentHash = target.contentHash();

  if (cache) {
    const cached = cache.read({
      targetPath: target.targetPath,
      contentHash,
      specPath: target.specPath,
    });

    if (cached) {
      return { verdict: cached, cacheHit: true, usage: null };
    }
  }

  const { verdict, usage } = await judgeTarget(target, judge, root);

  cache?.write({
    targetPath: target.targetPath,
    contentHash,
    result: verdict,
    metadata: { specPath: target.specPath, ...target.assistProvenance() },
  });

  return { verdict, cacheHit: false, usage };
}
