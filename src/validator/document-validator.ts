import { basename, dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

import fg from "fast-glob";
import yaml from "js-yaml";

import { DEFAULT_SPEC_FILE_PATTERN } from "@/core/config.js";

import {
  type CachedValidationResult,
  CacheManager,
  contentHash,
} from "./cache-manager.js";
import { SYSTEM_PROMPT, VALIDATION_TOOLS } from "./prompts.js";
import { hasGlobChars } from "./spec-pattern.js";

/** Known document types within the Praxis content structure. */
export type DocumentType =
  | "role"
  | "responsibility"
  | "reference"
  | "convention"
  | "constitution"
  | "template"
  | "unknown";

/**
 * AI-powered document validator using the OpenRouter API.
 *
 * Validates a Praxis document against the README specification in its
 * directory. Uses the Grok model via OpenRouter to evaluate compliance,
 * returning structured results with compliance status, issues, and severity.
 *
 * Supports caching: if a valid cached result exists for the current
 * content hash (document + readme), it is returned without making an API call.
 */
export class DocumentValidator {
  readonly documentPath: string;
  readonly readmePath: string;
  readonly documentContent: string;
  readonly readmeContent: string;
  readonly documentType: DocumentType;

  private result: CachedValidationResult | null = null;
  private readonly useCache: boolean;
  private readonly cacheManager: CacheManager | null;
  private wasCacheHit = false;
  private readonly apiKeyEnvVar?: string;
  private readonly model?: string;

  private readonly specFilePattern: string;

  constructor({
    documentPath,
    specPath,
    specFilePattern = DEFAULT_SPEC_FILE_PATTERN,
    useCache = true,
    cacheManager,
    apiKeyEnvVar,
    model,
  }: {
    documentPath: string;
    specPath?: string;
    specFilePattern?: string;
    useCache?: boolean;
    cacheManager?: CacheManager;
    apiKeyEnvVar?: string;
    model?: string;
  }) {
    this.documentPath = documentPath;
    this.documentContent = readFileSync(documentPath, "utf-8");
    this.documentType = this.detectDocumentType();
    this.specFilePattern = specFilePattern;
    this.readmePath = specPath ?? this.findSpec();
    this.readmeContent = readFileSync(this.readmePath, "utf-8");
    this.useCache = useCache;
    this.cacheManager = cacheManager ?? (useCache ? new CacheManager() : null);
    this.apiKeyEnvVar = apiKeyEnvVar;
    this.model = model;
  }

  /** Whether the last validate() call returned a cached result. */
  get cacheHit(): boolean {
    return this.wasCacheHit;
  }

  /** Computes a content hash for cache invalidation (SHA256 of doc+readme, first 8 chars). */
  getContentHash(): string {
    return contentHash(this.documentContent, this.readmeContent);
  }

  /**
   * Validates the document against its README specification.
   *
   * Checks the cache first; on miss, calls the OpenRouter API.
   * Caches the result on API call completion.
   *
   * @returns Structured validation result
   */
  async validate(): Promise<CachedValidationResult> {
    if (this.cacheManager) {
      const hash = this.getContentHash();
      const cachedResult = this.cacheManager.read({
        documentPath: this.documentPath,
        contentHash: hash,
        specPath: this.readmePath,
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
        documentPath: this.documentPath,
        contentHash: this.getContentHash(),
        result: this.result,
        metadata: {
          documentType: this.documentType,
          specPath: this.readmePath,
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
  private async callOpenRouter(): Promise<CachedValidationResult> {
    const envVarName = this.apiKeyEnvVar;
    if (!envVarName) {
      throw new Error(
        "Validation requires 'apiKeyEnvVar' to be configured. " +
          "Add a 'validation' section to .praxis/config.json with 'apiKeyEnvVar' and 'model'.",
      );
    }

    const apiKey = process.env[envVarName];
    if (!apiKey) {
      throw new Error(`${envVarName} environment variable not set`);
    }

    const modelName = this.model;
    if (!modelName) {
      throw new Error(
        "Validation requires 'model' to be configured. " +
          "Add a 'validation' section to .praxis/config.json with 'apiKeyEnvVar' and 'model'.",
      );
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
        tools: VALIDATION_TOOLS,
        tool_choice: "required",
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${body}`);
    }

    interface ToolCall {
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }
    interface OpenRouterResponse {
      choices: Array<{
        message: { role: string; content: string | null; tool_calls?: ToolCall[] };
      }>;
    }

    const data = (await response.json()) as OpenRouterResponse;
    const toolCall = data.choices[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error(
        "Model did not return a tool call. Ensure the configured model supports tool calling.",
      );
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
        throw new Error(`Unexpected validation tool call: ${toolCall.function.name}`);
    }
  }

  /** Builds the user prompt sent to the LLM for validation. */
  private buildValidationQuestion(): string {
    return `## SPECIFICATION

\`\`\`
${this.readmeContent}
\`\`\`

## FILE TO VALIDATE

File: ${basename(this.documentPath)}
Directory: ${dirname(this.documentPath)}

\`\`\`
${this.documentContent}
\`\`\``;
  }

  /** Detects the document type from frontmatter or path inference. */
  private detectDocumentType(): DocumentType {
    if (basename(this.documentPath).startsWith("_")) {
      return "template";
    }

    const frontmatter = this.extractFrontmatter();

    const type = frontmatter["type"] as string | undefined;
    switch (type) {
      case "role":
        return "role";
      case "responsibility":
        return "responsibility";
      case "reference":
        return "reference";
      case "convention":
        return "convention";
      case "constitution":
        return "constitution";
      default:
        return this.inferTypeFromPath();
    }
  }

  /** Infers document type from its filesystem path. */
  private inferTypeFromPath(): DocumentType {
    if (this.documentPath.includes("/roles/")) return "role";
    if (this.documentPath.includes("/responsibilities/")) return "responsibility";
    if (this.documentPath.includes("/reference/")) return "reference";
    if (this.documentPath.includes("/conventions/")) return "convention";
    if (this.documentPath.includes("/constitution/")) return "constitution";
    return "unknown";
  }

  /** Extracts and parses YAML frontmatter from the document content. */
  private extractFrontmatter(): Record<string, unknown> {
    if (!this.documentContent.startsWith("---\n")) {
      return {};
    }

    const endIndex = this.documentContent.indexOf("\n---", 4);
    if (endIndex === -1) {
      return {};
    }

    try {
      const yamlStr = this.documentContent.slice(4, endIndex);
      return (yaml.load(yamlStr) as Record<string, unknown>) ?? {};
    } catch {
      return {};
    }
  }

  /** Finds the spec file in the document's directory using the configured pattern. */
  private findSpec(): string {
    const baseDir = dirname(this.documentPath);

    if (!hasGlobChars(this.specFilePattern)) {
      const specPath = join(baseDir, this.specFilePattern);
      if (existsSync(specPath)) return specPath;
      throw new Error(`No ${this.specFilePattern} found in ${baseDir} for ${this.documentPath}`);
    }

    const matches = fg.sync(this.specFilePattern, {
      cwd: baseDir,
      onlyFiles: true,
      absolute: true,
    });

    if (matches.length > 0) return matches[0];
    throw new Error(
      `No file matching '${this.specFilePattern}' found in ${baseDir} for ${this.documentPath}`,
    );
  }
}
