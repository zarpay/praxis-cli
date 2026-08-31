# praxis init

Scaffolds a new Praxis project in the target directory.

## Usage

```bash
praxis init [directory]
```

If `directory` is omitted, scaffolding happens in the current working directory.

## What it creates

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

## Claude Code plugin scaffolding

If the `claude-code` plugin is listed in `.praxis/config.json` at init time, Praxis also scaffolds the plugin directory structure:

```
plugins/
└── praxis/
    ├── agents/                  ← compiled agent files land here
    ├── .claude-plugin/
    │   └── plugin.json
    └── commands/
        └── validate.md          ← /praxis:validate slash command
```

Re-running `praxis init` after adding the plugin to config will scaffold these directories without touching your existing agent files.

## Default config

The generated `.praxis/config.json`:

```json
{
  "sources": ["experts", "practices", "reference", "context"],
  "expertsDir": "experts",
  "practicesDir": "practices",
  "agentProfilesOutputDir": "./agent-profiles",
  "plugins": [],
  "judges": [
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
