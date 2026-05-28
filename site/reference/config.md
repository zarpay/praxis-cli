# Configuration

All Praxis settings live in `.praxis/config.json`. The presence of the `.praxis/` directory marks the project root — Praxis walks up from the current working directory until it finds one.

## Full example

```json
{
  "sources": ["roles", "responsibilities", "reference", "context"],
  "ignore": ["docs/generated/**", "**/.*.md"],
  "rolesDir": "roles",
  "responsibilitiesDir": "responsibilities",
  "agentProfilesOutputDir": "./agent-profiles",
  "plugins": [
    {
      "name": "claude-code",
      "outputDir": "./plugins/praxis",
      "claudeCodePluginName": "praxis"
    }
  ],
  "validation": {
    "apiKeyEnvVar": "OPENROUTER_API_KEY",
    "model": "x-ai/grok-4.1-fast",
    "specFilePattern": "README.md"
  }
}
```

---

## `sources`

**Type:** `string[]`
**Default:** `["roles", "responsibilities", "reference", "context"]`

Directories that Praxis treats as knowledge sources. All paths are relative to the project root.

Sources are used for:
- **Validation discovery** — each directory in `sources` is scanned for spec files
- **Watch mode** — `praxis compile --watch` watches every source directory
- **Status** — `praxis status` scans sources to count documents

Any directory within sources that contains a spec file (default: `README.md`) becomes a [validation domain](/concepts/validation-domains).

```json
{ "sources": ["agents/roles", "agents/responsibilities", "knowledge/reference"] }
```

---

## `ignore`

**Type:** `string[]`
**Default:** `[]`

Glob patterns for files and directories to exclude from all source scans. Patterns are project-root-relative and support the same glob syntax as `paths` frontmatter.

```json
{ "ignore": ["docs/generated/**", "**/.*.md", "backend/vendor/**"] }
```

Ignored paths are excluded everywhere sources are scanned: document counts in `praxis status`, spec discovery in `praxis validate`, and the status dashboard. Literal subdirectory paths and filename patterns are both supported.

---

## `rolesDir`

**Type:** `string`
**Default:** `"roles"`

The directory where role `.md` files live. Used by `praxis compile` to discover roles and by `praxis add role` to place new files.

---

## `responsibilitiesDir`

**Type:** `string`
**Default:** `"responsibilities"`

The directory where responsibility `.md` files live. Used by `praxis add responsibility` to place new files.

---

## `agentProfilesOutputDir`

**Type:** `string | false`
**Default:** `"./agent-profiles"`

Where compiled pure agent profiles are written. Each role compiles to `{agentProfilesOutputDir}/{alias}.md`.

Set to `false` to disable pure profile output entirely:

```json
{ "agentProfilesOutputDir": false }
```

This is useful when you only want plugin output and don't need the plain markdown profiles.

---

## `plugins`

**Type:** `(string | PluginConfigEntry)[]`
**Default:** `[]`

Plugins to enable. Each entry is either a plugin name string or an object with plugin-specific options.

### String form

```json
{ "plugins": ["claude-code"] }
```

Uses all defaults for that plugin.

### Object form

```json
{
  "plugins": [{
    "name": "claude-code",
    "outputDir": "./plugins/my-agents",
    "claudeCodePluginName": "my-org"
  }]
}
```

### Claude Code plugin options

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | — | Must be `"claude-code"` |
| `outputDir` | `string` | `"./plugins/praxis"` | Full path to plugin output directory, resolved against project root |
| `claudeCodePluginName` | `string` | `"praxis"` | The `name` field in `plugin.json` and the slash command namespace |

---

## `validation`

**Type:** `object`
**Default:** Set by scaffold; no code fallback

Configuration for AI-powered document validation via [OpenRouter](https://openrouter.ai).

```json
{
  "validation": {
    "apiKeyEnvVar": "OPENROUTER_API_KEY",
    "model": "x-ai/grok-4.1-fast",
    "specFilePattern": "README.md"
  }
}
```

### `validation.apiKeyEnvVar`

**Type:** `string`
**Required**

The name of the environment variable containing your OpenRouter API key. Praxis reads the key at runtime from `process.env[apiKeyEnvVar]`.

### `validation.model`

**Type:** `string`
**Required**

The [OpenRouter model identifier](https://openrouter.ai/models) to use for validation. Example values:

| Model | Notes |
| --- | --- |
| `x-ai/grok-4.1-fast` | Default; fast and cost-efficient |
| `anthropic/claude-sonnet-4-5` | Higher quality, higher cost |
| `google/gemini-flash-1.5` | Alternative fast option |

### `validation.specFilePattern`

**Type:** `string`
**Default:** `"README.md"`

The filename or glob pattern that identifies spec files. Change this if your team uses a naming convention other than `README.md`.

```json
{ "specFilePattern": "SPEC.md" }
```

Glob patterns are supported:

```json
{ "specFilePattern": "*.spec.md" }
```

---

## See also

- [praxis init](/commands/init)
- [Validation Domains](/concepts/validation-domains)
- [Claude Code Plugin](/plugins/claude-code)
