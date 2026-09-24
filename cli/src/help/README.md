# help/ — the long-form help documents

One markdown file per help moment: `{command}-help.md` for a leaf
(`eval-run-help.md`), `{group}-help.md` for a group's own `--help`,
`praxis-help.md` for the root. Commands import them as strings (tsup
`loader: { ".md": "text" }`; vitest mirrors it) and hand them to
`.addHelpText("after", ...)` — content here, wiring there.

Help is the API documentation, and agents are first-class readers
(`specs/09-cli-surface.md`): every leaf states **When to use**,
**Behavior** an agent must know (writes vs reads, cache, ledger),
worked **Examples**, the **JSON (--json)** contract's shape where the
flag exists, **Next** commands, and ends with a **Docs:** link to
https://zarpay.github.io/praxis-cli/. Terminal idiom throughout: plain
text and indented blocks, no markdown fences — it renders verbatim.
