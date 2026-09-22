When to use: whenever untriaged critiques have piled up (`praxis
status --json` reports the count as evalState.pending_triage).

Behavior:
  An async batch pass, run on demand: one curator call per critique, so
  ordering can never bias a verdict. The curator classifies each
  critique against ALL active axioms — an axiom is a category over all
  specs' evidence, so any spec's critique can land in any axiom.
  Squarely-an-instance appends an assignment record (provenance:
  matcher, human-overridable later); a no-match writes an unmatched
  record pinning the axiom set considered, and a changed set re-queues
  the critique automatically. Requires the `curator` role in
  .praxis/config.json; without one it warns and does nothing.
  --dry-run prints the proposed labels without writing.

Examples:
  $ praxis axioms triage --dry-run
  $ praxis axioms triage

Next:
  praxis axioms curate    work the unmatched residue this pass leaves
  praxis eval report      rates update as labels land

Docs: https://zarpay.github.io/praxis-cli/commands/axioms
