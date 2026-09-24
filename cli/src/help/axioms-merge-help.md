When to use: several axioms name the same recurring issue — a category
split into near-twins divides its evidence into separate rates.

Behavior:
  Re-labels every critique of the merged-away axioms to the survivor
  (append-only; prior labels stay in the ledger), deprecates them with
  the merge named, and moves the survivor's population clock to the
  earliest among the merged, so its denominator is honest. Only the
  survivor must be active — a source may already be deprecated.
  Reports recompute instantly; nothing is rewritten.

Example:
  $ praxis axioms merge AX-aaaaaa AX-bbbbbb --into AX-cccccc

Next:
  praxis eval report --axiom <survivor>   the unified rate

Docs: https://zarpay.github.io/praxis-cli/commands/axioms
