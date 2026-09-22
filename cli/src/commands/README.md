# commands/ — routes

One file per command group, each a default-exported `CommandRegistrar`
that declares arguments, options, and help text, then hands
`.action()` a pre-wrapped orchestrator. No logic, no rendering, no
result handling — `prepareOrchestrator` derives the options object and
owns the error policy. `index.ts` is the only caller.

Long-form help is content, not wiring: it lives in `src/help/*.md`
(one document per help moment, agent-grade per `specs/09-cli-surface.md`)
and is imported as a string into `.addHelpText("after", ...)`.

Rule: `.claude/rules/commands.md`. Exemplar: `eval-command.ts`.
