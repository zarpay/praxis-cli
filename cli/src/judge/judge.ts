import fg from "fast-glob";

import { Frontmatter } from "@/compiler/frontmatter.js";
import { DEFAULT_SPEC_FILE_PATTERN } from "@/core/config.js";
import { errors } from "@/core/errors.js";
import { exists, readText } from "@/core/files.js";
import { baseName, joinPath, parentDir } from "@/core/paths.js";
import { type Verdict, CacheManager, contentHash } from "@/judge/cache-manager.js";
import { SYSTEM_PROMPT, JUDGE_TOOLS } from "@/judge/prompts.js";
import { hasGlobChars } from "@/judge/spec-pattern.js";

/** Known target types within the Praxis content structure. */
export type TargetType =
  "expert" | "practice" | "reference" | "convention" | "constitution" | "template" | "unknown";

/** Target types that can be declared via the `type` frontmatter field. */
const FRONTMATTER_TYPES: readonly TargetType[] = [
  "expert",
  "practice",
  "reference",
  "convention",
  "constitution",
];

/** Deprecated v1 `type:` values, accepted and mapped to their v2 names. */
const LEGACY_TYPES: Record<string, TargetType> = {
  role: "expert",
  responsibility: "practice",
};

/**
 * AI-powered judge using the OpenRouter API.
 *
 * Judges a target against the spec file for its directory
 * (or an explicitly provided spec). The configured model evaluates
 * compliance and reports via a required tool call, producing structured
 * results with compliance status, issues, and severity.
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
  /** Detected type of the document (frontmatter or path-derived). */
  readonly targetType: TargetType;

  private result: Verdict | null = null;
  private readonly useCache: boolean;
  private readonly cacheManager: CacheManager | null;
  private wasCacheHit = false;
  private readonly apiKeyEnvVar?: string;
  private readonly model?: string;

  private readonly specFilePattern: string;

  constructor({
    targetPath,
    specPath,
    specFilePattern = DEFAULT_SPEC_FILE_PATTERN,
    useCache = true,
    cacheManager,
    apiKeyEnvVar,
    model,
  }: {
    targetPath: string;
    specPath?: string;
    specFilePattern?: string;
    useCache?: boolean;
    cacheManager?: CacheManager;
    apiKeyEnvVar?: string;
    model?: string;
  }) {
    this.targetPath = targetPath;
    this.targetContent = readText(targetPath);
    this.targetType = this.detectDocumentType();
    this.specFilePattern = specFilePattern;
    this.specPath = specPath ?? this.findSpec();
    this.specContent = readText(this.specPath);
    this.useCache = useCache;
    this.cacheManager = cacheManager ?? (useCache ? new CacheManager() : null);
    this.apiKeyEnvVar = apiKeyEnvVar;
    this.model = model;
  }

  /** Whether the last validate() call returned a cached result. */
  get cacheHit(): boolean {
    return this.wasCacheHit;
  }

  /** Computes a content hash for cache invalidation (SHA256 of doc+spec, first 8 chars). */
  getContentHash(): string {
    return contentHash(this.targetContent, this.specContent);
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
    this.result = await this.callOpenRouter();

    if (this.cacheManager && this.result) {
      this.cacheManager.write({
        targetPath: this.targetPath,
        contentHash: this.getContentHash(),
        result: this.result,
        metadata: {
          targetType: this.targetType,
          specPath: this.specPath,
        },
      });
    }

    return this.result;
  }

  /**
   * Calls the OpenRouter API and returns a structured validation result via tool call.
   *
   * Sends the spec and file content to the model along with three validation tools.
   * The model is required to call exactly one tool, eliminating text parsing entirely.
   *
   * @throws Error if config is missing, the API returns an error, or the model
   *   does not return a tool call (e.g., the model does not support tool calling).
   */
  private async callOpenRouter(): Promise<Verdict> {
    const envVarName = this.apiKeyEnvVar;

    if (!envVarName) {
      throw errors.validationNotConfigured("apiKeyEnvVar");
    }

    const apiKey = process.env[envVarName];

    if (!apiKey) {
      throw errors.apiKeyNotSet(envVarName);
    }

    const modelName = this.model;

    if (!modelName) {
      throw errors.validationNotConfigured("model");
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: this.buildValidationQuestion() },
        ],
        tools: JUDGE_TOOLS,
        tool_choice: "required",
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw errors.openRouterApiError(response.status, body);
    }

    interface ToolCall {
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }
    interface OpenRouterResponse {
      choices: {
        message: { role: string; content: string | null; tool_calls?: ToolCall[] };
      }[];
    }

    const data = (await response.json()) as OpenRouterResponse;
    const toolCall = data.choices[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw errors.noToolCall();
    }

    const args = JSON.parse(toolCall.function.arguments) as {
      reason: string;
      issues?: string[];
    };
    const { reason, issues = [] } = args;

    switch (toolCall.function.name) {
      case "validation_pass":
        return { compliant: true, issues: [], reason };
      case "validation_warn":
        return { compliant: false, severity: "warning", issues, reason };
      case "validation_fail":
        return { compliant: false, severity: "error", issues, reason };
      default:
        throw errors.unexpectedToolCall(toolCall.function.name);
    }
  }

  /** Builds the user prompt sent to the LLM for validation. */
  private buildValidationQuestion(): string {
    return `## SPECIFICATION

\`\`\`
${this.specContent}
\`\`\`

## FILE TO VALIDATE

File: ${baseName(this.targetPath)}
Directory: ${parentDir(this.targetPath)}

\`\`\`
${this.targetContent}
\`\`\``;
  }

  /**
   * Detects the document type from frontmatter or path inference.
   *
   * Files starting with `_` are templates. Otherwise, the `type`
   * frontmatter field wins when it names a known type; failing that,
   * the type is inferred from the document's directory path.
   */
  private detectDocumentType(): TargetType {
    if (baseName(this.targetPath).startsWith("_")) {
      return "template";
    }

    const type = Frontmatter.fromContent(this.targetContent).value("type");

    if (typeof type === "string") {
      if ((FRONTMATTER_TYPES as string[]).includes(type)) {
        return type as TargetType;
      }

      if (type in LEGACY_TYPES) {
        return LEGACY_TYPES[type];
      }
    }

    return this.inferTypeFromPath();
  }

  /** Infers target type from its filesystem path (legacy dir names included). */
  private inferTypeFromPath(): TargetType {
    if (this.targetPath.includes("/experts/") || this.targetPath.includes("/roles/")) {
      return "expert";
    }

    if (this.targetPath.includes("/practices/") || this.targetPath.includes("/responsibilities/")) {
      return "practice";
    }

    if (this.targetPath.includes("/reference/")) return "reference";

    if (this.targetPath.includes("/conventions/")) return "convention";

    if (this.targetPath.includes("/constitution/")) return "constitution";

    return "unknown";
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
