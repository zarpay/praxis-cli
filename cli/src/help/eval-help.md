The eval loop: LLM reviewers read targets against their specs, verdicts
are cached by content hash, and every run leaves evidence in the ledger.

Family rule: `eval run` writes — it invokes reviewers. `eval review`
appends human validity decisions. Every other subcommand reads existing
results and never costs an API call.

Behavior:
  Requires at least one reviewer in .praxis/config.json, with its API
  key exported under the reviewer's apiKeyEnvVar (default reviewers use
  OPENROUTER_API_KEY). Specs are discovered in the directories `sources`
  lists, by filename (specFilePattern, default README.md). Every
  configured reviewer evaluates every target; results always report per
  reviewer, never pooled. stdout is data, stderr is progress — capture
  stdout and it parses.

A spec, minimally — a README.md next to the code it governs:
  ---
  paths: ["src/services/*.ts"]
  ---
  Error messages are written for the API consumer: they name what
  was wrong and what would be accepted instead. "rating must be a
  whole number from 1 to 5" is acceptable; "invalid input" is not.

  Without paths:, a spec governs its own directory's sibling files;
  excludes: shields files entirely, context: inlines assist material.
  Reviewers refuse mechanical criteria (naming, structure — anything a
  linter or type check could decide): if you can write the check, write
  the check. A spec holds the standards you can only describe.

The loop, in order:
  praxis eval run <target>     review what you changed (the fast loop)
  praxis eval critiques        browse what reviewers said, with ids
  praxis axioms triage/curate  label recurring critiques into axioms
  praxis eval report           read the evidence: rates, epochs, costs

Docs: https://zarpay.github.io/praxis-cli/commands/eval
      https://zarpay.github.io/praxis-cli/validation/writing-specs
