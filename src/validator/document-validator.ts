import { basename, dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

import yaml from "js-yaml";

import { type CachedValidationResult, CacheManager, contentHash, type Severity } from "./cache-manager.js";
import { SYSTEM_PROMPT } from "./prompts.js";

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

  constructor({
    documentPath,
    specPath,
    useCache = true,
    cacheManager,
  }: {
    documentPath: string;
    specPath?: string;
    useCache?: boolean;
    cacheManager?: CacheManager;
  }) {
    this.documentPath = documentPath;
    this.documentContent = readFileSync(documentPath, "utf-8");
    this.documentType = this.detectDocumentType();
    this.readmePath = specPath ?? this.findReadme();
    this.readmeContent = readFileSync(this.readmePath, "utf-8");
    this.useCache = useCache;
    this.cacheManager = cacheManager ?? (useCache ? new CacheManager() : null);
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
      });

      if (cachedResult) {
        this.wasCacheHit = true;
        this.result = cachedResult;
        return this.result;
      }
    }

    this.wasCacheHit = false;
    const response = await this.callOpenRouter();
    this.result = this.parseResponse(response);

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
   * Calls the OpenRouter API with the validation prompt.
   *
   * @throws Error if OPENROUTER_API_KEY is not set or the API returns an error
   */
  private async callOpenRouter(): Promise<string> {
    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY environment variable not set");
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "x-ai/grok-4.1-fast",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: this.buildValidationQuestion() },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${body}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message?.content ?? "";
  }

  /** Builds the user prompt sent to the LLM for validation. */
  private buildValidationQuestion(): string {
    return `## README SPECIFICATION

The following README defines what documents in this directory should contain.
Use this as your validation criteria:

\`\`\`markdown
${this.readmeContent}
\`\`\`

## DOCUMENT TO VALIDATE

File: ${basename(this.documentPath)}
Directory: ${dirname(this.documentPath)}
Detected Type: ${this.documentType}

\`\`\`markdown
${this.documentContent}
\`\`\`

## VALIDATION TASK

Does this document comply with the README specification?

Check for:
1. All required frontmatter fields mentioned in the README
2. All required sections mentioned in the README
3. Naming conventions described in the README
4. Content expectations described in the README
5. Proper markdown formatting

Answer Yes, Maybe, or No with specific issues found.`;
  }

  /**
   * Parses the LLM response into a structured validation result.
   *
   * Looks for Yes/Maybe/No at the start of the response to determine
   * compliance status and severity.
   */
  private parseResponse(response: string): CachedValidationResult {
    const trimmed = response.trim();
    const firstWord = trimmed.split(/[\s,.:]/)[0]?.toLowerCase() ?? "";

    if (firstWord === "yes") {
      return { compliant: true, issues: [], reason: trimmed };
    }

    const issues = this.parseIssues(trimmed);
    const severity: Severity = firstWord === "maybe" ? "warning" : "error";

    return { compliant: false, issues, reason: trimmed, severity };
  }

  /**
   * Extracts individual issues from the LLM's explanation text.
   *
   * Looks for bullet points or numbered list items.
   */
  private parseIssues(reason: string): string[] {
    const issues: string[] = [];

    for (const line of reason.split("\n")) {
      const trimmedLine = line.trim();
      if (/^[-*•]\s+/.test(trimmedLine) || /^\d+\.\s+/.test(trimmedLine)) {
        issues.push(trimmedLine.replace(/^[-*•\d.]+\s*/, ""));
      }
    }

    return issues.length > 0 ? issues : [reason];
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

  /** Finds the README.md spec file in the document's directory or parent. */
  private findReadme(): string {
    const baseDir = dirname(this.documentPath);
    const readme = join(baseDir, "README.md");
    if (existsSync(readme)) {
      return readme;
    }

    const parentReadme = join(dirname(baseDir), "README.md");
    if (existsSync(parentReadme)) {
      return parentReadme;
    }

    throw new Error(`No README.md found for ${this.documentPath}`);
  }
}
