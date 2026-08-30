# Configuration

All Praxis settings live in `.praxis/config.json`. The presence of the `.praxis/` directory marks the project root — Praxis walks up from the current working directory until it finds one.

## Full example

```json
{
  "sources": ["experts", "practices", "reference", "context"],
  "ignore": ["docs/generated/**", "**/.*.md"],
  "expertsDir": "experts",
  "practicesDir": "practices",
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
**Default:** `["experts", "practices", "reference", "context"]`

Directories that Praxis treats as knowledge sources. All paths are relative to the project root.

Sources are used for:
- **Validation discovery** — each directory in `sources` is scanned for spec files
- **Watch mode** — `praxis compile --watch` watches every source directory
- **Status** — `praxis status` scans sources to count documents

Any directory within sources that contains a spec file (default: `README.md`) becomes a [validation domain](/concepts/validation-domains).

```json
{ "sources": ["agents/experts", "agents/practices", "knowledge/reference"] }
```

---

## `ignore`

**Type:** `string[]`
**Default:** `[]`

Glob patterns for files and directories to exclude from all source scans. Patterns are project-root-relative and support the same glob syntax as `paths` frontmatter.

```json
{ "ignore": ["docs/generated/**", "**/.*.md", "backend/vendor/**"] }
```

Ignored paths are excluded everywhere sources are scanned: document counts in `praxis status`, spec discovery in `praxis eval run`, and the status dashboard. Literal subdirectory paths and filename patterns are both supported.

---

## `expertsDir`

**Type:** `string`
**Default:** `"experts"`

The directory where expert `.md` files live. Used by `praxis compile` to discover experts and by `praxis add expert` to place new files.

---

## `practicesDir`

**Type:** `string`
**Default:** `"practices"`

The directory where practice `.md` files live. Used by `praxis add practice` to place new files.

---

## `agentProfilesOutputDir`

**Type:** `string | false`
**Default:** `"./agent-profiles"`

Where compiled pure agent profiles are written. Each expert compiles to `{agentProfilesOutputDir}/{alias}.md`.

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
