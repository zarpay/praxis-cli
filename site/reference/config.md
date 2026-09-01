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
  "judges": [
    { "name": "default", "model": "x-ai/grok-4.1-fast", "apiKeyEnvVar": "OPENROUTER_API_KEY" }
  ],
  "specFilePattern": "README.md"
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

## `judges`

**Type:** `array`
**Default:** `[]` (evaluation requires at least one)

The judges — named inference backends that evaluate targets against specs. **Every configured judge evaluates every target**, and every report shows results per judge, never pooled. Run a single judge with `praxis eval run --judge <name>`.

```json
{
  "judges": [
    { "name": "flash", "model": "deepseek/deepseek-v4-flash-0731", "apiKeyEnvVar": "OPENROUTER_API_KEY" },
    { "name": "local", "model": "org-model", "baseUrl": "https://inference.internal/v1", "apiKeyEnvVar": "INTERNAL_KEY" }
  ]
}
```

### Per-judge fields

| Field | Required | Description |
| --- | --- | --- |
| `name` | yes | Unique label identifying the judge's verdicts in results and reports |
| `model` | yes | Model identifier the backend understands (e.g. an [OpenRouter slug](https://openrouter.ai/models)) |
| `apiKeyEnvVar` | yes | Environment variable holding the backend's API key |
| `baseUrl` | no | OpenAI-compatible endpoint base; defaults to OpenRouter |
| `temperature` | no | Sampling temperature for judgments; defaults to `0` |

Each target's cache file holds every judge's verdicts, keyed by a hash of the judge's *behavioral* settings — the whole entry minus `name` and `apiKeyEnvVar`, plus the judging prompt. Renaming a judge or rotating a key keeps its cached verdicts; changing the model, endpoint, or temperature invalidates them.

::: warning Breaking change in v2
### Providers

Each judge runs through a **provider** — the backend that executes the judgment and returns a normalized verdict plus usage (tokens and, where reported, cost). `provider` defaults to `"openrouter"`, which speaks to OpenRouter or any OpenAI-compatible endpoint (`baseUrl`). A judge can instead point at a local ESM module, resolved from the project root:

```json
{
  "judges": [
    { "name": "flash", "model": "deepseek/deepseek-v4-flash-0731", "apiKeyEnvVar": "OPENROUTER_API_KEY" },
    {
      "name": "internal",
      "model": "org-model",
      "apiKeyEnvVar": "INTERNAL_KEY",
      "provider": "./praxis-providers/internal.js",
      "options": { "region": "us-east-1" }
    }
  ]
}
```

```js
// praxis-providers/internal.js — default export is a factory
export default function internalProvider() {
  return {
    name: "internal",
    async judge(request) {
      // request: systemPrompt, userPrompt, tools, model, temperature,
      //          baseUrl, apiKey (resolved), options
      // call anything; return the normalized contract:
      return {
        verdict: { compliant: true, issues: [], reason: "..." },
        usage: { promptTokens: 812, completionTokens: 41, costUsd: null },
      };
    },
  };
}
```

`options` is passed to the provider verbatim. For the built-in OpenRouter provider it is spread into the request body first, so it can add backend fields (routing, reasoning settings) but never overrides `model`, `temperature`, or the tool-calling protocol. Both `provider` and `options` are part of the judge's behavioral identity: changing them re-judges that judge's targets. A local provider module is code your project runs — treat it with the same trust as an npm script.

The v1 `validation` section is removed. Configure `judges` instead, and move `specFilePattern` to the top level.
:::

## `specFilePattern`

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

## Breaking changes from 1.x

v2 drops every 1.x compatibility spelling — nothing is aliased or
normalized:

| Removed | Use instead |
| --- | --- |
| `rolesDir` / `responsibilitiesDir` config keys | `expertsDir` / `practicesDir` |
| `type: role` / `type: responsibility` frontmatter | `type: expert` / `type: practice` |
| `responsibilities:` list in an expert file | `practices:` |
| `validation:` config section | `judges:` + top-level `specFilePattern` |
| `constitution: true` | an explicit glob, e.g. `constitution: "context/constitution/*.md"` |
| `praxis validate document\|all\|ci\|report` | `praxis eval run\|ci\|verdict` |
| `praxis add role\|responsibility` | `praxis add expert\|practice` |

Default `sources` are `["experts", "practices", "reference", "context"]`.
