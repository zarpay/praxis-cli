import type {
  AssistInputs,
  JudgeConfig,
  ProviderRequest,
  ProviderResult,
  ProviderUsage,
  Verdict,
} from "@/types.js";

import fg from "fast-glob";

import {
  DEFAULT_JUDGE_BASE_URL,
  DEFAULT_JUDGE_PROVIDER,
  DEFAULT_JUDGE_TEMPERATURE,
  DEFAULT_SPEC_FILE_PATTERN,
} from "@/core/config.js";
import { PraxisError, errors } from "@/core/errors.js";
import { exists, readText } from "@/core/files.js";
import { joinPath, parentDir } from "@/core/paths.js";
import { hasGlobChars } from "@/core/spec-pattern.js";
import judgeTools from "@/domains/eval/prompts/judge-tools.js";
import systemPrompt from "@/domains/eval/prompts/system-prompt.js";
import validationQuestion from "@/domains/eval/prompts/validation-question.js";
import { cacheIdentity } from "@/domains/eval/services/judge-hash.js";
import {
  assistFileRecords,
  assistHashInput,
  resolveAssistInputs,
} from "@/domains/eval/services/judgment-input.js";
import { resolveProvider } from "@/domains/eval/services/providers/registry.js";
import { CacheManager, contentHash } from "@/domains/eval/services/verdict-cache.js";

/**
 * AI-powered judge.
 *
 * Judges a target against the spec file for its directory (or an
 * explicitly provided spec) through the judge's configured provider
 * (default: OpenRouter), which returns a normalized verdict with
 * compliance status, issues, and severity — plus usage accounting.
 *
 * Supports caching: if a valid cached result exists for the current
 * content hash (document + spec), it is returned without an API call.
 */
export class Judge {
  /** Path of the document under validation. */
  readonly targetPath: string;
  /** Path of the spec the document is validated against. */
  readonly specPath: string;
  /** Document content as read at construction time. */
  readonly targetContent: string;
  /** Spec content as read at construction time. */
  readonly specContent: string;

  private result: Verdict | null = null;
  private readonly cacheManager: CacheManager | null;
  private wasCacheHit = false;
  private lastUsageValue: ProviderUsage | null = null;
  private readonly config?: JudgeConfig;

  /** Project root the spec's scoping globs (exemplars:/context:) resolve against. */
  private readonly root?: string;
  /** The spec's resolved assist inputs: exemplars and context files. */
  private readonly assist: AssistInputs;

  private readonly specFilePattern: string;

  /** Whether the target is one file or a pre-assembled cohort of files. */
  private readonly kind: "file" | "cohort";

  constructor({
    targetPath,
    targetContent,
    kind = "file",
    specPath,
    specFilePattern = DEFAULT_SPEC_FILE_PATTERN,
    useCache = true,
    cacheManager,
    config,
    root,
  }: {
    targetPath: string;
    /** Pre-assembled judgment input (cohorts); read from targetPath when omitted. */
    targetContent?: string;
    kind?: "file" | "cohort";
    specPath?: string;
    specFilePattern?: string;
    useCache?: boolean;
    cacheManager?: CacheManager;
    /** The judge configuration to invoke; required for validate() to reach the API. */
    config?: JudgeConfig;
    /** Project root; required when the spec declares scoping globs. */
    root?: string;
  }) {
    this.targetPath = targetPath;
    this.targetContent = targetContent ?? readText(targetPath);
    this.kind = kind;
    this.specFilePattern = specFilePattern;
    this.specPath = specPath ?? this.findSpec();
    this.specContent = readText(this.specPath);
    this.root = root;
    this.assist = resolveAssistInputs({
      specContent: this.specContent,
      specPath: this.specPath,
      root,
    });
    this.config = config;
    this.cacheManager =
      cacheManager ??
      (useCache ? new CacheManager({ judge: config && cacheIdentity(config) }) : null);
  }

  /** Whether the last validate() call returned a cached result. */
  get cacheHit(): boolean {
    return this.wasCacheHit;
  }

