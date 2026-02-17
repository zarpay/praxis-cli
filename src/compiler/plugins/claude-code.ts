import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { AgentMetadata } from "../output-builder.js";
import type { CompilerPlugin, PluginOptions } from "./types.js";

/**
 * Claude Code compiler plugin.
 *
 * Takes a pure agent profile and wraps it with Claude Code YAML
 * frontmatter, then writes it to `plugins/{pluginName}/agents/`.
 */
export class ClaudeCodePlugin implements CompilerPlugin {
  readonly name = "claude-code";

  private readonly outputDir: string;

  constructor({ root, pluginsOutputDir, pluginName }: PluginOptions) {
    const name = pluginName ?? "praxis";
    this.outputDir = pluginsOutputDir
      ? join(pluginsOutputDir, name, "agents")
      : join(root, "plugins", name, "agents");
  }

  /**
   * Writes a Claude Code agent file with frontmatter.
   *
   * Output goes to the configured plugins output directory.
   */
  compile(profileContent: string, metadata: AgentMetadata | null, roleAlias: string): void {
    const outputDir = this.outputDir;
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const frontmatter = this.buildFrontmatter(metadata);
    const content = frontmatter ? frontmatter + "\n" + profileContent : profileContent;

    writeFileSync(join(outputDir, `${roleAlias.toLowerCase()}.md`), content);
  }

  /**
   * Generates Claude Code agent frontmatter YAML block.
   *
   * Returns null if no metadata or required fields are missing.
   */
  private buildFrontmatter(metadata: AgentMetadata | null): string | null {
    if (!metadata) {
      return null;
    }

    const { name, description } = metadata;
    if (!name || !description) {
      return null;
    }

    const lines = ["---"];
    lines.push(`name: ${name}`);
    lines.push(`description: ${quoteIfNeeded(description)}`);

    if (metadata.tools) {
      lines.push(`tools: ${metadata.tools}`);
    }
    if (metadata.model) {
      lines.push(`model: ${metadata.model}`);
    }
    if (metadata.permissionMode) {
      lines.push(`permissionMode: ${metadata.permissionMode}`);
    }

    lines.push("---");
    return lines.join("\n");
  }
}

/**
 * Wraps a YAML string value in quotes if it contains special characters.
 */
function quoteIfNeeded(str: string): string {
  if (/[:\[\]{}#&*!|>'"%@`\\]/.test(str) || str.includes("\n")) {
    const escaped = str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  return str;
}
