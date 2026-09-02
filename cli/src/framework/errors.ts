/**
 * Global error module: every error Praxis raises is created here.
 *
 * Each factory method owns the message template for one failure mode and
 * takes the values that fill it. Callers `throw errors.<name>(...)` and
 * never build error strings themselves, so wording lives in exactly one
 * place and every raised error carries a machine-readable `code`.
 */

import type { PraxisErrorCode } from "@/framework/types.js";

/**
 * Error type for all failures Praxis itself detects.
 *
 * The `code` field identifies the failure mode independently of the
 * human-readable message, so callers and tests can branch on it
 * without matching message text.
 */
export class PraxisError extends Error {
  readonly code: PraxisErrorCode;

  constructor(code: PraxisErrorCode, message: string) {
    super(message);
    this.name = "PraxisError";
    this.code = code;
  }
}

/**
 * Factory methods for every error Praxis raises.
 *
 * Grouped by area: project structure, config, compiler, then validator.
 */
export const errors = {
  // --- Project structure ---

  /** No `.praxis/` directory found walking up from the starting directory. */
  rootNotFound(): PraxisError {
    return new PraxisError(
      "ROOT_NOT_FOUND",
      "Could not find Praxis root (no .praxis/ directory found)",
    );
  },

  // --- Config ---

  /** `.praxis/config.json` exists but does not parse as JSON. */
  invalidConfigJson(configPath: string, cause: string): PraxisError {
    return new PraxisError("INVALID_CONFIG_JSON", `Invalid JSON in ${configPath}: ${cause}`);
  },

  // --- Compiler ---

  /** Config names a plugin that is not in the registry. */
  unknownPlugin(name: string, available: string[]): PraxisError {
    return new PraxisError(
      "UNKNOWN_PLUGIN",
      `Unknown plugin: "${name}". Available plugins: ${available.join(", ")}`,
    );
  },

  /** `praxis add` would overwrite a file that already exists. */
  fileAlreadyExists(relPath: string): PraxisError {
    return new PraxisError("FILE_ALREADY_EXISTS", `File already exists: ${relPath}`);
  },

  /** The scaffold template for `praxis add` is missing. */
  templateNotFound(templatePath: string): PraxisError {
    return new PraxisError("TEMPLATE_NOT_FOUND", `Template not found: ${templatePath}`);
  },

  /** `praxis compile --alias` was given an alias no expert file declares. */
  expertNotFound(alias: string): PraxisError {
    return new PraxisError("EXPERT_NOT_FOUND", `No expert found with alias: ${alias}`);
  },

  // --- Validator ---

  /** `validate report` was given a path that does not exist. */
  documentNotFound(path: string): PraxisError {
    return new PraxisError("DOCUMENT_NOT_FOUND", `Document not found: ${path}`);
  },

  /** The API key environment variable is unset (command-level, with setup guidance). */
  missingApiKey(envVarName: string): PraxisError {
    return new PraxisError(
      "API_KEY_NOT_SET",
      [
        `Missing ${envVarName} environment variable`,
        "",
        "To use document validation, you need an OpenRouter API key:",
        "  1. Get a key at https://openrouter.ai/keys",
        `  2. Set it: export ${envVarName}=your-key-here`,
      ].join("\n"),
    );
  },

  /** Two reviewers in config share a name. */
  duplicateReviewerName(name: string): PraxisError {
    return new PraxisError(
      "INVALID_REVIEWER_CONFIG",
      `Duplicate reviewer name "${name}" in .praxis/config.json — reviewer names must be unique`,
    );
  },

  /** A configured reviewer omits one of its required fields. */
  reviewerMissingField(name: string, field: string): PraxisError {
    return new PraxisError(
      "INVALID_REVIEWER_CONFIG",
      `Reviewer "${name}" is missing "${field}" — every reviewer needs "name", "model", and "apiKeyEnvVar"`,
    );
  },

  /** A --reviewer filter named a reviewer that is not configured. */
  unknownReviewer(name: string, configured: string[]): PraxisError {
    return new PraxisError(
      "UNKNOWN_REVIEWER",
      `No reviewer named "${name}" — configured reviewers: ${configured.join(", ")}`,
    );
  },

  /** No reviewers are configured (and no legacy validation section exists). */
  missingReviewers(): PraxisError {
    return new PraxisError(
      "REVIEWERS_NOT_CONFIGURED",
      [
        "No reviewers configured in .praxis/config.json",
        "",
        'Add a "reviewers" array to your config:',
        '  "reviewers": [',
        '    { "name": "flash", "model": "deepseek/deepseek-v4-flash-0731", "apiKeyEnvVar": "OPENROUTER_API_KEY" }',
        "  ]",
      ].join("\n"),
    );
  },

  /** A spec declares root-relative scoping globs but the Reviewer was built without a project root. */
  missingProjectRoot(key: string, specPath: string): PraxisError {
    return new PraxisError(
      "MISSING_PROJECT_ROOT",
      `Spec ${specPath} declares "${key}" but no project root was provided to resolve it against`,
    );
  },

  /** A document omits a frontmatter field its kind requires. */
  missingFrontmatterField(key: string, docPath: string): PraxisError {
    return new PraxisError(
      "MISSING_FRONTMATTER_FIELD",
      `${docPath} is missing required frontmatter field "${key}"`,
    );
  },

  /** A frontmatter field holds a value of the wrong shape. */
  invalidFrontmatterField(
    key: string,
    docPath: string,
    expected: string,
    actual: unknown,
  ): PraxisError {
    const shown = typeof actual === "string" ? `"${actual}"` : JSON.stringify(actual);

    return new PraxisError(
      "INVALID_FRONTMATTER_FIELD",
      `Invalid "${key}" in ${docPath} — expected ${expected}, got ${shown}`,
    );
  },

  /** `validate all --type` was given a type no validation domain matches. */
  unknownDocumentType(type: string): PraxisError {
    return new PraxisError("UNKNOWN_DOCUMENT_TYPE", `Unknown document type: ${type}`);
  },

  /** `praxis add` was given a type it has no template for. */
  invalidDocumentType(type: string): PraxisError {
    return new PraxisError(
      "INVALID_DOCUMENT_TYPE",
      `Cannot scaffold "${type}" — praxis add creates experts and practices`,
    );
  },

  /** No spec file matching a literal specFilePattern exists in the document's directory. */
  specNotFound(pattern: string, dir: string, targetPath: string): PraxisError {
    return new PraxisError("SPEC_NOT_FOUND", `No ${pattern} found in ${dir} for ${targetPath}`);
  },

  /** No spec file matching a glob specFilePattern exists in the document's directory. */
  specPatternNotFound(pattern: string, dir: string, targetPath: string): PraxisError {
    return new PraxisError(
      "SPEC_NOT_FOUND",
      `No file matching '${pattern}' found in ${dir} for ${targetPath}`,
    );
  },

  /** The configured API key environment variable has no value. */
  apiKeyNotSet(envVarName: string): PraxisError {
    return new PraxisError("API_KEY_NOT_SET", `${envVarName} environment variable not set`);
  },

  /** The reviewer provider's backend responded with a non-OK HTTP status. */
  reviewerApiError(provider: string, status: number, body: string): PraxisError {
    return new PraxisError(
      "REVIEWER_API_ERROR",
      `Reviewer provider "${provider}" API error (${status}): ${body}`,
    );
  },

  /** A reviewer named a provider that is neither built in nor a ./relative module path. */
  unknownReviewProvider(name: string, available: string[]): PraxisError {
    return new PraxisError(
      "UNKNOWN_REVIEW_PROVIDER",
      `Unknown reviewer provider: "${name}". Built-in providers: ${available.join(", ")}. ` +
        "A custom provider must be a ./relative module path.",
    );
  },

  /** A local provider module could not be imported. */
  reviewProviderLoadFailed(path: string, cause: string): PraxisError {
    return new PraxisError(
      "REVIEW_PROVIDER_LOAD_FAILED",
      `Failed to load reviewer provider "${path}": ${cause}`,
    );
  },

  /** A loaded provider module does not implement the provider contract. */
  invalidReviewProvider(spec: string, problem: string): PraxisError {
    return new PraxisError(
      "INVALID_REVIEW_PROVIDER",
      `Invalid reviewer provider "${spec}": ${problem} — ` +
        "a provider module's default export must be a factory returning { name, review() }",
    );
  },

  /** A provider's review() threw something other than a PraxisError. */
  reviewProviderFailed(provider: string, message: string): PraxisError {
    return new PraxisError(
      "REVIEW_PROVIDER_FAILED",
      `Reviewer provider "${provider}" failed: ${message}`,
    );
  },

  /** The model answered without calling a validation tool. */
  noToolCall(): PraxisError {
    return new PraxisError(
      "NO_TOOL_CALL",
      "Model did not return a tool call. Ensure the configured model supports tool calling.",
    );
  },

  /** The model called a tool outside the three validation tools. */
  unexpectedToolCall(toolName: string): PraxisError {
    return new PraxisError("UNEXPECTED_TOOL_CALL", `Unexpected validation tool call: ${toolName}`);
  },
};
