# src/ — the CLI, organized by layer

Every directory answers "what kind of thing goes in here?", the filename
suffix repeats the answer, and ESLint enforces which layer may import
which:

```
@framework (package) → helpers, templates → models → stores → services → orchestrators → commands
(views, prompts, providers, plugins: side branches that never reach forward)
```

| Directory | One line | Rule |
| --- | --- | --- |
| `commands/` | Routes: options in, one orchestrator, nothing else | `.claude/rules/commands.md` |
| `orchestrators/` | Controllers: one command's whole workflow each | `.claude/rules/orchestrators.md` |
| `services/` | One action each: `Service<In, Out> = (cfg, input) => out` | `.claude/rules/services.md` |
| `models/` | Data + its helpers, valid by construction, no IO | `.claude/rules/models.md` |
| `stores/` | One file-backed subsystem's IO handle each | `.claude/rules/stores.md` |
| `views/` | One render moment each: pure `View<Data>` | `.claude/rules/views.md` |
| `helpers/` | Plain modules below every layer | `.claude/rules/helpers.md` |
| `prompts/` | Text sent to a model — the reviewer identity surface | `.claude/rules/prompts.md` |
| `templates/` | The body of every file praxis writes | `.claude/rules/templates.md` |
| `providers/`, `plugins/` | Extension-point implementations | `.claude/rules/extension-points.md` |

`types.ts` is the barrel over `src/types/` — the shared type vocabulary.
The full architecture narrative lives in `cli/CLAUDE.md`; when something
is hard to file, it is two things wearing one name — split it.
