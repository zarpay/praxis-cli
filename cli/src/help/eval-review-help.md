When to use: the reviewer said something untrue or ungrounded, or the
humans disagree with the spec it cites.

Behavior:
  This is the one place a critique is judged invalid. Only untriaged
  and unmatched critiques come up — a critique labeled under an axiom
  is valid by definition and is refused. A dismissed critique leaves
  every queue and is never labeled or curated until reinstated; the
  decision is appended to the ledger with its reason, never rewritten.
  The dismissal rate is the reviewer-trust signal: many dismissals mean
  the specs disagree with the humans, or the reviewers are drifting.
  Interactive by default; the scripted flags never prompt and are the
  agent-reachable path — both take one or more critique ids with a
  single --reason recorded against each.

Examples:
  $ praxis eval review src/services
  $ praxis eval review --dismiss 20260907T101932101Z-c0f5baa5:6 \
      --reason "the spec permits this"
  $ praxis eval review --reinstate 20260907T101932101Z-c0f5baa5:6 \
      --reason "misread the spec"

Next:
  praxis eval critiques   the ids this command takes
  praxis eval report      the residual rate dismissals feed

Docs: https://zarpay.github.io/praxis-cli/commands/eval
      https://zarpay.github.io/praxis-cli/concepts/evidence-loop
