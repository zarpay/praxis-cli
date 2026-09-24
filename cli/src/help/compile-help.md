When to use: after editing experts or practices — the spec-layer
authoring documents under expertsDir and practicesDir — to regenerate
what is compiled from them. Projects that only run evals never need
this command.

Behavior:
  An expert is an agent identity with a defined scope, stating what
  it is responsible for and referencing the practices and context it
  works by. Each expert in expertsDir compiles into a self-contained
  SME profile (sections: Expert, Practices, Constitution,
  Context, Reference), written to agentProfilesOutputDir. The profile
  opens with eval-targeting frontmatter (paths, excludes, context)
  compiled from the expert's validates: — so the profile is also a
  spec the eval layer reviews against. Enabled plugins then emit their
  own output from the same profile (the claude-code plugin writes
  agents/ files and maintains .claude-plugin/plugin.json).
  Offline: no API calls, deterministic, safe to re-run.
  --alias compiles one expert; --watch recompiles on source changes.

Examples:
  $ praxis compile
      Compiled 3 agent(s)
  $ praxis compile --alias service-steward

Next:
  praxis status    verifies the taxonomy the compiler just consumed
  praxis eval run  reviews code against the compiled specs

Docs: https://zarpay.github.io/praxis-cli/commands/compile
      https://zarpay.github.io/praxis-cli/concepts/compiler-pipeline
