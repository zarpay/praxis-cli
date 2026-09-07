# praxis axioms

Axioms are the named, stable standards critiques attach to: a spec is prose for humans and the reviewer; axioms are the enumerable units metrics aggregate over. They are born from real critiques through triage, validated against the spec at ratification, and carry durable identity — an id (`AX-` + 6 random hex, collision-safe across contributors and branches) that is never reused or renumbered. They live as markdown in `.praxis/axioms/`, committed like everything Praxis owns.

## The lifecycle

**LLM proposes, human ratifies.** Reviewers produce raw critiques — the reviewer sees only the spec, never the axioms. `triage` labels recurring critiques under active axioms, so reports cite the same id and the same ratified words every time; `curate` is the interactive session that clusters the unlabeled residue into axiom candidates; `ratify` traces a proposal to the spec and activates it. Removal is deprecation — history stays frozen.

Concretely, on Scoop Society: a week of runs produces the same complaint about five services' error messages. Curate clusters them; you accept the drafted proposal; ratify traces it to `src/services/README.md#behavior` and activates `AX-b951db` — *"Error messages name what was wrong and what would be accepted instead."* From then on triage labels every recurrence under the id, `axioms show AX-b951db` teaches it with both examples, and `eval report --axiom AX-b951db` charts it. The full walkthrough is [The Evidence Loop](/concepts/evidence-loop).

## The curator

Triage labeling, the curate session, the authoring gate, and ratification assistance run on the **curator** — a dedicated model configured beside your reviewers, worth pointing at a frontier model since it does the taxonomy's thinking:

```json
"curator": {
  "model": "<model slug>",
  "apiKeyEnvVar": "OPENROUTER_API_KEY"
}
```

The curator organizes; you decide. Nothing it suggests takes effect without a human accepting it.

## praxis axioms triage

The labeling pass — async, batch, non-interactive. The curator classifies each pending critique against the active axioms derived from its governing spec (temperature 0, one call per spec): a critique that is squarely an instance of exactly one axiom gets a machine label — an append-only assignment record marked `matcher`, human-overridable at `curate` — and everything else stays pending. An axiom id the curator invents never becomes an assignment; a spec with no active axioms is skipped.

`--dry-run` proposes without writing. Without a curator configured, triage warns and defers — critiques simply stay pending; nothing is ever labeled silently.

## praxis axioms curate

The deliberately interactive session, for the residue triage can't label. The curator groups the still-pending critiques per spec, suggests folding each cluster into an established axiom, drafts a new proposal, or flags it unassignable — and you decide, cluster by cluster: `[a]ccept / [d]ismiss / [s]kip`.

Accepted drafts pass the **authoring gate** first: anything a regex or linter could decide is refused — _if you can write the check, write the check; if you can only describe the standard, write the axiom._ Accepted proposals land in `.praxis/axioms/proposed/` with no effect on metrics until ratified.

Every decision is appended to `.praxis/ledger/triage/` with full provenance — who decided, which model suggested. Scriptable with `--yes` (accept everything; recorded as such) or `--reject "<reason>"` (dismiss the queue). Unassignable and dismissed critiques feed the **residual rate** — the signal that a reviewer is drifting off-spec.

## praxis axioms ratify \<id\>

Shows the proposal, its supporting critiques, the gate's verdict, and the curator's spec-traceability assessment, then asks for the call. Three outcomes:

- **Traceable** — ratify: the axiom records its derivation (`derived_from` — provenance, not a live reference; a spec edit can move the section without invalidating the axiom) and becomes active. Ratification has no cache effect — the reviewer sees only the spec — and the next `praxis axioms triage` labels the backlog against the new rule.
- **Real but untraceable** — the spec is incomplete: extend it, then rerun.
- **Not intended** — the reviewer invented it: `--reject "<reason>"` removes the proposal and records the rejection.

Use `--spec <path>` for human-authored proposals with no critique parentage.

## praxis axioms list · show \<id\> · audit

`list` is the store at a glance (proposals counted, ratify command named); `show <id>` is the drill-down every finding cites — statement, both examples, derivation, lifecycle; `audit` re-runs the authoring gate over active axioms and flags removal candidates (tooling grows — an axiom appropriate last year may be a lint rule now). All take `--json`.

## See also

- [The Evidence Loop](/concepts/evidence-loop)
- [praxis eval](/commands/eval) — where critiques come from, and `eval report --axiom <id>`
- [praxis debt](/commands/debt) — pre-spec stock per axiom
