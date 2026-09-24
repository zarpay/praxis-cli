When to use: humans at a terminal only — it opens $VISUAL, $EDITOR, or
vi interactively.

Behavior:
  Agents and scripts never run this: edit .praxis/config.json directly
  instead — the file is plain JSON, and every command re-reads it on
  dispatch. The field reference lives in the docs below.

Example:
  $ praxis config edit

Docs: https://zarpay.github.io/praxis-cli/reference/config
