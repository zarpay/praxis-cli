When to use: a matcher label looks wrong, or evidence belongs under a
different category.

Behavior:
  The per-critique human override. Appends a new assignment to an
  active axiom; at read time the newest assignment wins — nothing is
  rewritten, prior labels stay in the ledger. A dismissed critique is
  refused: reinstate it with `praxis eval review --reinstate` first.
  Critique ids come from `praxis eval critiques`.

Example:
  $ praxis axioms reassign 20260907T101932101Z-c0f5baa5:6 --to AX-b951db

Next:
  praxis eval critiques --axiom <id>   verify where the critique landed

Docs: https://zarpay.github.io/praxis-cli/commands/axioms
