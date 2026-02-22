# Praxis

Praxis is a CLI tool that structures your team's knowledge so both humans and AI agents can operate effectively.

[![Praxis CLI Demo](https://img.youtube.com/vi/u34hHTgvr-Q/maxresdefault.jpg)](https://youtu.be/u34hHTgvr-Q)

## Install

```bash
npm install -g @zarpay/praxis-cli
```

Requires Node.js 18+.

## Quick Start

```bash
# Scaffold a new Praxis project
praxis init my-org
cd my-org

# Add a role and responsibility
praxis add role code-reviewer
praxis add responsibility review-pull-requests

# Edit the generated files, then compile
praxis compile
```

## How It Works

Praxis organizes knowledge into four primitives:

| Primitive | Purpose | Example |
|-----------|---------|---------|
| **Context** | "This is who we are and how we think" | Company identity, conventions, mental models |
| **Roles** | "This is who you are" | A role definition with scope, boundaries, and personality |
| **Responsibilities** | "This is what you own" | Discrete units of work delegated to a role |
| **Reference** | "This is what things mean" | Vocabulary, indices, lookup tables |

A **Role** is the central unit. Each role declares what context it needs, what responsibilities it owns, and what references it consults. When you run `praxis compile`, it reads each role's frontmatter manifest, resolves all referenced content via glob patterns, inlines everything, and produces a single standalone markdown file — a compiled agent profile.

### Example: A Support Agent

Here's a role file for a customer support agent. The frontmatter is the manifest — it declares which context, responsibilities, and references this role needs:

```yaml
---
title: Customer Support Agent
type: role
alias: support-agent
description: "Handle customer inquiries, troubleshoot product issues, and process returns."

constitution:
  - context/constitution/identity.md
context:
  - context/conventions/tone-of-voice.md
responsibilities:
  - responsibilities/handle-refund-requests.md
  - responsibilities/troubleshoot-device-issues.md
refs:
  - reference/product-catalog.md
  - reference/refund-policy.md
---

# Customer Support Agent

Handles inbound customer inquiries with warmth and efficiency.

## Scope

### Responsible For
- Answering product questions using the product catalog
- Processing returns and refunds within policy
- Escalating edge cases to the support manager

### Not Responsible For
- Negotiating custom pricing or enterprise deals
- Making warranty exceptions without manager approval

## Authorities
- **Can** process refunds up to $300 without manager approval
- **Cannot** override the refund policy
```

Running `praxis compile` resolves every path and glob in the frontmatter, pulls in the referenced files, and assembles one self-contained profile:

```
agent-profiles/support-agent.md
├── Role: Customer Support Agent (identity, scope, authorities)
├── Responsibilities: Handle Refund Requests, Troubleshoot Device Issues
├── Constitution: Company Identity
├── Context: Tone of Voice
└── Reference: Product Catalog, Refund Policy
```

Change a policy, recompile — every agent stays in sync.

### Default Project Structure

Running `praxis init` scaffolds this layout:

```
my-org/
├── .praxis/
│   └── config.json              # Project configuration
├── context/
│   ├── constitution/            # Immutable identity (who you are, what you value)
│   ├── conventions/             # Standards and norms (how you do things)
│   └── lenses/                  # Mental models (how you think)
├── roles/                       # Role definitions (entry point for agents)
├── responsibilities/            # Delegatable work units
├── reference/                   # Vocabulary, indices, lookup tables
├── agent-profiles/              # Compiled output (auto-generated)
└── plugins/                     # Plugin output (auto-generated)
```

This structure is fully configurable — see [Configuration](#configuration).

## Validation

Every directory's `README.md` isn't just documentation — it's a **specification**. Each README defines the required structure for files in that directory: what frontmatter fields are needed, what sections to include, what format to follow.

`praxis validate` checks every document against its directory's README using an LLM:

```bash
praxis validate all
```
```
[PASS] roles/support-agent.md
[WARN] responsibilities/handle-refund-requests.md
    - Missing "Inputs" section (recommended by spec)
[FAIL] reference/pricing.md
    - Frontmatter field "type" is missing (required)

==================================================
Summary
==================================================
Total documents: 12
[Compliant] 9
[Warnings] 2
[Errors] 1
```

Results are cached by content hash — unchanged documents aren't re-validated. There's a CI mode too: plug `praxis validate ci --strict` into your pipeline and PRs that break the spec don't merge.

See [CLI Reference: `praxis validate`](#praxis-validate) for all subcommands and options.

## CLI Reference

### `praxis init [directory]`

Scaffolds a new Praxis project with the full directory structure, two built-in roles (Stewart and Remy), and starter content. Skips files that already exist, making it safe to re-run.

### `praxis add role <name>` / `praxis add responsibility <name>`

Creates a new role or responsibility from `_template.md` with placeholders pre-filled. The name should be kebab-case (e.g., `code-reviewer`, `review-pull-requests`).

```bash
praxis add role code-reviewer
# Creates roles/code-reviewer.md

praxis add responsibility review-pull-requests
# Creates responsibilities/review-pull-requests.md
```

Output paths are determined by `rolesDir` and `responsibilitiesDir` in your config.

### `praxis compile [--alias <name>] [--watch]`

Compiles all roles (or a single role by alias) into agent profiles. Each role's referenced content is resolved and inlined into a self-contained markdown file.

```bash
praxis compile                    # Compile all roles
praxis compile --alias stewart    # Compile a single role
praxis compile --watch            # Compile and watch for changes
```

The `--watch` flag monitors all directories listed in `sources` for file changes and automatically recompiles.

Output is written to `agentProfilesOutputDir` (pure profiles) and to each enabled plugin's output location.

### `praxis status`

Shows a project health dashboard without requiring any API keys. Scans all `sources` directories, categorizes documents by their frontmatter `type:` field, and reports content counts alongside issues like dangling references, orphaned responsibilities, missing descriptions, and unmatched owners.

Also displays validation coverage by reading cached validation results for every source document, showing how many are passing, have warnings, have errors, or haven't been validated yet.

```bash
praxis status
```

Exits with code 1 if issues are found, making it suitable for CI.

### `praxis validate`

AI-powered validation that checks documents against their directory's README specification.

Any directory within your configured `sources` that contains a `README.md` becomes a validation domain. The README defines the spec, and every `.md` file in that directory (excluding `README.md` and `_`-prefixed files) is validated against it.

```bash
praxis validate document roles/my-role.md        # Validate a single document
praxis validate all                               # Validate everything
praxis validate all --type roles                  # Validate one type only
praxis validate all --verbose                     # Show full AI reasoning
praxis validate all --no-cache                    # Skip validation cache
praxis validate ci --strict                       # CI mode (fail on warnings)
praxis validate report roles/my-role.md           # Inspect cached validation status
praxis validate report roles/my-role.md --verbose # Include full AI reasoning
```

#### `praxis validate report <path>`

Displays a readable report of a document's cached validation status. Shows one of five states: **PASS**, **WARN**, **FAIL**, **STALE** (document changed since last validation), or **NOT VALIDATED** (no cached result). Does not call any API — it only reads from the local cache. Use `--verbose` to include the full AI reasoning.

Validation results are cached in `.praxis/cache/validation/` and automatically invalidated when document or README content changes.

Requires the `validation` section in `.praxis/config.json` (see [Configuration](#configuration)) and the configured API key environment variable set:

```bash
export OPENROUTER_API_KEY=your-key-here
```

## Configuration

All project settings live in `.praxis/config.json`. The presence of the `.praxis/` directory is how Praxis detects the project root.

Here is the default configuration created by `praxis init`:

```json
{
  "sources": ["roles", "responsibilities", "reference", "context"],
  "rolesDir": "roles",
  "responsibilitiesDir": "responsibilities",
  "agentProfilesOutputDir": "./agent-profiles",
  "plugins": [],
  "validation": {
    "apiKeyEnvVar": "OPENROUTER_API_KEY",
    "model": "x-ai/grok-4.1-fast"
  }
}
```

### Config Options

#### `sources`

**Type:** `string[]` | **Default:** `["roles", "responsibilities", "reference", "context"]`

Directories that Praxis treats as knowledge sources. These are scanned during validation and watched during `praxis compile --watch`. Each directory path is relative to the project root.

Any directory within your sources that contains a `README.md` becomes a **validation domain** — the README acts as the spec, and all `.md` files in that directory are validated against it.

You can reorganize freely. For example, a flat structure:

```json
{
  "sources": ["roles", "responsibilities", "reference", "context"]
}
```

Or nested under multiple directories:

```json
{
  "sources": ["agents/roles", "agents/responsibilities", "knowledge/reference", "knowledge/processes"]
}
```

#### `rolesDir`

**Type:** `string` | **Default:** `"roles"`

The directory where role `.md` files live. Used by `praxis compile` to find roles and by `praxis add role` to place new role files. Relative to the project root.

#### `responsibilitiesDir`

**Type:** `string` | **Default:** `"responsibilities"`

The directory where responsibility `.md` files live. Used by `praxis add responsibility` to place new responsibility files. Relative to the project root.

#### `agentProfilesOutputDir`

**Type:** `string | false` | **Default:** `"./agent-profiles"`

Where compiled pure agent profiles are written. Each role compiles to `{agentProfilesOutputDir}/{alias}.md`. Set to `false` to disable pure profile output entirely (useful if you only want plugin output).

#### `plugins`

**Type:** `(string | PluginConfigEntry)[]` | **Default:** `[]`

Output plugins to enable. Currently available: `"claude-code"`. Plugins receive compiled profiles and write platform-specific output files. See [Claude Code Plugin](#claude-code-plugin).

Each entry can be a simple string (plugin name) or an object with plugin-specific options:

```jsonc
// String form — uses all defaults
"plugins": ["claude-code"]

// Object form with customization
"plugins": [{
  "name": "claude-code",
  "outputDir": "./plugins/my-custom-agents",
  "claudeCodePluginName": "my-org-agents"
}]
```

For the `claude-code` plugin, the object form supports:

| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| `name` | `string` | — | Plugin identifier (must be `"claude-code"`) |
| `outputDir` | `string` | `"./plugins/praxis"` | Full path to plugin output directory, resolved against project root |
| `claudeCodePluginName` | `string` | `"praxis"` | The `name` field written to `.claude-plugin/plugin.json` |

#### `validation`

**Type:** `{ apiKeyEnvVar: string, model: string }` | **Default:** (set in scaffold, no code fallback)

Configuration for AI-powered document validation via [OpenRouter](https://openrouter.ai).

```json
{
  "validation": {
    "apiKeyEnvVar": "OPENROUTER_API_KEY",
    "model": "x-ai/grok-4.1-fast"
  }
}
```

| Property | Purpose |
|----------|---------|
| `apiKeyEnvVar` | Name of the environment variable containing your OpenRouter API key |
| `model` | OpenRouter model identifier to use for validation |

The `praxis init` scaffold provides sensible defaults. If the `validation` section is missing from your config, `praxis validate` will exit with a helpful error directing you to add it.

## Role Frontmatter

A role's frontmatter is its manifest — it declares everything the compiler needs to assemble the agent profile:

```yaml
---
title: Code Reviewer
type: role
alias: reviewer
description: "Reviews pull requests against team conventions and coding standards."

constitution:
  - context/constitution/*.md
context:
  - context/conventions/code-style.md
responsibilities:
  - responsibilities/review-pull-requests.md
  - responsibilities/enforce-standards.md
refs:
  - reference/architecture-decisions.md
---
```

All paths are relative to the project root and support glob patterns.

| Key | Type | Purpose |
|-----|------|---------|
| `title` | `string` | Display name for the role |
| `type` | `string` | Document type (should be `"role"`) |
| `alias` | `string` | Short name used for the compiled filename and `--alias` flag |
| `description` | `string` | What this agent does — used by plugins for agent metadata |
| `constitution` | `string[]` | Glob patterns or paths to constitution files to inline |
| `context` | `string[]` | Additional context files to inline (conventions, lenses, etc.) |
| `responsibilities` | `string[]` | Responsibility files this role owns |
| `refs` | `string[]` | Reference files to include |

The compiler resolves each path/glob, reads the referenced files, strips their frontmatter, and inlines the body content into the compiled profile under the appropriate section heading (Role, Responsibilities, Constitution, Context, Reference).

## Claude Code Plugin

Add `"claude-code"` to the `plugins` array to generate [Claude Code](https://docs.anthropic.com/en/docs/claude-code) agent files:

```json
{
  "plugins": ["claude-code"]
}
```

The plugin wraps each compiled profile with Claude Code YAML frontmatter and writes agent files to `plugins/praxis/agents/{alias}.md`. It also creates and maintains the `.claude-plugin/plugin.json` manifest and a `/validate` slash command inside the plugin output directory.

To customize the output location or plugin name:

```json
{
  "plugins": [{
    "name": "claude-code",
    "outputDir": "./plugins/my-agents",
    "claudeCodePluginName": "my-org"
  }]
}
```

Run `praxis init` again after enabling the plugin to scaffold the Claude Code plugin directory structure.

### Agent Frontmatter Fields

The plugin reads these optional frontmatter fields from your role files:

| Role Frontmatter | Claude Code Output | Example |
|------------------|--------------------|---------|
| `agent_tools` | `tools` | `Read, Glob, Grep` |
| `agent_model` | `model` | `opus`, `sonnet` |
| `agent_permission_mode` | `permissionMode` | `plan`, `bypassPermissions` |

Example role with Claude Code fields:

```yaml
---
title: Linear Manager
alias: Steve
description: "Use this agent to manage Linear projects and issues following company conventions."
agent_tools: Read, Glob, Grep
agent_model: opus
agent_permission_mode: plan

constitution:
  - context/constitution/*.md
responsibilities:
  - responsibilities/explain-linear-issues.md
  - responsibilities/manage-linear-resources.md
---
```

This compiles to:
- **Pure profile:** `agent-profiles/steve.md`
- **Claude Code agent:** `plugins/praxis/agents/steve.md` (with Claude Code frontmatter)

### Validate Command

The plugin includes a `/validate` slash command that lets Claude Code users validate documents without needing an OpenRouter API key. Claude Code uses its own LLM to check the document against the README specification in the same directory — the same criteria used by `praxis validate`.

```
/praxis:validate roles/my-role.md
```

This is useful for teams that have Claude Code licenses but don't distribute OpenRouter keys. Users can validate documents one at a time before CI runs the full `praxis validate` suite.

## License

MIT
