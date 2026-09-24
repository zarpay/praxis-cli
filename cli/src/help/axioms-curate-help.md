When to use: after triage has labeled everything it can — curate
refuses to start while any critique is untriaged, because the one still
in triage's queue may be the one that completes a pattern.

Behavior:
  The deliberately interactive session for the unmatched residue: the
  curator clusters recurring critiques and suggests; the human folds,
  accepts, or holds. Acceptance activates the axiom directly — the one
  machine check is spec traceability, and an untraceable draft is held
  until the spec is extended. Every critique here is taken as valid
  evidence (validity is decided in `praxis eval review`, never here);
  a cluster with no axiom yet is held, writing nothing. Assignments
  and activations append to the ledger; held critiques stay in the
  queue for the next session. New axiom ids are random (AX- + 6 hex),
  never sequential. --yes accepts every suggestion without prompting —
  it scripts, and the reports reflect that it was scripted. Requires
  the `curator` role in .praxis/config.json. Best practice is to newly
  run curate as an interactive session with a human.

Examples:
  $ praxis axioms curate
  $ praxis axioms curate --yes

Next:
  praxis axioms list      the taxonomy the session grew
  praxis eval report      rates over the newly labeled evidence

Docs: https://zarpay.github.io/praxis-cli/commands/axioms
      https://zarpay.github.io/praxis-cli/concepts/evidence-loop
