/**
 * The framework's own vocabulary: the shapes its plumbing speaks in.
 *
 * Terminal output, error codes, and the two signatures a Praxis-shaped
 * CLI is built from. Nothing here knows what a reviewer or an expert is —
 * that vocabulary lives in src/types.ts and the domains' own types.ts.
 */

import type { Command } from "commander";

// ---------------------------------------------------------------------------
// Terminal output (framework/views/)
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
// Errors (framework/errors.ts)
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
 * failed), not an error: a genuine error is thrown, and `prepareOrchestrator` catches it.
 */
export type CommandOutcome = "ok" | "failed";

/**
 * The one signature every orchestrator has.
 *
 * Generic in its context: the framework fixes the shape — a context, the
 * command's options, a promise of an outcome — and the application binds
 * what a context actually is. `domains/workspace/types.ts` does that.
 */
export type Orchestrator<Ctx, Options = NoOptions> = (
  ctx: Ctx,
  options: Options,
) => Promise<CommandOutcome | void>;

/**
 * The options of an orchestrator that takes none.
 *
 * Not `void` and not optional: the parameter stays in the signature so
 * every command reads the same, passing `{}`.
 */
export type NoOptions = Record<string, never>;
