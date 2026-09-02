/**
 * The spec domain's vocabulary: what an expert declares, and what a
 * compiled agent profile carries into its plugin outputs.
 *
 * Shapes more than one domain needs live in src/types.ts instead.
 */

import type { Logger } from "@/framework/views/logger.js";
import type { PluginConfigEntry } from "@/types.js";

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
  /** How validated targets group into review units (written as cohort: in output). */
  cohort?: string;
  /** Glob patterns structurally excluded from review (written as excludes: in output). */
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
// Service payloads (domains/spec/services/)
// ---------------------------------------------------------------------------

/** Where glob patterns are resolved, and what never counts as a match. */
export interface ExpandGlobsInput {
  /** Patterns to expand, in the order the author declared them. */
  patterns: string[];
  /** Project root the patterns resolve against. */
  root: string;
  /** Filename or glob identifying spec files, which are never matched. */
  specFilePattern?: string;
}

/** What one declared pattern turned out to match. */
export interface GlobExpansion {
  /** The pattern as the author wrote it. */
  pattern: string;
  /** Whether it is a glob; a plain path matches only itself. */
  isGlob: boolean;
  /** Project-relative paths matched, sorted. */
  matches: string[];
}

/** The content blocks a compiled profile is assembled from. */
export interface BuildProfileInput {
  /** The expert's own prose. */
  role: string;
  /** Practice bodies, inlined. */
  responsibilities: string[];
  /** Constitution bodies, inlined. */
  constitution: string[];
  /** Context bodies, inlined. */
  context: string[];
  /** Reference bodies, inlined. */
  reference: string[];
}

/** Inlined content plus anything the author should know went wrong. */
export interface InlineReferencesResult {
  /** Body text of every resolved file, in declaration order. */
  bodies: string[];
  /** Author-facing problems: a glob that matched nothing, a missing file. */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Orchestrator payloads (domains/spec/orchestrators/)
// ---------------------------------------------------------------------------

/** What compiling needs to know about the project it is compiling in. */
export interface CompileScope {
  /** Project root all relative paths resolve against. */
  root: string;
  /** Where pure profiles are written, or null to skip them. */
  agentProfilesOutputDir: string | null;
  /** Filename or glob identifying spec files, which are never compiled. */
  specFilePattern: string;
  /** The enabled output plugins, already constructed. */
  plugins: CompilerPlugin[];
}

/** One expert to compile. */
export interface CompileExpertInput extends CompileScope {
  /** Absolute path to the expert markdown file. */
  expertFile: string;
}

/**
 * One compiled profile and where it should go.
 *
 * `agentProfilesOutputDir` is already resolved: null means no profile
 * output. The raw config spells that `false`; `PraxisConfig` resolves
 * it, and nothing past that boundary should see the other spelling.
 */
export interface WriteProfileOutputsInput {
  /** The assembled profile markdown. */
  profile: string;
  /** Agent metadata, or null when the expert declares no description. */
  metadata: AgentMetadata | null;
  /** The expert's alias, which names the output file. */
  alias: string;
  /** Resolved profile output directory, or null to skip it. */
  agentProfilesOutputDir: string | null;
  /** The enabled output plugins, already constructed. */
  plugins: CompilerPlugin[];
}

/** What compiling one expert produced. */
export interface CompileExpertResult {
  /** The expert's alias, and the compiled file's basename. */
  alias: string;
  /** Author-facing problems encountered while inlining content. */
  warnings: string[];
}

/** Every expert in a directory. */
export interface CompileExpertsInput extends CompileScope {
  /** Directory holding the expert markdown files. */
  expertsDir: string;
  /** Called as each expert resolves, for streamed output. */
  onProgress?: (event: CompileProgress) => void;
}

/** What happened to one expert during a full compile. */
export type CompileProgress =
  | { kind: "compiled"; alias: string }
  | { kind: "skipped"; file: string; reason: string }
  | { kind: "warning"; message: string };

/** What a full compile produced. */
export interface CompileExpertsResult {
  /** How many experts compiled successfully. */
  compiled: number;
  /** Experts that could not be compiled, with the reason. */
  skipped: { file: string; reason: string }[];
}

/** One expert to compile, named by its alias. */
export interface CompileByAliasInput extends CompileScope {
  /** The alias to compile, matched case-insensitively. */
  alias: string;
  /** Directory holding the expert markdown files. */
  expertsDir: string;
}

/** A watch session over a project's source directories. */
export interface WatchAndCompileInput extends CompileExpertsInput {
  /** Source directories to watch, relative to the project root. */
  sources: string[];
  /** How long to wait for a burst of changes to settle. */
  debounceMs?: number;
  /** Called once per directory as watching begins. */
  onWatch?: (sourceDir: string) => void;
  /** Called when a change triggers a recompile. */
  onRecompile?: (filename: string | null) => void;
  /** Called when a recompile fails; the watch continues regardless. */
  onError?: (message: string) => void;
}

/** How `praxis compile` was invoked. */
export interface CompileProjectOptions {
  /** Compile only the expert with this alias. */
  alias?: string;
  /** Keep running, recompiling on every source change. */
  watch?: boolean;
}

/** What `praxis add expert|practice <name>` was given. */
export interface AddDocumentOptions {
  /** Kebab-case name for the new file, e.g. "code-reviewer". */
  name: string;
}

/** Everything scaffolding one document needs. */
export interface AddDocumentInput {
  /** Which template to use. */
  type: "expert" | "practice";
  /** Kebab-case name for the new file. */
  name: string;
  /** Project root the reported path is relative to. */
  root: string;
  /** Where experts live. */
  expertsDir: string;
  /** Where practices live. */
  practicesDir: string;
}

/** What was created. */
export interface AddDocumentResult {
  type: "expert" | "practice";
  /** The new file's path, relative to the project root. */
  path: string;
}
