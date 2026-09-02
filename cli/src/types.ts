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

import type { Command } from "commander";

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

/**
 * One line of a rendered report, naming the channel it belongs to.
 *
 * A report interleaves stderr diagnostics with stdout content — a
 * heading, then the block it introduces — and a view cannot express
 * that with `DisplayEntry` alone, which only describes stdout. This
 * lets a view return the whole report, in order, and leaves the command
 * with nothing to decide.
 */
export type ReportLine =
  /** An [INFO] heading on stderr. */
  | { channel: "heading"; text: string }
  /** A [WARN] heading on stderr, for a block of findings. */
  | { channel: "warning"; text: string }
  /** An [OK] line on stderr. */
  | { channel: "success"; text: string }
  /** Content on stdout. */
  | { channel: "content"; entries: DisplayEntry[] }
  /** A blank separating line on stdout. */
  | { channel: "blank" };

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
 * One configured reviewer: a named inference backend that reviews
 * targets against specs. Every configured reviewer reviews every
 * target — n reviewers are n instruments running the same protocol.
 */
export interface ReviewerConfig {
  /** Unique reviewer name; identifies its verdicts in results and reports. */
  name: string;
  /** Model identifier the backend understands (e.g. an OpenRouter slug). */
  model: string;
  /** Name of the environment variable holding the backend's API key. */
  apiKeyEnvVar: string;
  /** OpenAI-compatible endpoint base; defaults to OpenRouter. */
  baseUrl?: string;
  /** Sampling temperature for reviews; defaults to 0. */
  temperature?: number;
  /**
   * Provider that executes reviews: a built-in registry name, or a
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
  reviewers?: Partial<ReviewerConfig>[];
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
  reviewers: ReviewerConfig[];
  specFilePattern: string;
}

/** How a spec groups its targets into review units. */
export type CohortMode = "by_file" | "by_directory";

// ---------------------------------------------------------------------------
// Commands (commands/)
// ---------------------------------------------------------------------------

/**
 * The one signature every command file has.
 *
 * A command registers itself onto the program and returns nothing —
 * `index.ts` is the only caller. Applied to the exported const rather
 * than annotating a function declaration, so the shape is enforced
 * rather than described, the same way `Orchestrator` is.
 */
export type CommandRegistrar = (program: Command) => void;

/**
 * All an orchestrator hands back to its command.
 *
 * An orchestrator owns its command's whole response — it renders its own
 * views — so the only thing left for the route to decide is the exit
 * code. "failed" is a legitimate non-zero outcome (issues found, verdicts
 * failed), not an error: a genuine error is thrown, and `prepareAction` catches it.
 */
export type CommandOutcome = "ok" | "failed";
