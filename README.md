# Praxis

Praxis is a **conceptual linter and knowledge compiler**: write README specs that define what valid looks like for any set of files, enforce them with LLM reviewers, and grow a taxonomy of your codebase's recurring issues from the evidence — with every verdict cached, every run in an append-only ledger, and every rate reported honestly. It exists because tests can tell you a problem was solved, but never that it was solved with good code — and the agents writing today's code were trained on exactly that gap. When the governed documents are knowledge files, `praxis compile` assembles them into subject-matter-expert agent profiles.

**Current release: v2.0.0** (2026-09-10) — the evidence-first rebuild. See the [changelog](./cli/CHANGELOG.md) and the [docs](https://zarpay.github.io/praxis-cli/).

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
