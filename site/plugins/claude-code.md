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
# Expert

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

## The praxis skill

Alongside the compiled agents the plugin writes **`skills/praxis/SKILL.md`**, the CLI reference an agent loads so it knows the commands, the cache, the specs, and the ledger without being taught them every session. It carries the loop — what to run while writing, what to run when the change is done, how to work a backlog — and the three hard rules: triage and curate stay out of a working session, `.praxis/cache/` and `.praxis/ledger/` are never hand-edited, and what a run writes is committed with the code that produced it.

An agent working from it runs `praxis eval run`, so the verdicts it acts on are the ones CI will check.

### The retired `/praxis-resolve` command

The plugin used to write a `/praxis-resolve` slash command as well. It restated the skill's own command surface — the same six commands, a second time — which is how the two drifted apart, and a project gained nothing from having the CLI explained twice. Compile removes the file if an earlier version left one behind; the `commands/` directory is untouched, since an `outputDir` of `.claude` shares it with commands Praxis never wrote.

## Plugin configuration options

| Option                 | Type     | Default              | Description                                                       |
| ---------------------- | -------- | -------------------- | ----------------------------------------------------------------- |
| `outputDir`            | `string` | `"./plugins/praxis"` | Full output directory path, resolved against project root         |
| `claudeCodePluginName` | `string` | `"praxis"`           | The `name` field in `plugin.json` and the slash command namespace |

## See also

- [Plugins Overview](/plugins/overview)
- [The Compiler Pipeline](/concepts/compiler-pipeline)
- [Configuration](/reference/config)
