# providers/ — ReviewProvider implementations

Execution backends named for what they integrate with (`openrouter.ts`).
A provider implements `review()` (and optionally `complete()` for the
curator) against the documented contract in the types barrel; praxis
owns the prompts and key resolution, the provider only executes.
Custom providers load from `./relative` project paths — see
`resolve-provider-service`.

Rule: `.claude/rules/extension-points.md`.
