# Claude Code Plugin

The Claude Code plugin transforms compiled agent profiles into [Claude Code](https://docs.anthropic.com/en/docs/claude-code) agent files — markdown files with YAML frontmatter that Claude Code can load as named agents.

## Enable the plugin

```json
{
  "plugins": ["claude-code"]
}
```

Or with custom options:

```json
{
  "plugins": [{
    "name": "claude-code",
    "outputDir": "./plugins/my-agents",
    "claudeCodePluginName": "my-org"
  }]
}
```

Run `praxis init` after adding the plugin to scaffold the plugin directory structure.

## What it generates

For each compiled role, the plugin writes an agent file at `{outputDir}/agents/{alias}.md`:

```yaml
---
name: Code Reviewer
description: "Reviews pull requests against team conventions and coding standards."
tools: Read, Glob, Grep
model: opus
permissionMode: plan
---

# Code Reviewer

Reviews pull requests with an eye for correctness and alignment with team conventions.

...full profile content...
```

The YAML frontmatter is what Claude Code reads to register the agent. The markdown body is the agent's instructions.

## Agent frontmatter fields

The plugin reads optional fields from your role frontmatter to populate the Claude Code agent frontmatter:

| Role frontmatter | Claude Code output | Example |
| --- | --- | --- |
| `description` | `description` | `"Reviews pull requests..."` |
| `agent_tools` | `tools` | `Read, Glob, Grep` |
| `agent_model` | `model` | `opus`, `sonnet` |
| `agent_permission_mode` | `permissionMode` | `plan`, `bypassPermissions` |

Example role frontmatter:

```yaml
---
title: Linear Manager
alias: linear-manager
description: "Use this agent to manage Linear projects and issues."
agent_tools: Read, Glob, Grep
agent_model: opus
agent_permission_mode: plan

constitution:
  - context/constitution/*.md
responsibilities:
  - responsibilities/manage-linear-resources.md
---
```

## The `plugin.json` manifest

The plugin creates and maintains `.claude-plugin/plugin.json` inside the output directory:

```json
{
  "name": "praxis"
}
```

The `name` field is controlled by `claudeCodePluginName` (default: `"praxis"`). Claude Code uses this to register the plugin and namespace its slash commands.

If `plugin.json` already exists, the plugin only updates the `name` field — other fields you have customized are preserved.

## The `/validate` slash command

The plugin generates a `/validate` slash command at `{outputDir}/commands/validate.md`. This lets Claude Code users validate documents one at a time without an OpenRouter API key — Claude Code uses its own LLM to check the document against the README spec in the same directory.

```
/praxis:validate roles/my-role.md
```

The slash command name is derived from `claudeCodePluginName`:

```
/{claudeCodePluginName}:validate
```

This is useful for teams with Claude Code licenses who don't want to distribute OpenRouter keys. Developers can validate before pushing; CI can run the full `praxis validate` suite independently.

## Plugin configuration options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `outputDir` | `string` | `"./plugins/praxis"` | Full output directory path, resolved against project root |
| `claudeCodePluginName` | `string` | `"praxis"` | The `name` field in `plugin.json` and the slash command namespace |

## See also

- [Plugins Overview](/plugins/overview)
- [The Compiler Pipeline](/concepts/compiler-pipeline)
- [Configuration](/reference/config)
