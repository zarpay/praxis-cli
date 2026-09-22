# Help documents

**Help is the API documentation, and agents are first-class readers**
(`specs/09-cli-surface.md`, decided 2026-09-22: no extended-help tier —
`--help` carries it all). `src/help/` holds the long-form text, one
markdown file per help moment: `{group}-{sub}-help.md` for a leaf
(`eval-run-help.md`), `{group}-help.md` for a group, `praxis-help.md`
for the root. Commands import them as strings and pass
`` `\n${doc}` `` to `.addHelpText("after", ...)` — the leading newline
is the blank separator after the options block. Content here, wiring in
`commands/`.

- **Every leaf follows the standard sections**: `When to use:` (the
  decision rule), `Behavior:` (what an agent must know — writes vs
  reads, cache and ledger effects, gotchas), worked `Examples:` with
  expected output shape, `JSON (--json)` naming the contract's fields
  where the flag exists, `Next:` (related commands with the reason to
  run them), and a closing `Docs:` link into
  https://zarpay.github.io/praxis-cli/. Group help carries the
  cross-command workflow (the eval loop, the axiom lifecycle); the root
  says what Praxis *is* before anything else. The mirrored tests in
  `tests/commands/` enforce the Docs link and When-to-use on every
  command — a new command without them fails the build.
- **Terminal idiom, rendered verbatim.** Plain text; indentation and
  column alignment ARE the layout; no markdown fences. That is why
  `cli/.prettierignore` excludes `src/help/*-help.md` — prettier
  reflowed all of them once (2026-09-22), stripping the indentation
  and collapsing the aligned columns. Never remove that exclusion;
  `src/help/README.md` is prose and stays formatted.
- **Help is shipped surface, not documentation** (the 2.3 changelog's
  own words about the skill). A surface change lands with its help in
  the same commit: a new flag or state updates the option line AND the
  help document; a `--json` payload change (`src/types/reports.ts`, a
  view's JSON branch) updates the contract block that names its fields.
  The 2.2/2.3 drift — help listing four critique states when the CLI
  had five, no document for `praxis feedback` — is the failure mode
  this rule exists to prevent.
- **Vocabulary matches `specs/vocabulary.md`**, and Praxis is
  domain-neutral: it governs code and text documents alike, so no
  code-centric coinages ("code-owner", 2026-09-22) — an expert is an
  agent identity, specs govern files. v1 terms (role, responsibility)
  appear only when deliberately naming history.
- **Only `commands/` and `src/index.ts` import `@/help/*`** — a
  documented contract, like the spec↔eval isolation, since a lint
  block for it would clobber the per-layer `no-restricted-imports`
  configs (rule configs replace, not merge).
- The machinery: tsup `loader: { ".md": "text" }`, the markdown-as-text
  plugin in vitest.config.ts, and `src/help/markdown.d.ts` — all three
  serve the same contract; changing one changes them together.
