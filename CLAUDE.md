# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a three-project repository:

- **`cli/`** — the `@zarpay/praxis-cli` npm package. All CLI source, tests, scaffold, tooling config, and the Praxis v2 design specs (`cli/praxis_v2_specs/`). Has its own `CLAUDE.md` with build commands, architecture, and code conventions — read it before working on the CLI.
- **`site/`** — the VitePress documentation site. Self-contained (`cd site && npm install && npm run dev`).
- **`demo/`** — Scoop Society, a small TypeScript API that uses the development CLI (`file:../cli` dependency) as a real Praxis project: its `knowledge/` compiles into SME profiles, and its `src/` directories carry spec READMEs that `praxis eval run` reviews. Use it to verify end-to-end behavior of CLI changes.

## Working rules

- Run all CLI commands (`npm test`, `npm run lint`, etc.) from `cli/`, not the repo root.
- The demo depends on `cli/dist/` — run `npm run build` in `cli/` before exercising the demo against fresh changes.
- `praxis eval run` in the demo needs `OPENROUTER_API_KEY`; `praxis compile` and `praxis status` work offline.
- Site docs (`site/`) are part of a feature's definition of done: update the affected pages in the same milestone branch as the code, so docs and implementation merge and publish together.

## Branching

v2 development lives on the long-lived **`v2`** branch; milestone branches (e.g. `m2-critique-flow`) branch off `v2` and merge back into it. **`main` stays at the 1.4.x line** — it receives only docs fixes and v1 hotfixes — and `v2` merges into `main` only at v2 release time. The v2 design specs (`cli/praxis_v2_specs/`) continue to evolve on `v2` alongside the implementation.
