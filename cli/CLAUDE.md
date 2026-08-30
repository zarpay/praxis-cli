# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run build          # tsup → dist/index.js (ESM, Node 18+, shebang-enabled)
npm run dev            # tsup in watch mode
npm test               # vitest run (all tests)
npm run test:watch     # vitest watch mode
npm test -- tests/judge/cache-manager.test.ts  # run single test file
npm run lint           # eslint src/ tests/
npm run typecheck      # tsc --noEmit
npm run format         # prettier --write
npm publish --access public  # prepublishOnly runs: lint → typecheck → test → build
```

## Architecture

Praxis CLI compiles human-authored knowledge documents (experts, practices, context) into self-contained agent profiles. The system has two main pipelines:

### Compiler Pipeline

```
Expert .md file (with YAML frontmatter)
  → Frontmatter parsed (src/compiler/frontmatter.ts)
  → Referenced content resolved via globs (src/compiler/glob-expander.ts)
  → Sections assembled: Expert → Responsibilities → Constitution → Context → Reference
      (src/compiler/output-builder.ts)
  → Pure profile written to agentProfilesOutputDir/{alias}.md
  → Each plugin receives profile + metadata and writes its own output
      (src/compiler/plugin-registry.ts → plugins/*)
```

The **Claude Code plugin** (`src/compiler/plugins/claude-code.ts`) wraps the profile with YAML frontmatter (name, description, tools, model, permissionMode), writes to `{outputDir}/agents/{alias}.md` (default `plugins/praxis/agents/`), and creates/updates `.claude-plugin/plugin.json` in the output directory.

### Judge Pipeline

```
Document .md + directory README.md (spec)
  → Content hash computed (SHA256, 8-char prefix)
  → Cache checked: .praxis/cache/validation/{type}/{name}.json
  → On miss: LLM call via OpenRouter API (env var name from config.validation.apiKeyEnvVar)
  → Response parsed (Yes/Maybe/No + issues)
  → Result cached with content_hash for invalidation
```

Key files: `src/judge/judge.ts`, `src/judge/cache-manager.ts`, `src/judge/batch-judge.ts`, `src/judge/report-formatter.ts`.

### Project Root Detection

`src/core/paths.ts` walks up from cwd until it finds a `.praxis/` directory. All paths resolve relative to this root. Config loads from `.praxis/config.json`.

### Configuration

Config lives at `{root}/.praxis/config.json` with these fields:
- `sources: string[]` — directories scanned for documents (default includes `experts`, `practices`, and the legacy `experts`/`practices` names)
- `expertsDir: string` — where expert `.md` files live (default: `"experts"`; deprecated `rolesDir` accepted)
- `practicesDir: string` — where practice `.md` files live (default: `"practices"`; deprecated `responsibilitiesDir` accepted)
- `agentProfilesOutputDir: string | false` — where pure profiles are written (default: `"./agent-profiles"`)
- `plugins: (string | PluginConfigEntry)[]` — enabled plugins with optional per-plugin config (default: `[]`). String entries are normalized to `{ name: theString }`. Object entries support `name`, `outputDir`, `claudeCodePluginName`.
- `validation?: { apiKeyEnvVar: string, model: string }` — OpenRouter API key env var name and judge model for `praxis eval run`. No code defaults; scaffold provides initial values.

### Plugin System

Plugins implement `CompilerPlugin` interface (`src/compiler/plugins/types.ts`): `name` property and `compile(profileContent, metadata, roleAlias)` method. Registered in `src/compiler/plugin-registry.ts`. Enabled via `plugins` array in config. Each plugin receives a `PluginConfigEntry` with per-plugin options (e.g., `outputDir`, `claudeCodePluginName`). The Claude Code plugin writes agent files to `{outputDir}/agents/` and manages `.claude-plugin/plugin.json`.

## Code Conventions

- **Path aliases:** `@/*` → `./src/*`, `@tests/*` → `./tests/*` (tsconfig.json and vitest.config.ts). Imports always use aliases, never relative paths (ESLint-enforced; sole exception: `../package.json`).
- **Import order:** third-party types, internal types, third-party values, internal values — blank line between groups, alphabetical within (perfectionist, autofixable)
- **Import extensions:** `.js` required for local imports (ESM)
- **Conditionals breathe:** blank line before and after `if`/`switch`, except at block edges (@stylistic, autofixable)
- **Unused args:** Prefix with `_` (eslint rule)
- **Formatting:** Double quotes, semicolons, trailing commas, 100-char line width
- **Test location:** `tests/` mirrors `src/` structure, uses `.test.ts` suffix
- **Excluded from compilation:** Files named `_template.md` or `README.md`
- **File/path operations:** import from `@/core/files.js` (I/O: readText, writeText, exists, ...) and `@/core/paths.js` (composition: joinPath, baseName, ...; well-known locations: configFile, SCAFFOLD_DIR, ...). `node:fs` and `node:path` are restricted to those two modules (ESLint-enforced).
- **Logging:** Logger class writes to stderr (keeps stdout clean for piping)
