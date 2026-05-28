import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import type { AgentMetadata } from "../output-builder.js";
import type { CompilerPlugin, PluginOptions } from "./types.js";

/** Default plugin.json content used when no scaffold file exists. */
const DEFAULT_PLUGIN_JSON = {
  name: "praxis",
  description: "A plugin for integrating assistant profiles with Claude.",
  author: { name: "Your Name" },
  keywords: ["productivity"],
};

/** Content for the /validate slash command. */
const VALIDATE_COMMAND = `---
description: Validate a Praxis document against its directory's README specification
---

Validate a Praxis document against the specification defined in its directory's README.

## Instructions

1. Read the document at the path: $ARGUMENTS
2. Find and read the README.md file in the same directory as the document
3. The README is the source of truth for what documents in that directory should contain

## Validation Criteria

Check the document for compliance with the README specification:

1. All required frontmatter fields mentioned in the README
2. All required sections mentioned in the README
3. Naming conventions described in the README
4. Content expectations described in the README
5. Proper markdown formatting

## Response Format

Start your response with exactly one of these words:

- **Yes** — Document fully complies with all requirements in the README
- **Maybe** — Minor issues exist (formatting, style) but structure is correct
- **No** — Major issues exist (missing sections, wrong type, broken structure)

Then explain your reasoning. When identifying issues:

- Quote the problematic section if applicable
- Reference the specific rule from the README being violated
- Suggest how to fix it
`;

/**
 * Claude Code compiler plugin.
 *
 * Takes a pure agent profile and wraps it with Claude Code YAML
 * frontmatter, then writes it to `{outputDir}/agents/`.
 *
 * Also ensures the `.claude-plugin/plugin.json` manifest exists
 * within the output directory.
 */
export class ClaudeCodePlugin implements CompilerPlugin {
  readonly name = "claude-code";

  private readonly claudeCodePluginName: string;
  private readonly outputDir: string;
  private readonly agentsDir: string;
  private manifestWritten = false;

  constructor({ root, pluginConfig }: PluginOptions) {
    this.claudeCodePluginName = pluginConfig?.claudeCodePluginName ?? "praxis";
    this.outputDir = pluginConfig?.outputDir
      ? resolve(root, pluginConfig.outputDir)
      : join(root, "plugins", "praxis");
    this.agentsDir = join(this.outputDir, "agents");
  }

  /**
   * Writes a Claude Code agent file with frontmatter.
   *
   * Also ensures the plugin.json manifest exists and is up to date.
   */
  compile(profileContent: string, metadata: AgentMetadata | null, roleAlias: string): void {
    if (!existsSync(this.agentsDir)) {
      mkdirSync(this.agentsDir, { recursive: true });
    }

    if (!this.manifestWritten) {
      this.ensurePluginJson();
      this.ensureCommands();
      this.manifestWritten = true;
    }

    const frontmatter = this.buildFrontmatter(metadata);
    const content = frontmatter ? frontmatter + "\n" + profileContent : profileContent;

    writeFileSync(join(this.agentsDir, `${roleAlias.toLowerCase()}.md`), content);
  }

  /**
   * Ensures `.claude-plugin/plugin.json` exists in the output directory.
   *
   * If it exists, updates the `name` field to match `claudeCodePluginName`
   * while preserving other user customizations. If it doesn't exist,
   * creates it from defaults.
   */
  private ensurePluginJson(): void {
    const pluginJsonDir = join(this.outputDir, ".claude-plugin");
    const pluginJsonPath = join(pluginJsonDir, "plugin.json");

    if (!existsSync(pluginJsonDir)) {
      mkdirSync(pluginJsonDir, { recursive: true });
    }

    if (existsSync(pluginJsonPath)) {
      const existing = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
      existing.name = this.claudeCodePluginName;
      writeFileSync(pluginJsonPath, JSON.stringify(existing, null, 2) + "\n");
    } else {
      const pluginJson = { ...DEFAULT_PLUGIN_JSON, name: this.claudeCodePluginName };
      writeFileSync(pluginJsonPath, JSON.stringify(pluginJson, null, 2) + "\n");
    }
  }

  /**
   * Writes slash command files to `{outputDir}/commands/`.
   *
   * Creates the validate command that lets Claude Code users validate
   * documents without needing an OpenRouter API key.
   */
  private ensureCommands(): void {
    const commandsDir = join(this.outputDir, "commands");

    if (!existsSync(commandsDir)) {
      mkdirSync(commandsDir, { recursive: true });
    }

    writeFileSync(join(commandsDir, "validate.md"), VALIDATE_COMMAND);
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
    if (metadata.validates && metadata.validates.length > 0) {
      lines.push("paths:");
      for (const p of metadata.validates) {
        lines.push(`  - "${p}"`);
      }
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
