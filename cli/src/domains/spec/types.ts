/**
 * The spec domain's vocabulary: what an expert declares, and what a
 * compiled agent profile carries into its plugin outputs.
 *
 * Shapes more than one domain needs live in src/types.ts instead.
 */

import type { PluginConfigEntry } from "@/types.js";
import type { Logger } from "@/views/logger.js";

// ---------------------------------------------------------------------------
// Spec layer (domains/spec/)
// ---------------------------------------------------------------------------

/** The reference keys an expert can point at other documents with. */
export type RefKey = "practices" | "context" | "refs";

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
