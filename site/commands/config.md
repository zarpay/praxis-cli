# praxis config

Inspect or edit the project configuration without leaving the terminal.

## Usage

```bash
praxis config show
praxis config edit
```

---

### `praxis config show`

Prints `.praxis/config.json` with a formatted header showing the file path, followed by the full JSON contents.

```bash
praxis config show
```

Example output:

```
  Praxis Config
  ──────────────────────────────────────────
  /path/to/my-org/.praxis/config.json

{
  "sources": ["roles", "responsibilities", "reference", "context"],
  "rolesDir": "roles",
  "responsibilitiesDir": "responsibilities",
  "agentProfilesOutputDir": "./agent-profiles",
  "plugins": [],
  "validation": {
    "apiKeyEnvVar": "OPENROUTER_API_KEY",
    "model": "x-ai/grok-4.1-fast"
  }
}
```

Does not require an API key. Exits with code 1 if no `.praxis/` directory is found.

---

### `praxis config edit`

Opens `.praxis/config.json` in your preferred editor. Resolves the editor in this order:

1. `$VISUAL`
2. `$EDITOR`
3. `vi` (fallback)

```bash
praxis config edit

# Or with an explicit editor:
EDITOR=nano praxis config edit
VISUAL=code praxis config edit
```

The terminal is handed directly to the editor (`stdio: inherit`), so interactive editors like `vim`, `nano`, and `code --wait` all work correctly. Exits with code 1 if the editor cannot be launched.

## See also

- [Configuration](/reference/config)
- [praxis init](/commands/init)
