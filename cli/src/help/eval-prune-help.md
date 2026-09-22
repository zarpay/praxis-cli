When to use: after a reviewer's config or prompt surface changed (a new
epoch) — the old identity's cache entries can never hit again.

Behavior:
  Removes exactly the cached verdicts whose reviewer hash matches no
  configured reviewer; entries a configured reviewer can still hit are
  never touched. This is the epoch structure's other half: a behavioral
  change writes new cache keys, and prune clears the orphans the old
  keys left behind. The ledger is never pruned — evidence is forever.

Example:
  $ praxis eval prune
      Pruned 18 orphaned verdict(s)   (or "Nothing to prune")

Docs: https://zarpay.github.io/praxis-cli/validation/caching
