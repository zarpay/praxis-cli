/**
 * The project's single home for types and interfaces.
 *
 * Every type and interface lives here (ESLint-enforced: declarations
 * are banned elsewhere in src/), organized by domain from foundations
 * to surfaces. Classes, constants, and functions stay in their modules
 * — this file declares shapes, never behavior. The only imports are
 * type-only references to classes (erased at runtime), so any module
 * in any layer may import from `@/types.js`.
 *
 * One deliberate exception lives elsewhere: `core/files.ts` re-exports
 * node's `FSWatcher` type, because `node:fs` imports are walled into
 * that module.
 */

import type { PraxisConfig } from "@/core/config.js";
import type { Display } from "@/views/display.js";
import type { Logger } from "@/views/logger.js";

// ---------------------------------------------------------------------------
// Terminal output (views/)
// ---------------------------------------------------------------------------

/** Chalk styles a Display entry may name. */
export type LineColor = "green" | "yellow" | "red" | "blue" | "cyan" | "gray" | "dim" | "bold";

/** A line of text, optionally styled as a whole. */
export interface TextEntry {
  text: string;
  color?: LineColor;
}

/** A colored `[LABEL]` badge, optionally followed by a value and indented. */
export interface BadgeEntry {
  badge: string;
  color: LineColor;
  value?: string | number;
  indent?: number;
}

/** A title between two divider lines. */
export interface HeaderEntry {
  header: string;
  char?: string;
  width?: number;
}

/**
 * One renderable entry: a plain string, a structured entry, or a falsy
 * value to skip — so conditional entries inline naturally
 * (`count > 0 && { badge: ... }`).
 */
export type DisplayEntry = string | TextEntry | BadgeEntry | HeaderEntry | null | false | undefined;

// ---------------------------------------------------------------------------
// Errors (core/errors.ts)
// ---------------------------------------------------------------------------

/** Machine-readable code, one per factory method on `errors`. */
export type PraxisErrorCode =
  | "ROOT_NOT_FOUND"
  | "INVALID_CONFIG_JSON"
  | "UNKNOWN_PLUGIN"
  | "UNKNOWN_DOCUMENT_TYPE"
  | "FILE_ALREADY_EXISTS"
  | "TEMPLATE_NOT_FOUND"
  | "SPEC_NOT_FOUND"
  | "MISSING_PROJECT_ROOT"
  | "MISSING_FRONTMATTER_FIELD"
  | "INVALID_FRONTMATTER_FIELD"
  | "EXPERT_NOT_FOUND"
  | "DOCUMENT_NOT_FOUND"
  | "INVALID_JUDGE_CONFIG"
  | "UNKNOWN_JUDGE"
  | "JUDGES_NOT_CONFIGURED"
  | "API_KEY_NOT_SET"
  | "JUDGE_API_ERROR"
  | "UNKNOWN_JUDGE_PROVIDER"
  | "JUDGE_PROVIDER_LOAD_FAILED"
  | "INVALID_JUDGE_PROVIDER"
  | "JUDGE_PROVIDER_FAILED"
  | "NO_TOOL_CALL"
  | "UNEXPECTED_TOOL_CALL";

// ---------------------------------------------------------------------------
// Configuration (core/config.ts)
// ---------------------------------------------------------------------------

/** Normalized plugin configuration entry. */
export interface PluginConfigEntry {
  /** Plugin identifier (e.g. "claude-code"). */
  name: string;
  /** Full path to plugin output dir, resolved against project root. */
  outputDir?: string;
  /** Name used in the Claude Code plugin.json file. Default: "praxis". */
  claudeCodePluginName?: string;
}

/** Raw plugin entry as it appears in config JSON. */
export type RawPluginEntry = string | PluginConfigEntry;

/**
 * One configured judge: a named inference backend that evaluates
 * targets against specs. Every configured judge evaluates every
 * target — n judges are n instruments running the same protocol.
 */
export interface JudgeConfig {
  /** Unique judge name; identifies its verdicts in results and reports. */
  name: string;
  /** Model identifier the backend understands (e.g. an OpenRouter slug). */
  model: string;
  /** Name of the environment variable holding the backend's API key. */
  apiKeyEnvVar: string;
  /** OpenAI-compatible endpoint base; defaults to OpenRouter. */
  baseUrl?: string;
  /** Sampling temperature for judgments; defaults to 0. */
  temperature?: number;
  /**
   * Provider that executes judgments: a built-in registry name, or a
   * ./relative ESM module path resolved from the project root whose
   * default export is a provider factory. Defaults to "openrouter".
   */
  provider?: string;
  /** Free-form settings passed through to the provider verbatim. */
  options?: Record<string, unknown>;
}

/** Config shape as it may appear on disk (all fields optional). */
export interface RawConfig {
  agentProfilesOutputDir?: string | false;
  plugins?: RawPluginEntry[];
  sources?: string[];
  ignore?: string[];
  expertsDir?: string;
  practicesDir?: string;
  judges?: Partial<JudgeConfig>[];
  /** Filename or glob pattern for spec files (default: "README.md"). */
  specFilePattern?: string;
}

