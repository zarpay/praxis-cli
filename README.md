# Praxis

Your tests pass, your linter is green — and the code still isn't written the way your team agreed it should be. Every codebase has standards only a reader can check: services that validate input before doing work, error messages written for the person who hits them, decision records that follow the agreed shape. Nothing enforces them, so they drift — and the coding agents writing more of the code every month were trained against tests that pass or fail, never against your conventions.

Praxis makes those standards enforceable. Write a README spec that says what correct looks like for the files it governs; `praxis eval run` has LLM reviewers hold every file to it. Recurring findings grow into a named taxonomy of your codebase's real issues — every verdict cached, every run in an append-only ledger, every rate reported honestly. And when the governed documents are knowledge files, `praxis compile` assembles them into subject-matter-expert agent profiles.

**Current release: v2.1.0** (2026-09-10) — the presentation system. See the [changelog](./cli/CHANGELOG.md) and the [docs](https://zarpay.github.io/praxis-cli/).

```bash
npm install -g @zarpay/praxis-cli
```

This repository is organized as three top-level projects:

| Directory | What it is |
|---|---|
| [`cli/`](./cli/) | The `@zarpay/praxis-cli` package — source, tests, scaffold, and the [design specs](./cli/specs/). |
| [`site/`](./site/) | The documentation site (VitePress), published at [zarpay.github.io/praxis-cli](https://zarpay.github.io/praxis-cli/). |
| [`demo/`](./demo/) | Scoop Society — a small ice cream parlor review API that dogfoods the development version of Praxis end to end. |

## Quick start

```bash
# Work on the CLI
cd cli && npm install && npm test

# Run the docs site locally
cd site && npm install && npm run dev

# Exercise the dev CLI against a real project
cd demo && npm install && npx praxis status
```

## Releasing

Bump `cli/package.json`, update `cli/CHANGELOG.md`, tag `main` (`vX.Y.Z`), and publish a GitHub release — the `release.yml` workflow verifies the tag against the package version, runs the gate, and publishes to npm with provenance. `docs.yml` deploys the site on every push to `main`.

## License

MIT
