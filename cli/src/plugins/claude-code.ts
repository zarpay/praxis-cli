import type { AgentMetadata, CompilerPlugin, PluginOptions } from "@/types.js";

import { exists, readJson, writeJson, writeText } from "@/helpers/files-helper.js";
import { joinPath, resolvePath } from "@/helpers/paths-helper.js";
import evalTargetingTemplate from "@/templates/eval-targeting-template.js";
import praxisResolveCommandTemplate from "@/templates/praxis-resolve-command-template.js";
import praxisSkillTemplate from "@/templates/praxis-skill-template.js";

/**
 * The manifest written when the output directory has none.
 *
 * Not read from `scaffold/`: `ensurePluginJson` checks the project's own
 * output directory, so this is the sole source on a project that was
 * never scaffolded.
 */
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
      praxisResolveCommandTemplate(),
    );
    writeText(joinPath(this.outputDir, "skills", "praxis", "SKILL.md"), praxisSkillTemplate());
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

    // name and description are both guaranteed: ExpertFile rejects an
    // alias that slugs to nothing, and expert.agentMetadata returns null
    // rather than metadata without a description.
    const lines = ["---"];
    lines.push(`name: ${metadata.name}`);
    lines.push(`description: ${quoteIfNeeded(metadata.description)}`);

    if (metadata.tools) {
      lines.push(`tools: ${metadata.tools}`);
    }

    if (metadata.model) {
      lines.push(`model: ${metadata.model}`);
    }

    if (metadata.permissionMode) {
      lines.push(`permissionMode: ${metadata.permissionMode}`);
    }

    lines.push(...evalTargetingTemplate(metadata));

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
