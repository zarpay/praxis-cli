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

/** Content for the /praxis-resolve slash command. */
const PRAXIS_RESOLVE_COMMAND = `---
description: Iteratively resolve Praxis spec violations — review, fix, and verify until all targeted files are compliant.
---

Work through Praxis spec violations one at a time: discover the full scope first, fix each file, verify it passes, move on.

## Arguments

\`$ARGUMENTS\` accepts any combination of:

- **Empty** — resolve all specs, FAILs and WARNs (default)
- **\`--no-warns\`** — resolve FAILs only, leave WARNs
- **\`--warns-only\`** — resolve WARNs only, skip FAILs
- **Type filter** — a \`--type\` label from the "By type:" summary (e.g. \`.claude/agents\`)
- **File paths** — one or more specific files
- **Combinations** — \`backend/app/events/account_secured_event.rb --no-warns\`

**Default: resolve both FAILs and WARNs.** Warnings are real deviations from the spec.

---

## Phase 1 — Discovery

Run validation across the full scope **without** \`--fail-fast\` to see everything before touching anything:

\`\`\`bash
# All specs:
praxis validate all

# Scoped to a type:
praxis validate all --type <type>

# Specific files (force fresh evaluation):
praxis validate document <path> --no-cache --verbose
\`\`\`

Build a numbered checklist of every item to resolve. Do not begin fixing until the full list is in front of you.

---

## Phase 2 — Resolve loop

Work through the checklist one item at a time.

**For each item:**

1. **Read the file** and understand the violation. Use \`praxis validate report <path> --verbose\` to see cached reasoning, or \`praxis validate document <path> --verbose\` if no cached entry yet.

2. **Fix** — apply the minimum change that satisfies the reported issue. Do not refactor unrelated code.

3. **Verify** — the edit auto-invalidates the cache entry. Run:
   \`\`\`bash
   praxis validate document <path>
   \`\`\`
   - \`✓ PASS\` or \`⚠ WARN\` (when only fixing FAILs) → check off, move to next
   - Still failing → re-read the issue, fix again, verify again
   - Confirmed false positive → note it explicitly, skip, move to next

4. Mark the checklist item done before moving on.

---

## Phase 3 — Final sweep

After all items are addressed, run the full scope once more to confirm no regressions:

\`\`\`bash
praxis validate all
\`\`\`

---

## Summary

Report:
- Files resolved and the common violation patterns
- Any WARNs left and why (if \`--no-warns\` was used)
- False positives encountered — these may indicate the spec needs clarification
`;

/** Content for the praxis skill. */
const PRAXIS_SKILL = `---
description: Reference for the Praxis CLI — what it does, how to use it, and how the cache and specs work.
---

# Praxis

Praxis is a CLI tool with two complementary functions:

**Conceptual linting** — spec files define what valid documents look like for a given set of files. \`praxis validate\` runs each file through its spec via an LLM and caches the result. The cache is content-hash keyed: editing a file auto-invalidates its entry. Never delete the cache manually.

**Knowledge compilation** — role files in the configured \`rolesDir\` are compiled into self-contained SME agent profiles and written to the Claude Code agents directory.

---

## Project structure

\`\`\`
.praxis/config.json        — sources, ignore patterns, model config, specFilePattern
.praxis/cache/             — committed LLM validation results (keyed by content hash)
docs/roles/                — role definitions compiled into SME agent profiles
.claude/agents/*.sme.md   — compiled agent profiles; also the spec files for validation
\`\`\`

Config is loaded from the nearest \`.praxis/\` directory walking up from cwd.

---

## Key CLI commands

\`\`\`bash
# Project health: document counts, validation coverage, orphaned refs
praxis status

# Validate all targeted files (all specs)
praxis validate all

# Validate scoped to one spec's files (use the "By type:" label from validate all output)
praxis validate all --type <type>

# Stop on first error — useful for sequential fixing
praxis validate all --fail-fast

# Validate a single file against its spec
praxis validate document <path>

# Force re-evaluation without editing the file
praxis validate document <path> --no-cache

# Show full AI reasoning for a result
praxis validate document <path> --verbose

# Read cached result without an API call
praxis validate report <path> --verbose

# Recompile role files into SME agent profiles
praxis compile

# Inspect or edit .praxis/config.json
praxis config show
praxis config edit
\`\`\`

---

## How specs work

Spec files match \`specFilePattern\` (default: \`README.md\`, configured per project). In this project: \`*.sme.md\`.

A spec file with \`paths:\` frontmatter targets those glob patterns — files of any extension. Without \`paths:\`, it validates sibling files in the same directory.

The compiled SME profile IS the spec: the LLM reads the profile content as the specification when evaluating each targeted file.

---

## Cache behaviour

- Content-hash keyed: edit a file → its cache entry is automatically invalidated on next run
- Both the document and the spec content are hashed — changing the spec invalidates all entries for files it covers
- \`--no-cache\` forces re-evaluation without editing (use sparingly, mainly to check LLM non-determinism on borderline results)
- Never delete \`.praxis/cache/\` — it accumulates valid results and saves API calls
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
    writeFileSync(join(commandsDir, "praxis-resolve.md"), PRAXIS_RESOLVE_COMMAND);

    const skillDir = join(this.outputDir, "skills", "praxis");
    if (!existsSync(skillDir)) {
      mkdirSync(skillDir, { recursive: true });
    }
    writeFileSync(join(skillDir, "SKILL.md"), PRAXIS_SKILL);
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
