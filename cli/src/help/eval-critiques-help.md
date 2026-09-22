When to use: to browse critique ids before `praxis axioms reassign` or
`praxis eval review`, or to drill into any queue count.

Behavior:
  Pure read over the ledger — never a reviewer call. Every critique
  carries its lifecycle state: untriaged (triage's queue), unmatched
  (curate's queue), labeled (attached to an axiom), dismissed (judged
  invalid in `eval review`). The ids printed here are exactly what
  reassign and review take.

JSON (--json), stable contract:
  { totals { untriaged, unmatched, labeled, dismissed },
    critiques: [ { id, runId, timestamp, filePath, reviewerName,
                   severity, text, state, axiomId } ] }

Examples:
  $ praxis eval critiques src/services --state unmatched
  $ praxis eval critiques --axiom AX-b951db

Next:
  praxis axioms reassign <id> --to <axiom>  fix a wrong label
  praxis eval review                        judge validity, dismiss

Docs: https://zarpay.github.io/praxis-cli/commands/eval
