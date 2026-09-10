# stores/ — file-backed subsystem handles

One store per file kind: its layout, id minting, reads, writes, and
stated policy (the verdict cache fails soft; the run store's reads
never raise and its writes always do). Constructed from the cfg,
speaking the shared verb vocabulary (`files()`, `all()`,
`write<Noun>`, `by<Field>`, `has<Fact>`, `prune` …). The document
format stays a model; the store parses into it and serializes from it.

Rule: `.claude/rules/stores.md` (including the verb table). Exemplar:
`verdict-store.ts`.
