When to use: capturing a reusable review or authoring procedure that
experts reference from their practices: list.

Behavior:
  Scaffolds into the configured practicesDir from the compiler's
  template. A practice no expert references is flagged by
  `praxis status` as orphaned — write the practice, then add it to an
  expert's practices: list.

Example:
  $ praxis add practice review-service-quality

Next:
  praxis compile   recompile the experts that reference it

Docs: https://zarpay.github.io/praxis-cli/commands/add
