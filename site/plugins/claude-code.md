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
  "plugins": [
    {
      "name": "claude-code",
      "outputDir": "./plugins/my-agents",
      "claudeCodePluginName": "my-org"
    }
  ]
}
```

The plugin's directories and manifest are written by the first `praxis compile` after enabling it.

## What it generates

For each compiled expert, the plugin writes an agent file at `{outputDir}/agents/{alias}.md`:

```yaml
---
name: scooper
description: "Use this agent to review Scoop Society services for convention adherence, or for advice when writing a new service."
tools: Read, Glob, Grep
model: sonnet
---
# Role

# Service Steward (a.k.a **Scooper**)

The subject-matter expert on how Scoop Society services are written
and reviewed.

...full profile content...
```

The YAML frontmatter is what Claude Code reads to register the agent. The markdown body is the agent's instructions.

## Agent frontmatter fields

The plugin reads optional fields from your expert frontmatter to populate the Claude Code agent frontmatter:

| Expert frontmatter      | Claude Code output | Example                      |
| ----------------------- | ------------------ | ---------------------------- |
| `description`           | `description`      | `"Reviews pull requests..."` |
| `agent_tools`           | `tools`            | `Read, Glob, Grep`           |
| `agent_model`           | `model`            | `opus`, `sonnet`             |
| `agent_permission_mode` | `permissionMode`   | `plan`, `bypassPermissions`  |

Example expert frontmatter:

```yaml
---
title: Service Steward
alias: Scooper
description: "Use this agent to review Scoop Society services for convention adherence."
agent_tools: Read, Glob, Grep
agent_model: sonnet

constitution: "knowledge/context/constitution/*.md"
practices:
  - knowledge/practices/review-service-quality.md
---
```

An expert with no `description` compiles a readable profile but no agent frontmatter — the profile is documentation, not a dispatchable agent, and the compile says so with a warning.

## The `plugin.json` manifest

The plugin creates and maintains `.claude-plugin/plugin.json` inside the output directory:

```json
{
  "name": "praxis"
}
```

The `name` field is controlled by `claudeCodePluginName` (default: `"praxis"`). Claude Code uses this to register the plugin and namespace its slash commands.

If `plugin.json` already exists, the plugin only updates the `name` field — other fields you have customized are preserved.

## The `/praxis-resolve` slash command and the skill

The plugin writes two agent-facing artifacts alongside the compiled agents:

- **`commands/praxis-resolve.md`** — a `/praxis-resolve` slash command: a disciplined resolve loop (discover the full scope, fix one finding, verify with `praxis eval run <path>`, repeat) that an agent works through until the project is compliant.
- **`skills/praxis/SKILL.md`** — the praxis skill: the CLI reference an agent loads so it knows the commands, the cache, the specs, and the ledger without being taught them every session.

```
/praxis-resolve src/services --no-warns
```

Resolving still runs `praxis eval run` under the hood, so the reviewer verdicts an agent acts on are the same ones CI will check. (`claudeCodePluginName` namespaces the plugin itself; the command file is always `praxis-resolve.md`.)

## Plugin configuration options

| Option                 | Type     | Default              | Description                                                       |
| ---------------------- | -------- | -------------------- | ----------------------------------------------------------------- |
| `outputDir`            | `string` | `"./plugins/praxis"` | Full output directory path, resolved against project root         |
| `claudeCodePluginName` | `string` | `"praxis"`           | The `name` field in `plugin.json` and the slash command namespace |

## See also

- [Plugins Overview](/plugins/overview)
- [The Compiler Pipeline](/concepts/compiler-pipeline)
- [Configuration](/reference/config)
