# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run build          # tsup → dist/index.js (ESM, Node 18+, shebang-enabled)
npm run dev            # tsup in watch mode
npm test               # vitest run (all tests)
npm run test:watch     # vitest watch mode
npm test -- tests/eval/cache-manager.test.ts  # run single test file
npm run lint           # eslint src/ tests/
npm run typecheck      # tsc --noEmit
npm run format         # prettier --write
npm publish --access public  # prepublishOnly runs: lint → typecheck → test → build
```

## Architecture

`src/` is organised by **ownership**, not by category. Every directory answers
"what goes in here and what doesn't?" — a directory named for a kind of thing
(`models/`, `prompts/`) collects unrelated code, which is what the old layout did.

```
src/
  index.ts        CLI entry
  types.ts        Praxis vocabulary more than one domain needs; the framework's
                  own shapes live in framework/types.ts
  framework/      the mini-framework this CLI is built from, knowing nothing
                  about Praxis: errors, files, paths, frontmatter, markdown-file,
                  its own types, prepare-orchestrator, and views/ (the render kit)
  templates/      the body of every file Praxis writes, one typed function each
  spec/           authoring → agent profiles (plus plugins/: output formats)
  eval/           evaluating targets against specs (plus providers/: backends)
  workspace/      the project itself: config, paths, discovery, health
  commands/       route declarations only — options in, one orchestrator call out
