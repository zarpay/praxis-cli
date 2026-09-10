# 03 — The Judgment Boundary

**Status:** Draft — position hardened from the earlier "tiered verification" draft; authoring gate retired 2026-09-09
**Depends on:** [vocabulary.md](./vocabulary.md), [01](./01-populations-and-eval-unit.md); couples to the axiom model (04)

## The position

**Don't use Praxis for what static linting can accomplish.**

The earlier draft had Praxis running its own deterministic checks (inline regex/AST rules) and adapters ingesting rubocop/eslint findings into the ledger. Rejected — the boundary is the stronger design:

1. **Praxis-as-checker is a worse rubocop.** No editor integration, no autofix, no speed, no ecosystem maturity. Competing there is a losing battle that dilutes what Praxis uniquely does.
2. **Every mechanical criterion kept out of the reviewer is a class of reviewer error made impossible** — and a class of calibration burden removed. The tiered design achieved this by routing; the boundary achieves it by admission control, which is cleaner.
3. **Deterministic violations don't accumulate; judgment violations do.** Static checks are typically CI-blocking — violations never merge, never become debt, and would register as near-zero noise in eval metrics. Judgment violations are the ones that merge and pile up. They are the eval's subject matter; the boundary keeps the metrics about them.
4. **Focus is the pitch.** "Praxis evaluates what linters can't" is both the product boundary and the sales sentence.

The authoring aphorism:

> **If you can write the check, write the check. If you can only describe the standard, write the axiom.**

## Where the boundary is held

The boundary is held at _authoring time_, not runtime — and at the
moment of **drafting**, not after acceptance.

**The authoring gate is retired** (owner, 2026-09-09). Praxis shipped
a curator call that assessed every accepted draft as `appropriate`,
`not_appropriate` or `split` — at curate-accept, again at the (since
retired) ratify step, and over active axioms via `praxis axioms audit`. It stopped mechanical
drafts, but at the wrong place: after a human had already accepted the
cluster. A refused cluster left no ledger record, so its critiques
resurfaced unchanged on every curate run — the same suggestion, the
same refusal, forever. Guidance on what makes a good axiom belongs
where the axiom is drafted; once a person has read the draft and
accepted it, that acceptance is the decision, and nothing
second-guesses it. `praxis axioms audit`, which was the gate re-run
over active axioms, retires with it.

What holds the boundary now:

