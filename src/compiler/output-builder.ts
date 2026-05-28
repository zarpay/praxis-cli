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
}

/**
 * Assembles compiled agent output from individual content sections.
 *
 * Sections are added incrementally and then assembled in a fixed order:
 * Frontmatter -> Role -> Responsibilities -> Constitution -> Context -> Reference.
 *
 * Different separators are used between items in each section:
 * - Responsibilities, Context, Reference: `---` horizontal rules
 * - Constitution: blank lines (no rules)
 */
export class OutputBuilder {
  private readonly agentMetadata: AgentMetadata | null;
  private role: string | null = null;
  private responsibilities: string[] = [];
  private constitution: string[] = [];
  private context: string[] = [];
  private reference: string[] = [];

  constructor({ agentMetadata = null }: { agentMetadata?: AgentMetadata | null } = {}) {
    this.agentMetadata = agentMetadata;
  }

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
   * Assembles all sections with Claude Code frontmatter prepended.
   *
   * @deprecated Use `buildProfile()` and a plugin compiler instead.
   * Kept for backward compatibility.
   */
  build(): string {
    const frontmatter = this.buildClaudeCodeFrontmatter();
    const profile = this.buildProfile();

    if (frontmatter) {
      return frontmatter + "\n" + profile;
    }
    return profile;
  }

  /**
   * Generates Claude Code agent frontmatter YAML block.
   *
   * Returns null if no agent metadata was provided or if required
   * fields (name, description) are missing.
   */
  private buildClaudeCodeFrontmatter(): string | null {
    if (!this.agentMetadata) {
      return null;
    }

    const { name, description } = this.agentMetadata;
    if (!name || !description) {
      return null;
    }

    const lines = ["---"];
    lines.push(`name: ${name}`);
    lines.push(`description: ${this.quoteIfNeeded(description)}`);

    if (this.agentMetadata.tools) {
      lines.push(`tools: ${this.agentMetadata.tools}`);
    }
    if (this.agentMetadata.model) {
      lines.push(`model: ${this.agentMetadata.model}`);
    }
    if (this.agentMetadata.permissionMode) {
      lines.push(`permissionMode: ${this.agentMetadata.permissionMode}`);
    }

    lines.push("---");
    return lines.join("\n");
  }

  /**
   * Wraps a YAML string value in quotes if it contains special characters.
   *
   * Prevents YAML parsing issues in the generated frontmatter.
   */
  private quoteIfNeeded(str: string): string {
    if (/[:\[\]{}#&*!|>'"%@`\\]/.test(str) || str.includes("\n")) {
      const escaped = str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `"${escaped}"`;
    }
    return str;
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
