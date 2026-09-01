import type { AgentMetadata } from "@/types.js";

/** Separator between items in Responsibilities, Context, and Reference sections. */
const SEPARATOR = "\n---\n";

/** Separator between items in the Constitution section. */
const BLANK_SEPARATOR = "\n";

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
  if (metadata.validates.length === 0) return [];

  const lines = ["paths:", ...metadata.validates.map((p) => `  - "${p}"`)];

  if (metadata.cohort) {
    lines.push(`cohort: ${metadata.cohort}`);
  }

  if (metadata.excludes.length > 0) {
    lines.push("excludes:", ...metadata.excludes.map((p) => `  - "${p}"`));
  }

  if (metadata.exemplars.length > 0) {
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
