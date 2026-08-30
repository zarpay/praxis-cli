import type { PluginConfigEntry } from "@/core/config.js";
import type { Logger } from "@/core/logger.js";
import type { AgentMetadata } from "@/spec/output-builder.js";

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