```

**Dependencies flow one way, and ESLint enforces it:**

```
framework, templates  →  workspace/{models,types}  →  spec, eval  →  commands
```

- `framework/` knows nothing about Praxis and depends on no domain. The test is
  whether a thing could be lifted into any markdown-and-config CLI unchanged;
  anything that knows what `.praxis/` is belongs to a domain. Where the framework
  needs something application-specific it takes it as a parameter:
  `prepareOrchestrator` is generic in its context, and
  `workspace/prepare-orchestrator.ts` binds it to Praxis's — that binding lives in
  workspace because `workspace/models` already depends on the framework.
- **`workspace` is the only domain the others may reach into.** `spec` and `eval`
  import its models and types (`PraxisConfig`, `Paths`, `DocumentFile`) and stay
  isolated from each other (11-spec-layer.md): the spec layer produces artifacts
  the eval layer consumes as plain files, and the eval layer never calls back.
- That reach-in is scoped to `workspace/models/` and `workspace/types.ts`, which
  may not import a domain themselves. Workspace's health slice — `audit-experts`,
  `tally-validation`, `analyze-project` — reads _back_ into both layers, so a
  domain importing it would be a cycle.
- Nothing imports `commands/`.

That handoff between the layers is a real contract: an expert's `validates:` is
compiled out as the spec's `paths:` (`spec/views/targeting.ts` writes it,
`eval/services/discover-domains-service.ts` reads it), and `cohort:`/`excludes:`/
`exemplars:` pass through under the same names. `ExpertFile` and `SpecFile` are
the two ends of it.

### The four layers inside a domain

| Layer            | What belongs here                                                                                                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `models/`        | Data structures and the helpers on that data. **Validate on construction** — a model that exists is a valid document. No I/O beyond reading its own file. `SpecFile`, `ExpertFile`, `Reviewer`, `ReviewSubject`.                              |
| `services/`      | **One file, one default-exported function**, one input → one output. Operates on primitives and models and returns its work; no workflow. `expandGlobs`, `auditExperts`, `discoverDomains`, `requestVerdict`.                                 |
| `orchestrators/` | **One file, one default-exported `Orchestrator`.** Coordinates services into a workflow, renders the result, and returns a `CommandOutcome`. The whole of what a command does. `run-eval-orchestrator.ts`, `compile-project-orchestrator.ts`. |
| `views/`         | Rendering only — pure functions returning `DisplayEntry[]` or strings, never performing work. `unitHeading`, `issueBlocks`, `evalTargetingLines`.                                                                                             |

A domain's `prompts/` holds text sent to a model — the eval domain's six reviewer
prompts. Text _written to a file_ is a template instead, and lives in
`src/templates/`: the expert and practice documents `praxis add` creates, and the
skill and slash-command documents the Claude Code plugin installs. One emitted
file, one typed function, one source.

**Services and orchestrators are functions, not classes.** One file, one
default-exported function, taking a single input payload and returning a single
result — both declared in the domain's `types.ts`. Nothing to construct, nothing
to inject, nothing to mock; a test calls the function with a literal. It is the
same one-per-file rule the prompts already follow — and the commands too, each
one a default-exported `CommandRegistrar` that `index.ts` is the only caller of.

Classes remain for four things, and only these:

- **Models** — data plus helpers on that data, validated on construction.
- **Extension-point contracts** — `CompilerPlugin`, `ReviewProvider`. A third
  party implements these against a documented interface; implementations live in
  the domain's `plugins/` and `providers/`, not under `services/`.
- **`VerdictCache`** — where one reviewer's verdicts live and under what key,
  bound to one reviewer identity. As functions, every call would re-thread
  `{ projectRoot, reviewer }`; the reads and writes themselves are services
  (`read-verdict`, `write-verdict`) that take it.
- Anything else genuinely better expressed as a smart data object.

**A command calls exactly one orchestrator, and does nothing with what comes
back.** `prepareOrchestrator` (`workspace/prepare-orchestrator.ts`) is the composition
root: it returns the commander handler, building one `CommandContext` per dispatch — root, paths, config, logger,
and Display — and applying the single error policy. Because both sides have a
fixed shape, it also derives the orchestrator's `options` from commander's own
`registeredArguments` and `opts()`, so a command names its orchestrator rather
than calling it. An orchestrator exports itself already wrapped —
`export default prepareOrchestrator(runEval)` — so a command imports it and hands
it to `.action()` with nothing in between. Its named export is the unwrapped
orchestrator, which is what tests call. Name a command's flags and arguments
to match its `Options` type and the wiring writes itself; a second argument
supplies only what the CLI cannot, like `{ ci: true }`. A command therefore imports orchestrators and
its orchestrators, and nothing else; the orchestrator owns the response, rendering
included, and hands back only a `CommandOutcome` for the exit code.

Both layers state their signature as a named type rather than a convention, each
applied to the exported const: `CommandRegistrar` (`src/types.ts`) for a command
file, and `Orchestrator<Options>` (`workspace/types.ts`) for what it
calls. That fixes the arity, so an orchestrator taking no options is
still called with `{}` — `analyzeProject(ctx, {})` — and there is one call shape
across every command. They are all `async`, which gives `prepareOrchestrator` one shape to
await and one channel for failures: a non-async function returning
`Promise.resolve()` throws synchronously, which is a second signature in disguise.

**Because an orchestrator renders, the data it renders is assembled in a
service.** An orchestrator that computes a report and prints it has made that
report untestable. Push the computation down and the orchestrator becomes
coordinate → render → signal: `build-status-report`, `review-all`,
`review-named` and `collect-verdict-reports` are that split, and the tests point
at them rather than at captured stdout. Long runs still stream through an
`onProgress` callback the orchestrator supplies and renders.

### Spec Layer — Compiler Pipeline

```
Expert .md file (with YAML frontmatter)
  → Document parsed (framework/markdown-file.ts → framework/frontmatter.ts)
  → Referenced content resolved via globs (spec/services/expand-globs-service.ts)
  → Sections assembled: Expert → Responsibilities → Constitution → Context → Reference
      (spec/services/build-profile-service.ts)
  → Pure profile written to agentProfilesOutputDir/{alias}.md
  → Each plugin receives profile + metadata and writes its own output
      (spec/services/resolve-plugins-service.ts → plugins/*)
```

The **Claude Code plugin** (`spec/plugins/claude-code.ts`) wraps the profile with YAML frontmatter (name, description, tools, model, permissionMode), writes to `{outputDir}/agents/{alias}.md` (default `plugins/praxis/agents/`), and creates/updates `.claude-plugin/plugin.json` in the output directory.

### Eval Layer — Reviewer Pipeline

```
Spec discovered (specFilePattern match, frontmatter read)
  → Units resolved: paths:/cohort: expand; excludes:/exemplars: shielded from review
  → Assist inputs resolved: exemplars: + context: files (eval/services/resolve-assist-inputs-service.ts)
  → Content hash computed over the full review input: target + spec + assist (SHA256, 8-char prefix)
  → Cache checked: one file per target at .praxis/cache/validation/<target-path>.json,
      verdicts keyed <specHash>:<reviewerHash> (format 3.0)
  → On miss: one call per configured reviewer via its provider (default: OpenRouter, tool_choice: required)
  → Verdict from the tool call (pass/warn/fail + issues); cached with content_hash
      and assist provenance (exemplar_files/context_files with per-file hashes)
```

Spec frontmatter keys the eval layer honors: `paths:`, `cohort: by_file | by_directory`, `excludes:` (never evaluated), `exemplars:` (shielded positives, inlined into the prompt), `context:` (assist-only, inlined, joins the hash).

Key files: `eval/services/request-verdict-service.ts`, `eval/models/` (Reviewer, ReviewSubject, SpecFile), `eval/services/` (resolve-assist-inputs, verdict-cache, hash-reviewer, discover-domains, resolve-units), `eval/orchestrators/run-eval-orchestrator.ts`, `eval/views/`, `eval/prompts/`.

### Project Root Detection

`framework/paths.ts` walks up from cwd until it finds a `.praxis/` directory. All paths resolve relative to this root. Config loads from `.praxis/config.json`.

### Configuration

Config lives at `{root}/.praxis/config.json` with these fields:

- `sources: string[]` — directories scanned for documents (default: `experts`, `practices`, `reference`, `context`)
- `expertsDir: string` — where expert `.md` files live (default: `"experts"`)
- `practicesDir: string` — where practice `.md` files live (default: `"practices"`)
- `agentProfilesOutputDir: string | false` — where pure profiles are written (default: `"./agent-profiles"`)
- `plugins: (string | PluginConfigEntry)[]` — enabled plugins with optional per-plugin config (default: `[]`). String entries are normalized to `{ name: theString }`. Object entries support `name`, `outputDir`, `claudeCodePluginName`.
- `reviewers: { name, model, apiKeyEnvVar, baseUrl?, temperature?, provider?, options? }[]` — the configured reviewers; every reviewer evaluates every target, each with its own cache namespace keyed by its behavioral hash. `provider` selects the execution backend: a built-in registry name (default `"openrouter"`) or a `./relative` ESM module path whose default export is a provider factory (`eval/types.ts`); `options` passes through to the provider verbatim (`eval/services/hash-reviewer-service.ts`: whole config canonically hashed minus `name`/`apiKeyEnvVar`, plus the system prompt). The v1 `validation` section is removed — v2 is a breaking release.
- `specFilePattern?: string` — top-level; filename or glob for spec files (default `README.md`).

### Plugin System

Plugins implement the `CompilerPlugin` interface (`spec/types.ts`): `name` property and `compile(profileContent, metadata, roleAlias)` method. Registered in `spec/services/resolve-plugins-service.ts`. Enabled via `plugins` array in config. Each plugin receives a `PluginConfigEntry` with per-plugin options (e.g., `outputDir`, `claudeCodePluginName`). The Claude Code plugin writes agent files to `{outputDir}/agents/` and manages `.claude-plugin/plugin.json`.

## Code Conventions

- **A file's name states its layer, and its export states its name:** files under `commands/`, `orchestrators/` and `services/` end `-command.ts`, `-orchestrator.ts`, `-service.ts`, and any named (non-default) export is that filename in camelCase — `run-eval-orchestrator.ts` exports `runEvalOrchestrator`. An import statement then says what kind of thing it is pulling in. The extension-point classes are not services and do not live under `services/`: they have their own `providers/` and `plugins/` directories, named for what they integrate with (`openrouter.ts`, `claude-code.ts`) because that name is what a user writes in the config.
- **Types live in a `types.ts`:** a domain's own (`<domain>/types.ts`) for its vocabulary, or `src/types.ts` for shapes more than one domain needs — `ReviewerConfig` (normalized by `workspace/models/praxis-config.ts`) and `CohortMode` (declared by an expert, honored by a spec) are there for that reason. ESLint bans interface/type-alias declarations anywhere else in `src/`. Modules declare behavior — classes, functions, constants — never shapes. Sole exception: `framework/files.ts` re-exports node's `FSWatcher`, because `node:fs` is walled into that module.
- **Path aliases:** `@/*` → `./src/*`, `@tests/*` → `./tests/*` (tsconfig.json and vitest.config.ts). Imports always use aliases, never relative paths (ESLint-enforced; sole exception: `../package.json`).
- **Import order:** third-party types, internal types, third-party values, internal values — blank line between groups, alphabetical within (perfectionist, autofixable)
- **Import extensions:** `.js` required for local imports (ESM)
- **No nested ternaries** (ESLint `no-nested-ternary`): a ternary never appears inside another ternary's branch, object literal included — use if/else or a small helper.
- **Conditionals breathe:** blank line before and after `if`/`switch`, except at block edges (@stylistic, autofixable)
- **Unused args:** Prefix with `_` (eslint rule)
- **Formatting:** Double quotes, semicolons, trailing commas, 100-char line width
- **Test location:** `tests/` mirrors `src/` structure, uses `.test.ts` suffix
- **Excluded from compilation:** Files named `_template.md` or `README.md`
- **File/path operations:** import from `@/framework/files.js` (I/O: readText, writeText, exists, ...) and `@/framework/paths.js` (composition: joinPath, baseName, ...; well-known locations: configFile, SCAFFOLD_DIR, ...). `node:fs` and `node:path` are restricted to those two modules (ESLint-enforced). Where a _Praxis project_ keeps its files is `workspace/models/project-paths.ts`, not the framework.
- **Construct at invocation time, not import time:** module tops hold definitions, not work. `new Paths()` (and anything touching cwd or the filesystem) belongs in the command wiring helpers (`makeCommand()`), executed at action dispatch — never as a module-level instance or exported singleton (decided 2026-08-31: import-time cwd capture, test isolation, and `praxis init` running before `.praxis/` exists).
- **Prompts:** every LLM/agent-facing prompt lives in its domain's `prompts/`, one prompt per file, as that file's default-export function — typed parameters wherever the prompt templates, with the parameter interfaces in the domain's `types.ts`. No prompt text inline anywhere else. The reviewer hash covers the complete reviewer-facing surface via `eval/prompts/prompt-surface.ts`; rewording any of it is a reviewer-identity change (new epoch), by design.
- **Command context:** every orchestrator's first parameter is a `CommandContext` (`@/workspace/models/command-context.js`) carrying `root`, `paths`, `config`, `logger` and `out`. `root` and `config` resolve lazily and cache, because `praxis init` runs before a `.praxis/` directory exists. It lives in workspace rather than the framework because it holds `PraxisConfig` and `Paths`, and the framework depends on no domain. Construct one only in `prepareOrchestrator` — or, in a test, via `testContext(root)`.
- **Terminal output:** all output goes through the view kit — `@/framework/views/display.js` for stdout and `@/framework/views/logger.js` for stderr. `Display.print([...])` renders a whole stdout block as one payload of entries (plain strings; `{ text, color }`; `{ badge, color, value, indent? }`; `{ header, char?, width? }`; falsy entries skipped so conditionals inline), with `line()` for single lines; `Logger` writes stderr diagnostics. Raw `console.*` is banned outside those two modules (ESLint `no-console`). Reusable rendering — badge rows, aligned stat blocks, tables — lives in `@/framework/views/badges.js`, `@/framework/views/stats.js`, `@/framework/views/table.js` rather than being hand-built at the call site.
