# services/ — service objects

One action, one file, one default export:
`const fooService: Service<FooInput, Out> = (cfg, input) => …` — the
config first (spelled `cfg`, the way the context is `ctx`), the work's
own input second. Project facts ride in the config and never reappear
as input fields. Every service must earn its place: a service whose
sole caller is another service is a private helper in disguise unless
it holds an independent contract.

Rule: `.claude/rules/services.md`. Exemplars: `review-target-service.ts`
(a boundary), `derive-flow-metrics-service.ts` (a derivation).
