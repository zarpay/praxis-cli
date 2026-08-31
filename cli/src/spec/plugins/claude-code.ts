import type { AgentMetadata } from "@/spec/output-builder.js";
import type { CompilerPlugin, PluginOptions } from "@/spec/plugins/types.js";

import { exists, readJson, writeJson, writeText } from "@/core/files.js";
import { joinPath, resolvePath } from "@/core/paths.js";
import { evalTargetingLines } from "@/spec/output-builder.js";
import praxisResolveCommand from "@/spec/plugins/prompts/praxis-resolve-command.js";
import praxisSkill from "@/spec/plugins/prompts/praxis-skill.js";

/** Default plugin.json content used when no scaffold file exists. */
const DEFAULT_PLUGIN_JSON = {
  name: "praxis",
  description: "A plugin for integrating assistant profiles with Claude.",
  author: { name: "Your Name" },
  keywords: ["productivity"],
};



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
  /** Guards the once-per-run write of plugin.json and command/skill files. */
  private manifestWritten = false;

  constructor({ root, pluginConfig }: PluginOptions) {
    this.claudeCodePluginName = pluginConfig?.claudeCodePluginName ?? "praxis";
    this.outputDir = pluginConfig?.outputDir
      ? resolvePath(root, pluginConfig.outputDir)
      : joinPath(root, "plugins", "praxis");
    this.agentsDir = joinPath(this.outputDir, "agents");
  }

  /**
   * Writes a Claude Code agent file with frontmatter.
   *
   * Also ensures the plugin.json manifest exists and is up to date.
   */
  compile(profileContent: string, metadata: AgentMetadata | null, alias: string): void {
    if (!this.manifestWritten) {
      this.ensurePluginJson();
      this.ensureCommands();
      this.manifestWritten = true;
    }

    const frontmatter = this.buildFrontmatter(metadata);
    const content = frontmatter ? frontmatter + "\n" + profileContent : profileContent;

    writeText(joinPath(this.agentsDir, `${alias.toLowerCase()}.md`), content);
  }

  /**
   * Ensures `.claude-plugin/plugin.json` exists in the output directory.
   *
   * If it exists, updates the `name` field to match `claudeCodePluginName`
   * while preserving other user customizations. If it doesn't exist,
   * creates it from defaults.
   */
  private ensurePluginJson(): void {
    const pluginJsonPath = joinPath(this.outputDir, ".claude-plugin", "plugin.json");

    if (exists(pluginJsonPath)) {
      const existing = readJson<Record<string, unknown>>(pluginJsonPath);
      existing.name = this.claudeCodePluginName;
      writeJson(pluginJsonPath, existing);
    } else {
      writeJson(pluginJsonPath, { ...DEFAULT_PLUGIN_JSON, name: this.claudeCodePluginName });
    }
  }

  /**
   * Writes slash command files to `{outputDir}/commands/`.
   *
   * Creates the validate command that lets Claude Code users validate
   * documents without needing an OpenRouter API key.
   */
  private ensureCommands(): void {
    writeText(
      joinPath(this.outputDir, "commands", "praxis-resolve.md"),
      praxisResolveCommand(),
    );
    writeText(joinPath(this.outputDir, "skills", "praxis", "SKILL.md"), praxisSkill());
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

    lines.push(...evalTargetingLines(metadata));

    lines.push("---");
    return lines.join("\n");
  }
}

/**
 * Wraps a YAML string value in quotes if it contains special characters.
 */
function quoteIfNeeded(str: string): string {
  if (/[:[\]{}#&*!|>'"%@`\\]/.test(str) || str.includes("\n")) {
    const escaped = str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
  }

  return str;
}
