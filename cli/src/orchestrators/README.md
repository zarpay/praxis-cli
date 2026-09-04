# orchestrators/ — controllers

One command's whole workflow each: coordinate services, interact with
models and stores, render views (const-before-render, always), and
return `"ok" | "failed"`. Exported as
`const nameOrchestrator: Orchestrator<Options>` plus the
`prepareOrchestrator(...)` default. Never import each other; anything
computed for rendering belongs in a service.

Rule: `.claude/rules/orchestrators.md`. Reference style: `ci-run-orchestrator.ts`.
