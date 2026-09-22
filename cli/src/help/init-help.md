When to use: once, at a project's root, before anything else.

Behavior:
  Writes only .praxis/config.json — with empty sources and a default
  OpenRouter reviewer — and claims the directory as a Praxis project;
  the first command run against it pins the CLI's version into the
  config (praxis enforces one version per project from then on);
  the cache, ledger, and axiom directories are created lazily by the
  first run that needs them. Your specs are your existing READMEs;
  nothing else is scaffolded. Re-running never overwrites what exists,
  so it is always safe. With --spec-layer it also scaffolds the
  authoring tree (experts/, practices/, context/) with the starter
  taxonomy, for projects that compile SME profiles as well as run
  evals.

Examples:
  $ praxis init
  $ praxis init --spec-layer

Next:
  1. Point sources in .praxis/config.json at the directories your
     code and specs live in: "sources": ["src"]
  2. Write a spec — a README.md stating what correct looks like for
     the files around it (see `praxis eval --help` for a minimal one)
  3. Export the reviewer's key (default: OPENROUTER_API_KEY) and run
     `praxis eval run`

Docs: https://zarpay.github.io/praxis-cli/commands/init
      https://zarpay.github.io/praxis-cli/getting-started/
