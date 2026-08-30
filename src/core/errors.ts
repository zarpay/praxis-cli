/**
 * Global error module: every error Praxis raises is created here.
 *
 * Each factory method owns the message template for one failure mode and
 * takes the values that fill it. Callers `throw errors.<name>(...)` and
 * never build error strings themselves, so wording lives in exactly one
 * place and every raised error carries a machine-readable `code`.
 */

/** Machine-readable code, one per factory method on `errors`. */
export type PraxisErrorCode =
  | "ROOT_NOT_FOUND"
  | "INVALID_CONFIG_JSON"
  | "UNKNOWN_PLUGIN"
  | "UNKNOWN_DOCUMENT_TYPE"
  | "FILE_ALREADY_EXISTS"
  | "TEMPLATE_NOT_FOUND"
  | "SPEC_NOT_FOUND"
  | "EXPERT_NOT_FOUND"
  | "DOCUMENT_NOT_FOUND"
  | "VALIDATION_NOT_CONFIGURED"
  | "API_KEY_NOT_SET"
  | "OPENROUTER_API_ERROR"
  | "NO_TOOL_CALL"
  | "UNEXPECTED_TOOL_CALL";

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

  /** The `validation` config section is absent or incomplete (command-level, with guidance). */
  missingValidationConfig(): PraxisError {
    return new PraxisError(
      "VALIDATION_NOT_CONFIGURED",
      [
        "Missing validation configuration in .praxis/config.json",
        "",
        "Add a 'validation' section to your config:",
        '  "validation": {',
        '    "apiKeyEnvVar": "OPENROUTER_API_KEY",',
        '    "model": "x-ai/grok-4.1-fast"',
        "  }",
      ].join("\n"),
    );
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

  /** `validate all --type` was given a type no validation domain matches. */
  unknownDocumentType(type: string): PraxisError {
    return new PraxisError("UNKNOWN_DOCUMENT_TYPE", `Unknown document type: ${type}`);
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

  /** A required `validation` config field (apiKeyEnvVar or model) is absent. */
  validationNotConfigured(setting: "apiKeyEnvVar" | "model"): PraxisError {
    return new PraxisError(
      "VALIDATION_NOT_CONFIGURED",
      `Validation requires '${setting}' to be configured. ` +
        "Add a 'validation' section to .praxis/config.json with 'apiKeyEnvVar' and 'model'.",
    );
  },

  /** The configured API key environment variable has no value. */
  apiKeyNotSet(envVarName: string): PraxisError {
    return new PraxisError("API_KEY_NOT_SET", `${envVarName} environment variable not set`);
  },

  /** OpenRouter responded with a non-OK HTTP status. */
  openRouterApiError(status: number, body: string): PraxisError {
    return new PraxisError("OPENROUTER_API_ERROR", `OpenRouter API error (${status}): ${body}`);
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