/** Config shape after defaults are applied. */
export interface NormalizedConfig {
  agentProfilesOutputDir: string | false;
  plugins: PluginConfigEntry[];
  sources: string[];
  ignore: string[];
  expertsDir: string;
  practicesDir: string;
  judges: JudgeConfig[];
  specFilePattern: string;
}

// ---------------------------------------------------------------------------
// Base classes (core/base.ts)
// ---------------------------------------------------------------------------

/** Shared plumbing every Praxis class accepts: injectable output surfaces. */
export interface PraxisBaseOptions {
  logger?: Logger;
  out?: Display;
}

/** Options for classes bound to a Praxis project. */
export interface PraxisProjectBaseOptions extends PraxisBaseOptions {
  /** Project root all paths resolve against. */
  root: string;
  /** Pre-loaded config; resolved lazily from root when omitted. */
  config?: PraxisConfig;
}

/** The reference keys an expert can point at other documents with. */
export type RefKey = "practices" | "context" | "refs";

// ---------------------------------------------------------------------------
// Spec layer (src/spec/)
// ---------------------------------------------------------------------------

/**
 * Metadata extracted from role frontmatter for agent compilation.
 *
 * Used by plugins to generate platform-specific output (e.g. Claude Code
 * frontmatter). The fields map to role frontmatter keys prefixed with `agent_`.
 */
export interface AgentMetadata {
  /** Agent name (lowercase, hyphenated). */
  name: string;
  /** Human-readable description of what the agent does. */
  description: string;
  /** Comma-separated list of allowed tools (e.g. "Read, Glob, Grep"). */
  tools?: string;
  /** Model to use (e.g. "opus"). */
  model?: string;
  /** Permission mode (e.g. "plan"). */
  permissionMode?: string;
  /** Glob patterns for files this profile validates (written as paths: in output). */
  validates: string[];
  /** How validated targets group into evaluation units (written as cohort: in output). */
  cohort?: string;
  /** Glob patterns structurally excluded from judgment (written as excludes: in output). */
  excludes: string[];
  /** Spec-blessed positive examples (written as exemplars: in output). */
  exemplars: string[];
}

/**
 * Interface for output plugins that transform compiled agent profiles
 * into platform-specific formats.
 *
 * Each plugin receives the pure profile markdown and agent metadata,
 * then writes its output to the appropriate location.
 */
export interface CompilerPlugin {
  /** Plugin identifier (e.g. "claude-code"). */
  readonly name: string;

  /**
   * Compiles a pure agent profile into a platform-specific output file.
   *
   * @param profileContent - Pure markdown profile (no plugin-specific frontmatter)
   * @param metadata - Agent metadata from role frontmatter, or null if missing
   * @param alias - The role's alias (used for output file naming)
   */
  compile(profileContent: string, metadata: AgentMetadata | null, alias: string): void;
}

/** Options passed to plugin constructors. */
export interface PluginOptions {
  /** Project root the plugin resolves output paths against. */
  root: string;
  /** Logger for plugin diagnostics. */
  logger: Logger;
  /** Per-plugin configuration from config.json. */
  pluginConfig?: PluginConfigEntry;
}

/** Constructor signature every compiler plugin class must satisfy. */
export type PluginConstructor = new (options: PluginOptions) => CompilerPlugin;

// ---------------------------------------------------------------------------
// Commands (src/commands/)
// ---------------------------------------------------------------------------

/** Content types `praxis add` can scaffold. */
export type AddableType = "expert" | "practice";

/** Options every eval invocation shares. */
export interface EvalInvocationOptions {
  /** Run only this judge (default: all configured judges). */
  judge?: string;
  verbose: boolean;
  cache: boolean;
}

/** Options for a single-target `eval run`. */
export interface DocumentOptions extends EvalInvocationOptions {
  spec?: string;
}

/** Options for a full `eval run`. */
export interface AllOptions extends EvalInvocationOptions {
  type?: string;
  failFast: boolean;
}

/** Structured report of project health. */
export interface StatusReport {
  /**
   * Whether the spec-layer compiler is in use (the experts directory
   * exists). Framework health only surfaces when it is (11): eval-only
   * projects are never asked about a taxonomy they don't have.
   */
  compilerInUse: boolean;
  /** Document counts by content type. */
  counts: {
    experts: number;
    practices: number;
    references: number;
    context: number;
  };
  /**
   * Cached verdict counts across all spec targets, one row per judge —
   * judges are separate instruments and are never silently pooled.
   * Empty when no judges are configured.
   */
  validation: {
    judge: string;
    pass: number;
    warn: number;
    fail: number;
    notValidated: number;
  }[];
  /** Expert files that failed validation, with the reason. */
  invalidExperts: { expert: string; reason: string }[];
  /** Practice files no expert references. */
  orphanedPractices: string[];
  /** Expert references pointing at files that do not exist. */
  danglingRefs: { expert: string; ref: string }[];
  /** Expert files missing the `description` frontmatter field. */
  expertsMissingDescription: string[];
  /** Expert glob references that match no files. */
  zeroMatchGlobs: { expert: string; pattern: string }[];
  /** Practices whose `owner` matches no expert alias. */
  unmatchedOwners: { practice: string; owner: string }[];
}
