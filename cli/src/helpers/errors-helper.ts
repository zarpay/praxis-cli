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
  | "EDITOR_FAILED"
  | "FILE_ALREADY_EXISTS"
  | "SPEC_NOT_FOUND"
  | "MISSING_PROJECT_ROOT"
  | "MISSING_FRONTMATTER_FIELD"
  | "INVALID_FRONTMATTER_FIELD"
  | "EXPERT_NOT_FOUND"
  | "DOCUMENT_NOT_FOUND"
  | "INVALID_REVIEWER_CONFIG"
  | "UNKNOWN_REVIEWER"
  | "REVIEWERS_NOT_CONFIGURED"
  | "API_KEY_NOT_SET"
  | "REVIEWER_API_ERROR"
  | "UNKNOWN_REVIEW_PROVIDER"
  | "REVIEW_PROVIDER_LOAD_FAILED"
  | "INVALID_REVIEW_PROVIDER"
  | "REVIEW_PROVIDER_FAILED"
  | "NO_TOOL_CALL"
  | "UNEXPECTED_TOOL_CALL"
  | "AXIOM_NOT_FOUND"
  | "CURATOR_NOT_CONFIGURED"
  | "CURATOR_MISSING_FIELD"
  | "PROVIDER_CANNOT_COMPLETE"
  | "DIFF_BASE_UNRESOLVABLE"
  | "DIFF_BASE_INVALID"
  | "DIFF_OUTSIDE_GIT"
  | "DIFF_WITH_TARGETS"
  | "INVALID_CALIBRATION_CASE"
  | "NOT_A_TTY";

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
 * The failure modes that are usage or configuration errors (09-o):
 * the invocation or the config was wrong, not the work. These exit 2;
 * everything else — runtime failures, project content problems — exits
 * 1 alongside genuine violations.
 */
