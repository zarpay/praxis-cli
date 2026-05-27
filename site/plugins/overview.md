# Plugins Overview

Plugins receive compiled agent profiles and transform or extend them for specific platforms. The compiler calls each enabled plugin after writing the pure profile.

## How plugins work

After compiling a role, Praxis:

1. Writes the pure profile to `{agentProfilesOutputDir}/{alias}.md`
2. Passes the profile content and role metadata to each enabled plugin
3. Each plugin writes its own output to its configured output directory

Plugins are stateless — they receive a profile string and metadata, and they write files. They do not modify the compilation process or the pure profile output.

## Enabling a plugin

Add the plugin name to the `plugins` array in `.praxis/config.json`:

```json
{
  "plugins": ["claude-code"]
}
```

Or use the object form with per-plugin options:

```json
{
  "plugins": [{
    "name": "claude-code",
    "outputDir": "./plugins/my-agents",
    "claudeCodePluginName": "my-org"
  }]
}
```

## Available plugins

| Plugin | Description |
| --- | --- |
| `claude-code` | Generates Claude Code agent files with YAML frontmatter, manages `plugin.json`, and creates a `/validate` slash command |

## Plugin output directories

By default, the Claude Code plugin writes to `./plugins/praxis/`. Each plugin can be configured with a custom `outputDir`.

Plugin output directories are separate from `agentProfilesOutputDir`. You can have both:

```
agent-profiles/
└── reviewer.md          ← pure profile

plugins/praxis/
└── agents/
    └── reviewer.md      ← Claude Code agent file
```

Or disable pure profiles and only generate plugin output:

```json
{ "agentProfilesOutputDir": false }
```

## See also

- [Claude Code Plugin](/plugins/claude-code)
- [Configuration](/reference/config)
