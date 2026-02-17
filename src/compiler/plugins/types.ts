import type { AgentMetadata } from "../output-builder.js";
import type { Logger } from "@/core/logger.js";

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
   * @param roleAlias - The role's alias (used for output file naming)
   */
  compile(profileContent: string, metadata: AgentMetadata | null, roleAlias: string): void;
}

/** Options passed to plugin constructors. */
export interface PluginOptions {
  root: string;
  logger: Logger;
  pluginsOutputDir?: string;
  pluginName?: string;
}