- **The curator's drafting prompt** carries the litmus tests below and
  the aphorism. A cluster that is mechanical is suggested **held** with
  the reason stated (curate never dismisses — validity is `eval
  review`'s question, 2026-09-09); a cluster that mixes a
  mechanical half with a judgment half is drafted as the judgment half
  alone; a cluster an existing category already names is suggested as
  an assignment, never a twin.
- **The human at curate** reads the draft with the same tests in mind
  and accepts, holds, or (for a standing proposal) rejects — and
  acceptance activates (2026-09-09: ratify retired as a duplicate
  yes). Every decision that decides something is a ledger record, so
  nothing recurs.
- **Deprecation** (04) is the removal path for an active axiom that
  tooling has caught up with: `praxis axioms deprecate <id> --reason
  "now a lint rule"`.

Litmus tests the drafting prompt applies:

- Could a regex or AST query decide this with zero false positives on adversarial input? → mechanical, not an axiom.
- Would two senior engineers ever disagree on a verdict? Never → probably mechanical → not an axiom.
- Does the criterion turn on _meaning_ — "descriptive," "complete," "justified," "belongs" — rather than _presence_? → an axiom.
- Does the candidate mix both — the _common_ case in real specs: "declares a `schema payload:` block with `required:`" (mechanical) and "the payload is a complete snapshot" (judgment) live in the same section of the zarpay events spec? → draft the judgment half alone.

## What remains inside Praxis

**Scoping — structural pre-filters.** Not checks; scope decisions executed before any evaluation, declared in frontmatter, never prose:

```yaml
paths:
  - "backend/app/events/**/*.rb"
excludes:
  - "backend/app/events/application_event.rb"
  - "backend/app/events/referral_verified_event.rb"
cohort: by_directory # by_file (default) | by_directory — see below
context: # optional: inlined to assist judgment; never reviewed itself
  - "backend/app/services/**/*.rb"
```

`cohort` has exactly two values. **`by_file`** (the default, so the key is usually omitted): `paths:` collects files, and each file is its own evaluation unit. **`by_directory`**: `paths:` matches _directories_ — e.g. `paths: [src/services/*]` matches each first-layer directory under `src/services/` — and for each matched directory, every file it contains becomes one combined judgment input: one unit, one verdict, one cache entry keyed on the member set. `context:` files are the other kind entirely: inlined into the prompt to give the reviewer what the standard is _about_, never evaluated themselves and never producing verdicts.

**`cohort: by_directory` and `context:` are the spec's scope declarations, and the spec's alone** (rewritten 2026-09-07, review→label): the reviewer sees only the spec, so review scope can live nowhere else. Per-file judgment can never _see_ a relational violation — a spec that declares `cohort:` has its judgment run over the set; one that declares `context:` gets those files inlined — and the resulting critiques make relational standards observable, so curation can ground them. A ratified axiom carries no scope of its own (the former axiom `scope:`/`context:` keys are retired): the standard's reach is exactly the reach of the spec sentence that grounds it. No `scope:` key exists at the spec layer either — the configuration keys are self-declaring (`cohort:` present means cohort-shaped; `context:` present means inlined context).

An exclusion stated in prose is an instruction the reviewer must notice and obey (observed failure: the events SME excludes `ApplicationEvent` in bold prose; the reviewer failed it with six errors while acknowledging the exclusion in its own critique text). An exclusion in frontmatter is a file the reviewer never receives. Prevention beats calibration wherever prevention is available. The former `exemplars:` key is retired (owner, 2026-09-08): a live file held up as a blessed example drifts — nothing stops an edit to the exemplar from turning a bad example exemplary. Positive examples belong in the spec's own prose, frozen with the standard they illustrate; the retired key parses and is ignored.

**Judgment axioms** (`mode: judgment`, the default). The LLM reviewer, for questions that need reading: quality of descriptions, richness of payloads, "is this business logic." Carries the full apparatus — provenance, caching, calibration, drift tracking. Judgment input is always holistic per the axiom's declared scope — the reviewer reads files, never bare diffs (01).

**Agentic judgment** (`mode: agentic`; opt-in, deferred). A reviewer with read tools that explores the codebase the way the interactive SME agent does — closing the epistemic gap between the SME-as-agent (has tools) and the SME-as-pipeline-reviewer (one-shot prompt). Strictly more capable than `file+context` where relevant context can't be statically declared. Costs are structural: spend becomes unbounded-ish, variance rises, provenance requires logging every tool call, calibration gets harder. An axiom must opt in explicitly, making its expense visible by declaration. Nothing initial requires this mode; it exists in the schema so `file+context` isn't silently stretched into pseudo-agentic behavior.

## Scope declarations

Defined in 01, owned here: `hunk` (decidable from the change alone; opt-in cost optimization), `file` (default), `file+context` (spec-declared extra files inlined into the judgment prompt — and into the content hash, or provenance breaks), `cohort` (relational properties of a declared set — completeness, orphans, cross-file consistency; reviewed over the whole set, keyed on a cohort hash of member list + member hashes; boundaries declared via `cohort: by_directory | glob`, never inferred), `changeset` (reviewed from the whole diff across touched files; where propagation-failure axioms live, which is where agent failure modes concentrate).

**The governing rule: the reviewer's context contains exactly what the axiom is about.** Less is myopia (the `file+context` cases); more is contamination — a reviewer shown 30 files while evaluating one normalizes file B's violation against file A's pattern, or invents consistency requirements the spec never states. The same effect that is a bug for file axioms is the _feature_ for cohort axioms: seeing the set together is the only way to review a relational property.

**Batching is prohibited for file-scoped axioms.** The tempting middle — N files, one call, structured per-file verdicts — fails on provenance, not cost: batch-mates are part of the judgment input, so a per-file cache entry extracted from a batched call is not reproducible per-file. Recording the batch-mates fixes provenance but makes cache hits require identical batches, which makes the cache useless. Prompt caching of the shared spec prefix captures the savings legitimately; per-file calls also keep the reviewer's full attention on one unit (a 30-file context invites lost-in-the-middle degradation).

**Cohort guardrails:** cohort axioms should be few and structural — a spec whose cohort axioms require close-reading every line of every member is mis-scoped. A cohort exceeding the context window is a hard failure reported as `unverified`, never silently truncated — truncation is invisible myopia. Cohort verdicts diff at cohort level (the cohort hash identifies before/after states), with whole-set re-judgment noise reflected in that axiom's calibration variance (06).

## What the reviewer is told

The spec document keeps its mechanical content — it serves human readers, and those rules are still the team's standards. But the **judgment contract is the axiom set** (04): the reviewer is asked about admitted judgment axioms only, and the SME's enforcement posture states that mechanical criteria are out of scope and must not be evaluated.

This directly removes the surface the observed hallucinations grew on: the reviewer re-deriving naming and inheritance checks badly (flagging the spec's own canonical example as a naming violation; inventing a "recommended async queue" criterion). A reviewer that is never asked mechanical questions cannot answer them wrongly.

Delegated tooling's findings do **not** enter the ledger (05). The ledger is judgment-only.

## Removal — axioms that no longer earn their place

An axiom that no longer needs Praxis — the standard became mechanically checkable, or stopped mattering — **is removed** (deprecated, 04): `praxis axioms deprecate <id> --reason`. Its ledger history is frozen at removal; where the standard went is not Praxis's concern. If the standard turns out to still need judgment, it comes back as a new category through the normal curate path. Noticing that tooling has caught up with an axiom is a human reading — the curator re-assessment that once did this (`praxis axioms audit`) retired with the gate (2026-09-09).

## Evaluation flow

1. Scoping filters the unit set (excludes out, paths applied).
2. Judgment standards evaluate per the spec; the reviewer prompt carries the spec, its context files, and the statement that mechanical criteria are out of scope.
3. Verdict assembly: severity is the reviewer's structured call per critique, guided by the spec's own binding-vs-advisory language ("must" reads as error; "should" as warning).
4. For diff-unit evaluation (01), before/after verdicts feed **verdict diffing** — attribution is computed set-difference over axiom-anchored results on `(axiom_id, location/symbol)` under shared provenance, never a reviewer task.
5. A unit that cannot be evaluated (context overflow, unreadable file) is `unverified` for the affected axioms — never silently passed.

## Trade-off accepted

The boundary kills the earlier aggregation story: the ledger as a single conformance view over grep, rubocop, and LLM findings. Accepted with eyes open — deterministic findings are blocking-and-transient (they rarely merge), their volume would swamp the judgment signal, and orgs already have linter reporting. If a real need emerges, read-only ingestion can return as an annex; nothing in the ledger format precludes it. It is not part of the design.

## Open questions

1. ~~How often does `praxis axioms audit` run — on demand only, or bundled into another surface (e.g. flagged in eval reports when an axiom's critiques look pattern-shaped)?~~ Dissolved 2026-09-09: `audit` retired with the authoring gate; removal is a human reading and `deprecate`.
