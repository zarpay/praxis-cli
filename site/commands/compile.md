# praxis compile

Compiles roles into self-contained agent profiles by resolving and inlining all referenced content.

## Usage

```bash
praxis compile [--alias <name>] [--watch]
```

## What it does

For each role in `rolesDir`:

1. Parses the frontmatter manifest
2. Expands glob patterns in `constitution`, `context`, `responsibilities`, and `refs`
3. Reads and strips frontmatter from every referenced file
4. Assembles a single markdown profile in section order
5. Writes the profile to `{agentProfilesOutputDir}/{alias}.md`
6. Passes the profile to each enabled plugin

See [The Compiler Pipeline](/concepts/compiler-pipeline) for a full walkthrough.

## Options

### `--alias <name>`

Compiles only the role with the matching `alias` field. Useful during authoring to avoid recompiling everything on every save.

```bash
praxis compile --alias reviewer
```

### `--watch`

Starts a file watcher on every directory in `sources`. Any `.md` change triggers a debounced recompile of all roles.

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

## Errors

The compiler exits with a non-zero code and a helpful message if:
- A referenced file or glob matches nothing
- A role is missing required frontmatter fields
- A file cannot be read

## Example output

```bash
praxis compile
```

```
Compiling reviewer...
  ✓ agent-profiles/reviewer.md
  ✓ plugins/praxis/agents/reviewer.md

Compiling support-agent...
  ✓ agent-profiles/support-agent.md
  ✓ plugins/praxis/agents/support-agent.md

Done. 2 roles compiled.
```

## See also

- [The Compiler Pipeline](/concepts/compiler-pipeline)
- [Agent Profiles](/concepts/agent-profiles)
- [Configuration](/reference/config)
- [Claude Code Plugin](/plugins/claude-code)
