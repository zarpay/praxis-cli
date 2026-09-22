When to use: a finding cited an [AX-...] id and you want the category's
full statement, the spec passage its norm lives in, and its labeled
critiques — the category's real examples, live from the ledger.

Behavior:
  Pure read. derived_from records the spec provenance the category was
  ratified against; the representative critiques are actual reviewer
  findings labeled under it, newest first.

JSON (--json), stable contract:
  { id, version, status, mode, severity, derived_from, introduced,
    statement, body, labeled_count, representative_critiques }

Example:
  $ praxis axioms show AX-b951db

Next:
  praxis eval report --axiom <id>     the category's rate over time
  praxis eval critiques --axiom <id>  every critique labeled under it

Docs: https://zarpay.github.io/praxis-cli/commands/axioms
