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

Praxis is two layers (see `praxis_v2_specs/11-spec-layer.md`), and `src/` mirrors them:

- **`src/spec/`** — the spec layer: compiles experts, practices, and context into self-contained SME agent profiles. Owns the content taxonomy.
- **`src/eval/`** — the eval layer: judges targets against specs, caches verdicts, and (as v2 lands) writes the ledger. Taxonomy-free.
- **`src/core/`** — shared primitives both layers use: config, errors, files, paths, logger, frontmatter, spec-pattern.
- **`src/prompts/`** — every LLM/agent-facing prompt, one per file as a typed default-export function. A shared leaf like core: both layers import it, it imports neither (ESLint-enforced).
- **`src/models/`** — typed readers for the project's document kinds (`SpecFile`, `ExpertFile`), each naming the frontmatter keys its kind honors so those spellings live in one place. A shared leaf like core and prompts: it imports neither layer (ESLint-enforced). **Caveat:** because it is shared, the eval layer *can* import `ExpertFile`, which is spec-layer taxonomy — nothing but review prevents it. Keep `@/eval` free of taxonomy models by convention.
- **`src/commands/`** — CLI wiring; the only place the two layers meet.

**The layers never import each other** (ESLint-enforced): the spec layer produces files the eval layer consumes as plain specs. That handoff is a real contract: an expert's `validates:` is compiled out as the spec's `paths:` (`spec/output-builder.ts:evalTargetingLines` writes it, `eval/eval-run.ts:discoverValidationDomains` reads it), and `cohort:`/`excludes:`/`exemplars:` pass through under the same names. `ExpertFile` and `SpecFile` are the two ends of it.

### Spec Layer — Compiler Pipeline

```
Expert .md file (with YAML frontmatter)
  → Frontmatter parsed (src/core/frontmatter.ts)
  → Referenced content resolved via globs (src/spec/glob-expander.ts)
  → Sections assembled: Expert → Responsibilities → Constitution → Context → Reference
      (src/spec/output-builder.ts)
  → Pure profile written to agentProfilesOutputDir/{alias}.md
  → Each plugin receives profile + metadata and writes its own output
      (src/spec/plugin-registry.ts → plugins/*)
```

The **Claude Code plugin** (`src/spec/plugins/claude-code.ts`) wraps the profile with YAML frontmatter (name, description, tools, model, permissionMode), writes to `{outputDir}/agents/{alias}.md` (default `plugins/praxis/agents/`), and creates/updates `.claude-plugin/plugin.json` in the output directory.

### Eval Layer — Judge Pipeline

```
Spec discovered (specFilePattern match, frontmatter read)
  → Units resolved: paths:/cohort: expand; excludes:/exemplars: shielded from judgment
  → Assist inputs resolved: exemplars: + context: files (src/eval/judgment-input.ts)
  → Content hash computed over the full judgment input: target + spec + assist (SHA256, 8-char prefix)
  → Cache checked: one file per target at .praxis/cache/validation/<target-path>.json,
      verdicts keyed <specHash>:<judgeHash> (format 3.0)
  → On miss: one call per configured judge via its provider (default: OpenRouter, tool_choice: required)
  → Verdict from the tool call (pass/warn/fail + issues); cached with content_hash
      and assist provenance (exemplar_files/context_files with per-file hashes)
```

Spec frontmatter keys the eval layer honors: `paths:`, `cohort: by_file | by_directory`, `excludes:` (never judged), `exemplars:` (shielded positives, inlined into the prompt), `context:` (assist-only, inlined, joins the hash).

Key files: `src/eval/judge.ts`, `src/prompts/` (one prompt per file), `src/eval/judgment-input.ts`, `src/eval/cache-manager.ts`, `src/eval/eval-run.ts`, `src/eval/verdict-reporter.ts`, `src/eval/judge-hash.ts`.

### Project Root Detection

`src/core/paths.ts` walks up from cwd until it finds a `.praxis/` directory. All paths resolve relative to this root. Config loads from `.praxis/config.json`.

### Configuration

