When to use: a category stopped mattering, moved into static tooling,
or was merged away.

Behavior:
  Deprecation never deletes: the id and every record under it stay
  readable forever; the axiom simply stops labeling and accruing.
  The reason is recorded with the decision. Reports keep the category's
  history but stop charting it forward.

Example:
  $ praxis axioms deprecate AX-3f9a1c --reason "now a lint rule"

Next:
  praxis axioms merge   when the category should collapse into another
                        rather than retire

Docs: https://zarpay.github.io/praxis-cli/commands/axioms
