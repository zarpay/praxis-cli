When to use: to run a debt program — baseline → current stock per
axiom, paydown credited by git author, concentration by directory.

Behavior:
  Pure read over the ledger and read-only git; never calls a reviewer.
  Stock is measured at corpus runs: the epoch-opening baseline versus
  the latest corpus run of the epoch. Paydown is corpus-level (in
  baseline, gone at latest); credit goes to the authors whose commits
  touched the resolved files. Staleness is stated: the report names
  when each reviewer's stock was last evidenced.

JSON (--json), stable contract:
  {    evidence: [ { reviewerName, baselineAt, currentAt } ],
    rows: [ { axiomId, statement, reviewerName, baselineStock,
              currentStock, paydown, appearedSinceBaseline } ],
    concentration: [ { directory, violations } ],
    credits: [ { author, resolved } ], creditNote, rebaseline }

Example:
  $ praxis debt report
      AX-b951db [v32] baseline 3 → current 1 · paid down 2 · appeared 0

Next:
  praxis eval run           a fresh corpus run to re-evidence the stock
  praxis axioms show <id>   the standard behind a debt row

Docs: https://zarpay.github.io/praxis-cli/commands/debt
