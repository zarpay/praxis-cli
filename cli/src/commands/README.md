# commands/ — routes

One file per command group, each a default-exported `CommandRegistrar`
that declares arguments, options, and help text, then hands
`.action()` a pre-wrapped orchestrator. No logic, no rendering, no
result handling — `prepareOrchestrator` derives the options object and
owns the error policy. `index.ts` is the only caller.

Rule: `.claude/rules/commands.md`. Exemplar: `eval-command.ts`.
