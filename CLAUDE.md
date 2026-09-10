# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a three-project repository:

- **`cli/`** — the `@zarpay/praxis-cli` npm package. All CLI source, tests, scaffold, tooling config, and the Praxis v2 design specs (`cli/praxis_v2_specs/`). Has its own `CLAUDE.md` with build commands, architecture, and code conventions — read it before working on the CLI.
- **`site/`** — the VitePress documentation site. Self-contained (`cd site && npm install && npm run dev`).
- **`demo/`** — Scoop Society, a small TypeScript API that uses the development CLI (`file:../cli` dependency) as a real Praxis project: its `knowledge/` compiles into SME profiles, and its `src/` directories carry spec READMEs that `praxis eval run` reviews. Use it to verify end-to-end behavior of CLI changes.

## How the CLI is layered

`cli/src/` maps onto a shape most web codebases already have. The analogy is
exact enough to use as the test for where something belongs:

| Praxis           | Web equivalent      | Job                                                                                                                                     |
| ---------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `commands/`      | **Routes**          | Declare the command, its arguments and options. Parse input, call an orchestrator, render the result, map it to an exit code. No logic. |
| `orchestrators/` | **Controllers**     | Everything needed to return a command's expected output: interact with models, delegate the heavy lifting to services.                  |
| `services/`      | **Service objects** | One action, one input, one output. No workflow.                                                                                         |
| `models/`        | **Models**          | The data and the helpers on it, valid by construction.                                                                                  |
| `views/`         | **Views**           | Render. Never decide, never fetch.                                                                                                      |

**A command has a direct relationship to its orchestrators.** One command, one or
more orchestrators dedicated to it — `praxis eval run` has `run-eval` and
`review-targets`, `eval verdict` has `report-verdicts`. If a command is doing
work that is not argument parsing or rendering, that work belongs to an
orchestrator it should be calling.

The goal is that every layer is specific, clean and purposeful, and **nothing is
out of place**. When something is hard to file, that is the signal that it is two
things wearing one name — the fix is to split it, not to widen a directory's
definition.

Per-directory rules live in `.claude/rules/`, and `cli/CLAUDE.md` carries the
dependency graph and the domain boundaries.

## Working rules

- Run all CLI commands (`npm test`, `npm run lint`, etc.) from `cli/`, not the repo root.
- The demo depends on `cli/dist/` — run `npm run build` in `cli/` before exercising the demo against fresh changes.
- `praxis eval run` in the demo needs `OPENROUTER_API_KEY`; `praxis compile` and `praxis status` work offline.
- Site docs (`site/`) are part of a feature's definition of done: update the affected pages in the same milestone branch as the code, so docs and implementation merge and publish together.

## Branching

v2 development lives on the long-lived **`v2`** branch; milestone branches (e.g. `m2-critique-flow`) branch off `v2` and merge back into it. **`main` stays at the 1.4.x line** — it receives only docs fixes and v1 hotfixes — and `v2` merges into `main` only at v2 release time. The v2 design specs (`cli/praxis_v2_specs/`) continue to evolve on `v2` alongside the implementation.
