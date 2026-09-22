When to use: to survey the categories on record — active and
deprecated, chronological.

Behavior:
  Pure read of .praxis/axioms/. Statements are elided in the table;
  the full statement and the labeled evidence are `axioms show`'s job.

JSON (--json), stable contract:
  [ { id, version, status, mode, severity, derived_from, introduced,
      statement } ]

Example:
  $ praxis axioms list
      AX-b951db  active  Error messages written for the implementer…

Next:
  praxis axioms show <id>   one category in full, with its critiques

Docs: https://zarpay.github.io/praxis-cli/commands/axioms
