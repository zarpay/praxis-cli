# praxis axioms

Axioms are the named, stable standards critiques attach to: a spec is prose for humans and the reviewer; axioms are the enumerable units metrics aggregate over. They are born from real critiques, accepted by a human at curate (where each is validated against the spec's own text), and carry durable identity — an id (`AX-` + 6 random hex, collision-safe across contributors and branches) that is never reused or renumbered. They live as markdown in `.praxis/axioms/`, committed like everything Praxis owns.

## The lifecycle

**LLM proposes, a human accepts — and acceptance activates.** Reviewers produce raw critiques — the reviewer sees only the spec, never the axioms. `triage` labels recurring critiques under active axioms, so reports cite the same id and the same words every time; `curate` is the interactive session that clusters the unlabeled residue into drafts, and accepting a draft activates it after one machine check: the principle must trace to a spec passage. Removal is deprecation — history stays frozen.

Concretely, on Scoop Society: a week of runs produces the same complaint about five services' error messages. Triage — with no active axiom that matches — sends them to the curation queue; curate clusters them; you accept the drafted axiom, the traceability check pins it to `src/services/README.md#behavior`, and `AX-b951db` is live — *"Error messages name what was wrong and what would be accepted instead."* From then on triage labels every recurrence under the id, `axioms show AX-b951db` teaches it with both examples, and `eval report --axiom AX-b951db` charts it. The full walkthrough is [The Evidence Loop](/concepts/evidence-loop).

## The curator

Triage labeling and the curate session (traceability check included) run on the **curator** — a dedicated model configured beside your reviewers, worth pointing at a frontier model since it does the taxonomy's thinking:

```json
"curator": {
  "model": "<model slug>",
  "apiKeyEnvVar": "OPENROUTER_API_KEY"
}
```

The curator organizes; you decide. Nothing it suggests takes effect without a human accepting it.

## praxis axioms triage

The labeling pass — async, non-interactive, working the **untriaged** critiques only. The curator considers each one against **every active axiom** — an axiom is an abstraction of principle, not a child of one spec, so a critique from any spec can land in any axiom — **one critique per call** (temperature 0, a few in flight at a time, each verdict streamed as it lands), so no critique's verdict is biased by its neighbors or its position in a list. A critique squarely an instance of exactly one axiom gets a machine label — an assignment record whose provenance (`matcher`) reports carry; the assignment is settled, and when two axioms later collapse into one, `praxis axioms merge` re-labels the evidence. A no-match writes an **unmatched** record pinning the axiom set considered: the critique moves to curate's queue, and when the active set later changes it re-queues for triage automatically. An axiom id the curator invents is a failed call — the critique stays untriaged for retry. A project with no active axioms needs no calls at all: every critique is trivially unmatched against the empty set and goes straight to curate.

`--dry-run` proposes without writing. Without a curator configured, triage warns and defers — critiques simply stay pending; nothing is ever labeled silently.

## praxis axioms curate

The deliberately interactive session, working **only** the unmatched residue — critiques triage considered against the current axioms and couldn't label. It refuses to start while any critique is still untriaged (exit 2, naming `praxis axioms triage`): the one still in triage's queue may be the one that completes a pattern, so curating past it is curating on partial evidence. A clean triage is the precondition. The curator groups the still-pending critiques per spec — identical texts deduped into one member with its duplicates counted, at most a cohort of ~30 distinct critiques per call, with the session's accepted proposals carried into later cohorts as fold targets — and suggests folding each cluster into an established or standing proposed axiom, drafting a new proposal, or **holding** it — no axiom emerges yet. You decide, cluster by cluster: `[a]ccept / [s]kip`; a decision on a deduped member applies to every duplicate behind it.

Curate never dismisses. Every critique here is taken as valid evidence — validity is [`praxis eval review`](/commands/eval#praxis-eval-review)'s question — so a held cluster writes nothing: its critiques stay unmatched and ride into the next session's cohort, where new critiques may complete the pattern. Critiques the curator leaves out of every cluster are named and held the same way; nothing falls through silently.

The guidance on what makes a good axiom is given where the draft is written: the curator's prompt carries the judgment boundary — _if you can write the check, write the check; if you can only describe the standard, write the axiom_ — so a mechanical cluster is suggested as held and a mixed one is drafted as its judgment half alone. **Your acceptance is the decision, and acceptance activates.** One machine check runs first: the principle must trace to a spec passage (recorded as `derived_from`). Traceable → the axiom lands active and the next triage labels against it — no cache effect, since the reviewer sees only the spec. Untraceable → the cluster is **held** with the honest instruction: extend the spec, then re-curate. A principle no spec states never starts counting.

Every assignment and activation is appended to `.praxis/ledger/triage/` with full provenance — who decided, which model suggested. Scriptable with `--yes` (accept everything; recorded as such).

## praxis axioms reassign \<id\>

`reassign <critique-id> --to <axiom>` is the per-critique human override: a matcher label that looks wrong, or evidence that belongs under a different standard. A dismissed critique is refused — reinstate it with `praxis eval review --reinstate` first; invalid evidence is never categorized. The reverse also holds: a labeled critique that turns out to be untrue is dismissed with `praxis eval review --dismiss` — the label stays in the ledger beneath the dismissal, and reports recompute. The new assignment is appended and wins at read time — the prior record stays in the ledger beneath it. Browse ids with [`praxis eval critiques`](/commands/eval#praxis-eval-critiques).

## praxis axioms deprecate \<id\> · merge

`deprecate <id> --reason "<why>"` retires an active axiom: the file flips to `deprecated`, the reason lands in the ledger, and history stays frozen — the id and every record under it remain readable forever.

`merge <ids...> --into <id>` collapses over-split axioms — several near-twins dividing one principle's evidence into separate rates. Every critique labeled under a merged-away axiom is re-labeled to the survivor (append-only: the prior label stays in the ledger beneath the merge record), the losers deprecate with the merge named, and the survivor's population clock moves to the earliest `introduced` among the merged. Reports recompute instantly — nothing is rewritten.

Prevention runs ahead of the cure: the curate session offers every active **and** proposed axiom as a fold target, so a cluster an existing axiom already remedies is suggested as an assignment rather than drafted as a twin.

## praxis axioms list · show \<id\>

`list` is the store at a glance; `show <id>` is the drill-down every finding cites — statement, both examples, derivation, lifecycle. Both take `--json`. When tooling catches up with an axiom — last year's judgment call is this year's lint rule — retire it with `deprecate`.

## See also

- [The Evidence Loop](/concepts/evidence-loop)
- [praxis eval](/commands/eval) — where critiques come from, and `eval report --axiom <id>`
- [praxis debt](/commands/debt) — pre-spec stock per axiom