export const USAGE_ERROR_CODES: ReadonlySet<PraxisErrorCode> = new Set<PraxisErrorCode>([
  "API_KEY_NOT_SET",
  "AXIOM_NOT_FOUND",
  "CURATOR_MISSING_FIELD",
  "CURATOR_NOT_CONFIGURED",
  "DIFF_BASE_INVALID",
  "DIFF_BASE_UNRESOLVABLE",
  "DIFF_OUTSIDE_GIT",
  "DIFF_WITH_TARGETS",
  "DOCUMENT_NOT_FOUND",
  "EXPERT_NOT_FOUND",
  "INVALID_CONFIG_JSON",
  "INVALID_REVIEWER_CONFIG",
  "NOT_A_TTY",
  "PROVIDER_CANNOT_COMPLETE",
  "REVIEWERS_NOT_CONFIGURED",
  "ROOT_NOT_FOUND",
  "UNKNOWN_DOCUMENT_TYPE",
  "UNKNOWN_PLUGIN",
  "UNKNOWN_REVIEWER",
  "UNKNOWN_REVIEW_PROVIDER",
]);

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
      "Not inside a Praxis project (no .praxis/ directory found walking up from here) — " +
        "run `praxis init` at the project root to create one, or cd into an existing project",
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

  /** `praxis compile --alias` was given an alias no expert file declares. */
  expertNotFound(alias: string, available: string[]): PraxisError {
    const known =
      available.length > 0
        ? `known aliases: ${available.join(", ")}`
        : "no expert documents exist yet — create one with `praxis add expert <name>`";

    return new PraxisError("EXPERT_NOT_FOUND", `No expert found with alias "${alias}" — ${known}`);
  },

  // --- Validator ---

  /** `eval verdict` was given a path that does not exist. */
  documentNotFound(path: string): PraxisError {
    return new PraxisError(
      "DOCUMENT_NOT_FOUND",
      `Document not found: ${path} — check the path exists (it resolves against the project root)`,
    );
  },

  /** The API key environment variable is unset (command-level, with setup guidance). */
  missingApiKey(envVarName: string): PraxisError {
    return new PraxisError(
      "API_KEY_NOT_SET",
      [
        `Missing ${envVarName} environment variable`,
        "",
        "To run reviews, the reviewer needs its API key:",
        "  1. Get a key from the provider (OpenRouter: https://openrouter.ai/keys)",
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

  /** A spec declares assist globs but the ReviewSubject was resolved without a project root. */
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

  /** `eval run --type` was given a type no validation domain matches. */
  unknownDocumentType(type: string, available: string[]): PraxisError {
    return new PraxisError(
      "UNKNOWN_DOCUMENT_TYPE",
      `Unknown document type "${type}" — this project has: ${available.join(", ")}`,
    );
  },

  /** `--diff` with no base argument, and no default branch to detect. */
  diffBaseUnresolvable(): PraxisError {
    return new PraxisError(
      "DIFF_BASE_UNRESOLVABLE",
      "No default branch detected (no origin/HEAD, main, or master) — name the base explicitly: praxis eval run --diff <base>",
    );
  },

  /** The named base ref has no merge-base with HEAD. */
  diffBaseInvalid(baseRef: string): PraxisError {
    return new PraxisError(
      "DIFF_BASE_INVALID",
      `No merge-base between "${baseRef}" and HEAD — check the ref exists and shares history (a shallow clone may need \`git fetch --unshallow\`)`,
    );
  },

  /** `--diff` invoked outside a git repository. */
  diffOutsideGit(): PraxisError {
    return new PraxisError(
      "DIFF_OUTSIDE_GIT",
      "praxis eval run --diff measures a branch against its merge-base, which needs a git repository — run it inside one, or review targets directly: praxis eval run <targets...>",
    );
  },

  /** `--diff` combined with named targets — two different units. */
  diffWithTargets(): PraxisError {
    return new PraxisError(
      "DIFF_WITH_TARGETS",
      "--diff reviews what the branch changed; named targets review files. Pick one: praxis eval run --diff [base], or praxis eval run <targets...>",
    );
  },

  /** The configured editor could not be started. */
  editorFailed(editor: string, cause: string): PraxisError {
    return new PraxisError(
      "EDITOR_FAILED",
      `Could not start "${editor}" (${cause}) — praxis config edit uses $VISUAL, then $EDITOR, then vi`,
    );
  },

  /** No spec file matching a literal specFilePattern exists in the document's directory. */
  specNotFound(pattern: string, dir: string, targetPath: string): PraxisError {
    return new PraxisError(
      "SPEC_NOT_FOUND",
      `No ${pattern} found in ${dir} for ${targetPath} — ` +
        `write one there, or point "specFilePattern" in .praxis/config.json at the filename this project uses`,
    );
  },

  /** No spec file matching a glob specFilePattern exists in the document's directory. */
  specPatternNotFound(pattern: string, dir: string, targetPath: string): PraxisError {
    return new PraxisError(
      "SPEC_NOT_FOUND",
      `No file matching '${pattern}' found in ${dir} for ${targetPath} — ` +
        `write one there, or point "specFilePattern" in .praxis/config.json at the filename this project uses`,
    );
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

  // --- Curator ---

  /** Triage, the gate, and audit need a curator; none is configured. */
  curatorNotConfigured(): PraxisError {
    return new PraxisError(
      "CURATOR_NOT_CONFIGURED",
      `No curator configured. The curator organizes triage, runs the authoring gate, and assists ratification — teams typically point it at a frontier model. Add to .praxis/config.json:

  "curator": {
    "model": "<model slug>",
    "apiKeyEnvVar": "OPENROUTER_API_KEY"
  }`,
    );
  },

  /** A declared curator omits a required field. */
  curatorMissingField(field: string): PraxisError {
    return new PraxisError(
      "CURATOR_MISSING_FIELD",
      `The curator entry is missing required field "${field}".`,
    );
  },

  /** The curator's provider implements review() but not complete(). */
  providerCannotComplete(providerName: string): PraxisError {
    return new PraxisError(
      "PROVIDER_CANNOT_COMPLETE",
      `Provider "${providerName}" does not implement complete(), which curator work requires. Use the openrouter provider, or add complete() to the custom provider.`,
    );
  },

  /** An interactive command was run without a terminal and without flags. */
  notATty(command: string, flags: string): PraxisError {
    return new PraxisError(
      "NOT_A_TTY",
      `${command} is interactive and stdin is not a terminal. Script it with ${flags}.`,
    );
  },

  // --- Calibration ---

  /** A case directory under .praxis/calibration/cases/ is malformed. */
  invalidCalibrationCase(caseId: string, problem: string): PraxisError {
    return new PraxisError(
      "INVALID_CALIBRATION_CASE",
      `Calibration case "${caseId}" is malformed: ${problem} — ` +
        "a case directory holds one input file, the frozen spec as spec.md, and expected.json (06)",
    );
  },

  // --- Axioms ---

  /** No axiom in the store carries the requested id. */
  axiomNotFound(id: string): PraxisError {
    return new PraxisError(
      "AXIOM_NOT_FOUND",
      `No axiom "${id}" in .praxis/axioms/. Run \`praxis axioms list\` to see what exists.`,
    );
  },
};
