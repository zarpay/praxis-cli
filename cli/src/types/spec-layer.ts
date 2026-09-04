// The authoring and compile side (11): experts in, SME agent
// profiles out.

import type { CompilerPlugin } from "@/types/extension-points.js";

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

/** Every expert in a directory. */
export interface CompileExpertsInput {
  /** The enabled output plugins, already constructed. */
  plugins: CompilerPlugin[];
  /** Called as each expert resolves, for streamed output. */
  onProgress?: (event: CompileProgress) => void;
}

/** What happened to one expert during a full compile. */
export type CompileProgress =
  | { kind: "compiled"; alias: string }
  | { kind: "skipped"; file: string; reason: string }
  | { kind: "warning"; message: string };

/** What `praxis add expert|practice <name>` was given. */
export interface AddDocumentOptions {
  /** Kebab-case name for the new file, e.g. "code-reviewer". */
  name: string;
}

/** What was created. */
export interface AddDocumentResult {
  type: "expert" | "practice";
  /** The new file's path, relative to the project root. */
  path: string;
}
