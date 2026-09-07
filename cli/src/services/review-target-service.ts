import type { PraxisConfig } from "@/models/praxis-config.js";
import type { ReviewSubject } from "@/models/review-subject.js";
import type { Reviewer } from "@/models/reviewer.js";
import type { VerdictStore } from "@/stores/verdict-store.js";
import type {
  Critique,
  ProviderRequest,
  ProviderResult,
  ProviderUsage,
  Service,
  Verdict,
} from "@/types.js";

import { PraxisError, errors } from "@/helpers/errors-helper.js";
import { baseName, parentDir } from "@/helpers/paths-helper.js";
import cohortSubject from "@/prompts/cohort-subject.js";
import contextBlock from "@/prompts/context-block.js";
import contextSection from "@/prompts/context-section.js";
import exemplarBlock from "@/prompts/exemplar-block.js";
import exemplarSection from "@/prompts/exemplar-section.js";
import fileSubject from "@/prompts/file-subject.js";
import reviewTools from "@/prompts/review-tools.js";
import systemPrompt from "@/prompts/system-prompt.js";
import validationQuestion from "@/prompts/validation-question.js";
import resolveProviderService from "@/services/resolve-provider-service.js";

/** One target to review, with the reviewer and cache to do it. */
interface ReviewTargetInput {
  /** What is being reviewed, already resolved. */
  target: ReviewSubject;
  /** The instrument doing the reviewing. */
  reviewer: Reviewer;
  /** Reviewer-namespaced cache, or null to always call the provider. */
  cache: VerdictStore | null;
}

/** A verdict, and how it was obtained. */
interface ReviewTargetResult {
  verdict: Verdict;
  /** Whether it came from cache rather than a provider call. */
  cacheHit: boolean;
  /** Usage from the provider call, or null on a cache hit. */
  usage: ProviderUsage | null;
}

/**
 * A verdict for one target from one reviewer, from cache when the
 * inputs are unchanged.
 *
 * The one entry point both the full run and single-target reviewing
 * use, so the read → call → write sequence exists once. Praxis owns
 * the provider boundary here: it resolves the API key, renders the
 * prompts, and materializes the reviewer's settings; the provider only
 * executes the request. `cacheHit` comes back with the verdict rather
 * than being asked for afterwards, and `usage` is null on a hit
 * because nothing was spent.
 *
 * @param cache - Reviewer-namespaced cache, or null to always call
 * @throws PraxisError when the key is missing, the provider cannot be
 *   resolved, or (wrapped) when the provider itself fails
 */
const reviewTargetService: Service<ReviewTargetInput, Promise<ReviewTargetResult>> = async (
  cfg,
  { target, reviewer, cache },
) => {
  const contentHash = target.contentHash();

  if (cache) {
    const cached = cache.readVerdict({
      targetPath: target.targetPath,
      specPath: target.specPath,
      contentHash,
    });

    if (cached) {
      return { verdict: cached, cacheHit: true, usage: null };
    }
  }

  const { verdict, usage } = await requestVerdict(cfg, target, reviewer);

  if (cache) {
    cache.writeVerdict({
      targetPath: target.targetPath,
      specPath: target.specPath,
      contentHash,
      result: verdict,
      ...target.assistProvenance(),
    });
  }

  return { verdict, cacheHit: false, usage };
};

export default reviewTargetService;

/**
 * One provider call: the reviewer's settings materialized into a
 * request, the prompts rendered, the response normalized. No caching
 * and no state — every call reaches the backend.
 */
async function requestVerdict(
  cfg: PraxisConfig,
  target: ReviewSubject,
  reviewer: Reviewer,
): Promise<ProviderResult> {
  const provider = await resolveProviderService(cfg, { spec: reviewer.provider });

  const request: ProviderRequest = {
    systemPrompt: systemPrompt(),
    userPrompt: renderValidationQuestion(target),
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
      verdict: { ...verdict, issues: normalizeCritiques(verdict.issues) },
      usage,
    };
  } catch (err) {
    if (err instanceof PraxisError) throw err;

    throw errors.reviewProviderFailed(provider.name, (err as Error).message);
  }
}

/**
 * Normalizes provider issues to critiques: every critique is born raw
 * (04 — axioms are taxonomy applied at triage, never review input). A
 * bare string (a custom provider returning v1 issues) normalizes the
 * same way.
 */
function normalizeCritiques(issues: readonly (Critique | string)[]): Critique[] {
  return issues.map((issue) => {
    if (typeof issue === "string") return { text: issue, axiomId: null, axiomVersion: null };

    return { text: issue.text, axiomId: null, axiomVersion: null };
  });
}

/**
 * Composes the reviewer's user prompt for one subject: the validation
 * question filled with the rendered subject frame and the assist
 * sections (each "" when the spec supplies none, so it vanishes).
 */
function renderValidationQuestion(target: ReviewSubject): string {
  const exemplarBlocks = target.assist.exemplars
    .map((file) => exemplarBlock({ path: file.path, content: file.content }))
    .join("\n\n");
  const contextBlocks = target.assist.context
    .map((file) => contextBlock({ path: file.path, content: file.content }))
    .join("\n\n");
  const exemplars =
    target.assist.exemplars.length === 0 ? "" : exemplarSection({ blocks: exemplarBlocks });
  const context =
    target.assist.context.length === 0 ? "" : contextSection({ blocks: contextBlocks });

  return validationQuestion({
    specContent: target.specContent,
    exemplarSection: exemplars,
    contextSection: context,
    subject: renderSubject(target),
    targetContent: target.targetContent,
  });
}

/** The subject frame: per file or per cohort. */
function renderSubject(target: ReviewSubject): string {
  if (target.kind === "cohort") return cohortSubject({ targetPath: target.targetPath });

  const fileName = baseName(target.targetPath);
  const directory = parentDir(target.targetPath);

  return fileSubject({ fileName, directory });
}
