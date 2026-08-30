# Praxis

Praxis is a **conceptual linter and knowledge compiler**: write specs that define what valid looks like for any set of files, judge them with an LLM, and compile your team's knowledge into subject-matter-expert agent profiles.

This repository is organized as three top-level projects:

| Directory | What it is |
|---|---|
| [`cli/`](./cli/) | The `@zarpay/praxis-cli` package — source, tests, scaffold, and the [v2 design specs](./cli/praxis_v2_specs/). |
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

## License

MIT