  /**
   * Usage from the last real provider call, or null after a cache hit
   * (nothing was spent). The ledger's read point (05).
   */
  get lastUsage(): ProviderUsage | null {
    return this.lastUsageValue;
  }

  /** Computes the cache-invalidation hash over the full judgment input (target + spec + assist). */
  getContentHash(): string {
    return contentHash(this.targetContent, this.specContent, assistHashInput(this.assist));
  }

  /**
   * Validates the document against its specification.
   *
   * Checks the cache first; on miss, calls the OpenRouter API and
   * caches the result.
   *
   * @returns Structured validation result
   */
  async validate(): Promise<Verdict> {
    this.lastUsageValue = null;

    if (this.cacheManager) {
      const hash = this.getContentHash();
      const cachedResult = this.cacheManager.read({
        targetPath: this.targetPath,
        contentHash: hash,
        specPath: this.specPath,
      });

      if (cachedResult) {
        this.wasCacheHit = true;
        this.result = cachedResult;
        return this.result;
      }
    }

    this.wasCacheHit = false;
    this.result = await this.callProvider();

    if (this.cacheManager && this.result) {
      this.cacheManager.write({
        targetPath: this.targetPath,
        contentHash: this.getContentHash(),
        result: this.result,
        metadata: {
          specPath: this.specPath,
          exemplarFiles: assistFileRecords(this.assist.exemplars),
          contextFiles: assistFileRecords(this.assist.context),
        },
      });
    }

    return this.result;
  }

  /**
   * Resolves the judge's provider and obtains one verdict through it.
   *
   * Praxis owns the boundary: it resolves the API key from the
   * environment, renders the prompts, and materializes defaults; the
   * provider only executes the request. Usage from the result is kept
   * for lastUsage.
   *
   * @throws PraxisError when config or the key is missing, when the
   *   provider cannot be resolved, or (wrapped) when the provider fails
   */
  private async callProvider(): Promise<Verdict> {
    const config = this.config;

    if (!config) {
      throw errors.missingJudges();
    }

    const apiKey = process.env[config.apiKeyEnvVar];

    if (!apiKey) {
      throw errors.apiKeyNotSet(config.apiKeyEnvVar);
    }

    const provider = await resolveProvider(config.provider ?? DEFAULT_JUDGE_PROVIDER, this.root);

    const request: ProviderRequest = {
      systemPrompt: systemPrompt(),
      userPrompt: validationQuestion({
        specContent: this.specContent,
        targetContent: this.targetContent,
        targetPath: this.targetPath,
        kind: this.kind,
        exemplars: this.assist.exemplars,
        context: this.assist.context,
      }),
      tools: judgeTools(),
      model: config.model,
      temperature: config.temperature ?? DEFAULT_JUDGE_TEMPERATURE,
      baseUrl: config.baseUrl ?? DEFAULT_JUDGE_BASE_URL,
      apiKey,
      options: config.options ?? {},
    };

    let result: ProviderResult;

    try {
      result = await provider.judge(request);
    } catch (err) {
      if (err instanceof PraxisError) throw err;

      throw errors.judgeProviderFailed(provider.name, (err as Error).message);
    }

    this.lastUsageValue = result.usage;
    return result.verdict;
  }

  /** Finds the spec file in the document's directory using the configured pattern. */
  private findSpec(): string {
    const baseDir = parentDir(this.targetPath);

    if (!hasGlobChars(this.specFilePattern)) {
      const specPath = joinPath(baseDir, this.specFilePattern);

      if (exists(specPath)) return specPath;

      throw errors.specNotFound(this.specFilePattern, baseDir, this.targetPath);
    }

    const matches = fg.sync(this.specFilePattern, {
      cwd: baseDir,
      onlyFiles: true,
      absolute: true,
    });

    if (matches.length > 0) return matches[0];

    throw errors.specPatternNotFound(this.specFilePattern, baseDir, this.targetPath);
  }
}
