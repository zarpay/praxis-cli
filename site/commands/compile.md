# praxis compile

Compiles experts into self-contained agent profiles by resolving and inlining all referenced content.

## Usage

```bash
praxis compile [--alias <name>] [--watch]
```

## What it does

For each expert in `expertsDir`:

1. Parses the frontmatter manifest
2. Expands glob patterns in `constitution`, `context`, `practices`, and `refs`
3. Reads and strips frontmatter from every referenced file
4. Assembles a single markdown profile in section order
5. Writes the profile to `{agentProfilesOutputDir}/{alias}.md`
6. Passes the profile to each enabled plugin

See [The Compiler Pipeline](/concepts/compiler-pipeline) for a full walkthrough.

## Options

### `--alias <name>`

Compiles only the expert with the matching `alias` field. Useful during authoring to avoid recompiling everything on every save.

```bash
praxis compile --alias reviewer
```

### `--watch`

Starts a file watcher on every directory in `sources`. Any `.md` change triggers a debounced recompile of all experts.

```bash
praxis compile --watch
```

The watcher debounces rapid saves (e.g., during an autosave burst) to avoid redundant recompiles.

## Output

### Pure profiles

Written to `{agentProfilesOutputDir}/{alias}.md`. Default: `agent-profiles/`.

Set `agentProfilesOutputDir: false` in config to disable pure profile output.

### Plugin output

Each enabled plugin receives the compiled profile content and writes its own output. The Claude Code plugin writes to `{outputDir}/agents/{alias}.md`.

## Warnings and failures

One malformed expert never abandons the batch: it is reported and skipped, and every other expert still compiles. Reference problems come back as warnings — a glob matching nothing, a declared file that doesn't exist — because a typo'd reference shouldn't cost you the rest of the profile, but you still have to hear about it.

## Example output

```bash
praxis compile
```

```
[OK] Compiled scooper.md
[OK] Compiled sundae.md
[OK] Compiled taster.md
[INFO] Compiled 3 agent(s) (up-to-date)
```

```bash
praxis compile --alias scooper
```

```
[OK] Compiled scooper.md
```

## See also

- [The Compiler Pipeline](/concepts/compiler-pipeline)
- [Agent Profiles](/concepts/agent-profiles)
- [Configuration](/reference/config)
- [Claude Code Plugin](/plugins/claude-code)
