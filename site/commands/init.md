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
├── README.md                    ← the taxonomy's own spec
├── context/
│   ├── README.md
│   ├── constitution/
│   │   └── README.md            ← validation spec; your identity goes beside it
│   ├── conventions/
│   │   ├── README.md
│   │   └── documentation.md     ← starter: how documents here are written
│   └── lenses/
│       └── README.md
├── experts/
│   ├── praxis-steward.md        ← built-in: knowledge framework steward
│   └── praxis-recruiter.md      ← built-in: designs and reviews experts and practices
├── practices/
│   ├── audit-framework-health.md      ← starter practices
│   ├── challenge-contributor-design.md
│   ├── guide-content-placement.md
│   ├── review-content-quality.md
│   ├── review-expert-definition.md
│   └── review-practice-definition.md
├── reference/
│   ├── README.md
│   ├── practices-index.md       ← starter reference docs
│   └── praxis-vocabulary.md
├── agent-profiles/              ← compiled output (created on first compile)
└── plugins/                     ← plugin output (created on first compile)
```

New documents are created with `praxis add`, which writes them from templates compiled into the CLI — the scaffold ships starter content, not template files.

The two starter experts review the scaffold itself. The recruiter (`praxis-recruiter.md`) declares `validates:` over `experts/` and `practices/`, so after `praxis compile` its profile in `agent-profiles/` is a spec, and `praxis eval run --type praxis-recruiter` reviews every expert and practice definition, one file at a time, against its review practices. The steward (`praxis-steward.md`) declares `validates:` over `context/*` and `reference` with `cohort: by_directory`, so `praxis eval run --type praxis-steward` reviews each of those folders as one unit and can catch documents that disagree with their neighbors. The scaffold config lists `agent-profiles` under `sources` and accepts `*.expert.md` as spec files for exactly this.

## Safe to re-run

`praxis init` skips any file that already exists. It is safe to run on an existing project to scaffold new sections or restore accidentally deleted starter files.

## Plugin output comes from compile, not init

Plugin directories are written by the first `praxis compile` with the plugin enabled — never by init. With the `claude-code` plugin configured, compile produces:

```
plugins/
└── praxis/
    ├── agents/                  ← compiled agent files
    ├── .claude-plugin/
    │   └── plugin.json
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
      "model": "x-ai/grok-4.3",
      "apiKeyEnvVar": "OPENROUTER_API_KEY"
    }
  ]
}
```

Point `sources` at the directories your specs live in — Scoop Society uses `["knowledge", "src", "tests"]` — and rename or multiply the reviewers as you see fit.

With `--spec-layer`, the config also wires the authoring taxonomy:

```json
{
  "sources": ["experts", "practices", "reference", "context", "agent-profiles"],
  "expertsDir": "experts",
  "practicesDir": "practices",
  "agentProfilesOutputDir": "./agent-profiles",
  "plugins": [],
  "reviewers": [
    {
      "name": "default",
      "model": "x-ai/grok-4.3",
      "apiKeyEnvVar": "OPENROUTER_API_KEY"
    }
  ],
  "specFilePattern": "{README.md,*.expert.md}"
}
```

Edit this file to customize the project structure. See [Configuration](/reference/config) for all options.

## See also

- [Configuration](/reference/config)
- [praxis compile](/commands/compile)
- [Claude Code Plugin](/plugins/claude-code)