Config lives at `{root}/.praxis/config.json` with these fields:
- `sources: string[]` — directories scanned for documents (default: `experts`, `practices`, `reference`, `context`)
- `expertsDir: string` — where expert `.md` files live (default: `"experts"`)
- `practicesDir: string` — where practice `.md` files live (default: `"practices"`)
- `agentProfilesOutputDir: string | false` — where pure profiles are written (default: `"./agent-profiles"`)
- `plugins: (string | PluginConfigEntry)[]` — enabled plugins with optional per-plugin config (default: `[]`). String entries are normalized to `{ name: theString }`. Object entries support `name`, `outputDir`, `claudeCodePluginName`.
- `judges: { name, model, apiKeyEnvVar, baseUrl?, temperature?, provider?, options? }[]` — the configured judges; every judge evaluates every target, each with its own cache namespace keyed by its behavioral hash. `provider` selects the execution backend: a built-in registry name (default `"openrouter"`) or a `./relative` ESM module path whose default export is a provider factory (`src/eval/providers/types.ts`); `options` passes through to the provider verbatim (`src/eval/judge-hash.ts`: whole config canonically hashed minus `name`/`apiKeyEnvVar`, plus the system prompt). The v1 `validation` section is removed — v2 is a breaking release.
- `specFilePattern?: string` — top-level; filename or glob for spec files (default `README.md`).

### Plugin System

Plugins implement `CompilerPlugin` interface (`src/spec/plugins/types.ts`): `name` property and `compile(profileContent, metadata, roleAlias)` method. Registered in `src/spec/plugin-registry.ts`. Enabled via `plugins` array in config. Each plugin receives a `PluginConfigEntry` with per-plugin options (e.g., `outputDir`, `claudeCodePluginName`). The Claude Code plugin writes agent files to `{outputDir}/agents/` and manages `.claude-plugin/plugin.json`.

## Code Conventions

- **One types home:** every type and interface is declared in `src/types.ts`, organized by domain, and imported from `@/types.js` (ESLint-enforced: interface/type-alias declarations are banned elsewhere in src/). Modules declare behavior — classes, functions, constants — never shapes. Sole exception: `core/files.ts` re-exports node's `FSWatcher`, because `node:fs` is walled into that module.
- **Path aliases:** `@/*` → `./src/*`, `@tests/*` → `./tests/*` (tsconfig.json and vitest.config.ts). Imports always use aliases, never relative paths (ESLint-enforced; sole exception: `../package.json`).
- **Import order:** third-party types, internal types, third-party values, internal values — blank line between groups, alphabetical within (perfectionist, autofixable)
- **Import extensions:** `.js` required for local imports (ESM)
- **No nested ternaries** (ESLint `no-nested-ternary`): a ternary never appears inside another ternary's branch, object literal included — use if/else or a small helper.
- **Conditionals breathe:** blank line before and after `if`/`switch`, except at block edges (@stylistic, autofixable)
- **Unused args:** Prefix with `_` (eslint rule)
- **Formatting:** Double quotes, semicolons, trailing commas, 100-char line width
- **Test location:** `tests/` mirrors `src/` structure, uses `.test.ts` suffix
- **Excluded from compilation:** Files named `_template.md` or `README.md`
- **File/path operations:** import from `@/core/files.js` (I/O: readText, writeText, exists, ...) and `@/core/paths.js` (composition: joinPath, baseName, ...; well-known locations: configFile, SCAFFOLD_DIR, ...). `node:fs` and `node:path` are restricted to those two modules (ESLint-enforced).
- **Construct at invocation time, not import time:** module tops hold definitions, not work. `new Paths()` (and anything touching cwd or the filesystem) belongs in the command wiring helpers (`makeCommand()`), executed at action dispatch — never as a module-level instance or exported singleton (decided 2026-08-31: import-time cwd capture, test isolation, and `praxis init` running before `.praxis/` exists).
- **Prompts:** every LLM/agent-facing prompt lives in `src/prompts/`, one prompt per file, as that file's default-export function — typed parameters wherever the prompt templates, with the parameter interfaces grouped in `src/prompts/types.ts`. No prompt text inline anywhere else. The judge hash covers the complete judge-facing surface via `src/prompts/prompt-surface.ts`; rewording any of it is a judge-identity change (new epoch), by design.
- **Base classes:** classes extend `PraxisBase` (`@/core/base.js`) for the shared plumbing — protected `out` (Display) and `logger` (Logger), injectable — or `PraxisProjectBase` when bound to a project, which adds protected `root` and a `config` that resolves lazily from it on first access. Don't re-declare these fields.
- **Terminal output:** all output goes through `@/core/logger.js` — `Display.print([...])` renders a whole stdout block as one payload of entries (plain strings; `{ text, color }`; `{ badge, color, value, indent? }`; `{ header, char?, width? }`; falsy entries skipped so conditionals inline), with `line()` for single lines; `Logger` writes stderr diagnostics. Raw `console.*` is banned outside that module (ESLint `no-console`).
