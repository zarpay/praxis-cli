/** Separator between items in Responsibilities, Context, and Reference sections. */
const SEPARATOR = "\n---\n";

/** Separator between items in the Constitution section. */
const BLANK_SEPARATOR = "\n";

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
  validates?: string[];
  /** How validated targets group into evaluation units (written as cohort: in output). */
  cohort?: string;
  /** Glob patterns structurally excluded from judgment (written as excludes: in output). */
  excludes?: string[];
  /** Spec-blessed positive examples (written as exemplars: in output). */
  exemplars?: string[];
}

/**
 * Renders the eval-targeting frontmatter lines a compiled profile carries.
 *
 * The compiled profile doubles as a spec for the eval layer; these lines
 * (`paths:`, `cohort:`, `excludes:`) are how an expert's targeting keys
 * compile through. Returns an empty array when the expert declares no
 * `validates:` targeting — the other keys are meaningless without it.
 * Shared by the pure-profile writer and every plugin so the two outputs
 * can never drift.
 */
export function evalTargetingLines(metadata: AgentMetadata): string[] {
  const validates = metadata.validates ?? [];

  if (validates.length === 0) return [];

  const lines = ["paths:", ...validates.map((p) => `  - "${p}"`)];

  if (metadata.cohort) {
    lines.push(`cohort: ${metadata.cohort}`);
  }

  if (metadata.excludes && metadata.excludes.length > 0) {
    lines.push("excludes:", ...metadata.excludes.map((p) => `  - "${p}"`));
  }

  if (metadata.exemplars && metadata.exemplars.length > 0) {
    lines.push("exemplars:", ...metadata.exemplars.map((p) => `  - "${p}"`));
  }

  return lines;
}

/**
 * Assembles compiled agent output from individual content sections.
 *
 * Sections are added incrementally and then assembled in a fixed order:
 * Role -> Responsibilities -> Constitution -> Context -> Reference.
 *
 * Different separators are used between items in each section:
 * - Responsibilities, Context, Reference: `---` horizontal rules
 * - Constitution: blank lines (no rules)
 *
 * The output is a pure profile: platform-specific wrapping (e.g. Claude
 * Code frontmatter) is the responsibility of compiler plugins.
 */
export class OutputBuilder {
  private role: string | null = null;
  private responsibilities: string[] = [];
  private constitution: string[] = [];
  private context: string[] = [];
  private reference: string[] = [];

  /** Sets the role body content. */
  addRole(content: string): void {
    this.role = content;
  }

  /** Sets the list of responsibility content blocks. */
  addResponsibilities(contents: string[]): void {
    this.responsibilities = contents;
  }

  /** Sets the list of constitution content blocks. */
  addConstitution(contents: string[]): void {
    this.constitution = contents;
  }

  /** Sets the list of context content blocks. */
  addContext(contents: string[]): void {
    this.context = contents;
  }

  /** Sets the list of reference content blocks. */
  addReference(contents: string[]): void {
    this.reference = contents;
  }

  /**
   * Assembles all content sections into a pure profile markdown string.
   *
   * Contains no plugin-specific frontmatter — just the structured
   * sections (Role, Responsibilities, Constitution, Context, Reference).
   * Sections with no content are omitted.
   */
  buildProfile(): string {
    const sections: string[] = [];

    if (this.role) {
      sections.push(this.buildSection("Role", [this.role], BLANK_SEPARATOR));
    }

    if (this.responsibilities.length > 0) {
      sections.push(this.buildSection("Responsibilities", this.responsibilities, SEPARATOR));
    }

    if (this.constitution.length > 0) {
      sections.push(this.buildSection("Constitution", this.constitution, BLANK_SEPARATOR));
    }

    if (this.context.length > 0) {
      sections.push(this.buildSection("Context", this.context, SEPARATOR));
    }

    if (this.reference.length > 0) {
      sections.push(this.buildSection("Reference", this.reference, SEPARATOR));
    }

    return sections.join("\n");
  }

  /**
   * Formats a named section with a heading and joined content blocks.
   *
   * @param title - Section heading (e.g. "Role", "Responsibilities")
   * @param contents - Array of content blocks to join
   * @param separator - String to insert between content blocks
   */
  private buildSection(title: string, contents: string[], separator: string): string {
    const body = contents.join(separator);
    return `# ${title}\n\n${body}\n`;
  }
}
