# praxis init

Scaffolds a new Praxis project in the target directory.

## Usage

```bash
praxis init [directory]
praxis init [directory] --spec-layer
```

If `directory` is omitted, scaffolding happens in the current working directory.

## What it creates

By default, init scaffolds only the eval layer — the `.praxis/` tree:

```
my-org/
└── .praxis/
    └── config.json              ← reviewers, sources, specFilePattern
```

Your specs are your existing files (READMEs and the like); point the
config's `sources` at the directories they live in and run
`praxis eval run`. Nothing else is written to your repo.

## `--spec-layer`

Pass `--spec-layer` to also scaffold the knowledge-authoring taxonomy
the compiler works with (experts, practices, constitution, reference).
It is safe to run later on an existing eval-layer project — existing
files are never overwritten:

```
my-org/
├── .praxis/
│   └── config.json              ← project configuration
├── context/
│   ├── constitution/
│   │   ├── README.md            ← validation spec
│   │   ├── identity.md          ← starter: who you are
│   │   ├── principles.md        ← starter: what you value
│   │   └── _template.md         ← template for new constitution docs
│   ├── conventions/
│   │   ├── README.md
│   │   ├── documentation.md     ← starter: writing conventions
│   │   └── _template.md
│   └── lenses/
│       ├── README.md
│       └── _template.md
├── experts/
│   ├── README.md
│   ├── praxis-steward.md        ← built-in: knowledge framework steward
│   ├── praxis-recruiter.md      ← built-in: talent and team sourcing
│   └── _template.md
├── practices/
│   ├── README.md
│   └── _template.md
├── reference/
│   ├── README.md
│   └── _template.md
├── agent-profiles/              ← compiled output (created on first compile)
└── plugins/                     ← plugin output (created on first compile)
```

## Safe to re-run

`praxis init` skips any file that already exists. It is safe to run on an existing project to scaffold new sections or restore accidentally deleted templates.

## Plugin output comes from compile, not init

Plugin directories are written by the first `praxis compile` with the plugin enabled — never by init. With the `claude-code` plugin configured, compile produces:

```
plugins/
└── praxis/
    ├── agents/                  ← compiled agent files
    ├── .claude-plugin/
    │   └── plugin.json
    ├── commands/
    │   └── praxis-resolve.md    ← /praxis-resolve slash command
    └── skills/
        └── praxis/SKILL.md      ← the agent-facing CLI reference
```

## Default config

The eval-layer `.praxis/config.json` (default init):

```json
{
  "sources": [],
  "specFilePattern": "README.md",
  "reviewers": [
    {
      "name": "default",
      "model": "x-ai/grok-4.1-fast",
      "apiKeyEnvVar": "OPENROUTER_API_KEY"
    }
  ]
}
```

Point `sources` at the directories your specs live in — Scoop Society uses `["knowledge", "src", "tests"]` — and rename or multiply the reviewers as you see fit.

With `--spec-layer`, the config also wires the authoring taxonomy:

```json
{
  "sources": ["experts", "practices", "reference", "context"],
  "expertsDir": "experts",
  "practicesDir": "practices",
  "agentProfilesOutputDir": "./agent-profiles",
  "plugins": [],
  "reviewers": [
    {
      "name": "default",
      "model": "x-ai/grok-4.1-fast",
      "apiKeyEnvVar": "OPENROUTER_API_KEY"
    }
  ]
}
```

Edit this file to customize the project structure. See [Configuration](/reference/config) for all options.

## See also

- [Configuration](/reference/config)
- [praxis compile](/commands/compile)
- [Claude Code Plugin](/plugins/claude-code)
