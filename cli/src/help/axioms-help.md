An axiom is a named, stable category of recurring critique — id
AX-xxxxxx, born from ledger evidence, defined by a statement traceable
to a spec passage. Axioms never enter a reviewer's prompt: the reviewer
sees only the spec, and labels are attached afterwards, so the
categories organize evidence without steering it.

The lifecycle:
  critiques are born raw (untriaged)
  → `axioms triage` labels each against ALL active axioms (batch,
    one curator call per critique); no-match moves it to unmatched
  → `axioms curate` works the unmatched residue interactively:
    cluster, activate new axioms, assign, or hold
  → `reassign`, `deprecate`, `merge` are the correction verbs —
    everything appends, nothing is rewritten.

Behavior:
  triage and curate require the `curator` role in .praxis/config.json
  (they call a model); list and show are pure reads. Critique validity
  is a different question, decided only in `praxis eval review`.

Docs: https://zarpay.github.io/praxis-cli/commands/axioms
      https://zarpay.github.io/praxis-cli/concepts/evidence-loop
