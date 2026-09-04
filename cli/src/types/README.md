# types/ — the shared vocabulary

One domain per file, re-exported through `src/types.ts` (the barrel —
every import stays `@/types.js`). A type lives here exactly because
more than one module speaks it or it is a documented external contract;
a type only one module speaks is declared in that module, unexported.
Names read as families; spec vocabulary (`Verdict`, `Critique`,
`Finding`, `Epoch`…) matches `praxis_v2_specs/vocabulary.md` and is
never renamed for symmetry.

Rule: `.claude/rules/types.md`.
