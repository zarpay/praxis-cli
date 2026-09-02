# 03 — The Judgment Boundary

**Status:** Draft — position hardened from the earlier "tiered verification" draft
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

## The authoring gate

The boundary is enforced at _authoring time_, not runtime — via pre-built prompts that assess every candidate axiom's appropriateness for Praxis.

`praxis axioms triage` (04) runs each proposed axiom through the assessment at ratification; `praxis axioms audit` runs it over already-active axioms (tooling capability grows — an axiom appropriate last year may be delegable now). The assessment returns one of:

- **`appropriate`** — deciding requires reading comprehension: quality, intent, completeness-relative-to-meaning. Stays in Praxis.
- **`not_appropriate`** — deterministically decidable. This belongs in static tooling, not Praxis. The axiom is not admitted. What tool picks it up is not Praxis's concern.
- **`split`** — the candidate mixes both, which is the _common_ case in real specs: "declares a `schema payload:` block with `required:`" (mechanical) and "the payload is a complete snapshot" (judgment) live in the same section of the zarpay events spec. Only the judgment half becomes the axiom.

Litmus tests the prompt applies:

- Could a regex or AST query decide this with zero false positives on adversarial input? → not appropriate.
- Would two senior engineers ever disagree on a verdict? Never → probably mechanical → not appropriate.
- Does the criterion turn on _meaning_ — "descriptive," "complete," "justified," "belongs" — rather than _presence_? → appropriate.

The gate is advisory in the same sense everything else is: LLM proposes, human ratifies.

## What remains inside Praxis

**Scoping — structural pre-filters.** Not checks; scope decisions executed before any evaluation, declared in frontmatter, never prose:

```yaml
paths:
  - "backend/app/events/**/*.rb"
excludes:
  - "backend/app/events/application_event.rb"
exemplars: # spec-blessed positive examples
  - "backend/app/events/referral_verified_event.rb"
cohort: by_directory # by_file (default) | by_directory — see below
context: # optional: inlined to assist judgment; never reviewed itself
  - "backend/app/services/**/*.rb"
```

`cohort` has exactly two values. **`by_file`** (the default, so the key is usually omitted): `paths:` collects files, and each file is its own evaluation unit. **`by_directory`**: `paths:` matches _directories_ — e.g. `paths: [src/services/*]` matches each first-layer directory under `src/services/` — and for each matched directory, every file it contains becomes one combined judgment input: one unit, one verdict, one cache entry keyed on the member set. `context:` files are the other kind entirely: inlined into the prompt to give the reviewer what the standard is _about_, never evaluated themselves and never producing verdicts.

**`cohort: by_directory` and `context:` are pre-axiom scope defaults for the open channel**, and they exist to close a bootstrap hole: axioms are born from critiques (04), critiques come from judgments, and per-file judgment can never _see_ a relational violation — so grounded triage could never discover a cohort or file+context axiom. A spec that declares `cohort:` has its open-channel judgment run over the set; one that declares `context:` gets those files inlined. The resulting critiques make the relational standards observable, triage grounds them, and the ratified axiom then **owns its scope and overrides the spec's default**. No `scope:` key exists at the spec layer — the configuration keys are self-declaring (`cohort:` present means cohort-shaped; `context:` present means inlined context). The axiom keeps its explicit `scope:` because there it discriminates variants that carry no payload (`hunk`, `file`, `changeset`) and drives cache keying and verdict diffing.

An exclusion stated in prose is an instruction the reviewer must notice and obey (observed failure: the events SME excludes `ApplicationEvent` in bold prose; the reviewer failed it with six errors while acknowledging the exclusion in its own critique text). An exclusion in frontmatter is a file the reviewer never receives. Prevention beats calibration wherever prevention is available. `exemplars` serve double duty: excluded from adverse judgment, and available as few-shot positives and calibration seed cases (06).

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

The gate isn't only for new axioms — `praxis axioms audit` re-assesses active ones. An axiom that no longer needs Praxis — the standard became mechanically checkable, or stopped mattering — **is removed** (deprecated, 04). Its ledger history is frozen at removal; where the standard went is not Praxis's concern. If the standard turns out to still need judgment, it comes back as a new axiom through the normal propose/ratify path.

## Evaluation flow

1. Scoping filters the unit set (excludes out, paths applied).
2. Judgment axioms evaluate per their declared scope; the reviewer prompt carries the axiom set, the exemplars, and the statement that mechanical criteria are out of scope.
3. Verdict assembly: severity mapping is per-axiom, structured (the events SME already does this in prose — "missing schema → error; missing example → warning").
4. For diff-unit evaluation (01), before/after verdicts feed **verdict diffing** — attribution is computed set-difference over axiom-anchored results on `(axiom_id, location/symbol)` under shared provenance, never a reviewer task.
5. A unit that cannot be evaluated (context overflow, unreadable file) is `unverified` for the affected axioms — never silently passed.

## Trade-off accepted

The boundary kills the earlier aggregation story: the ledger as a single conformance view over grep, rubocop, and LLM findings. Accepted with eyes open — deterministic findings are blocking-and-transient (they rarely merge), their volume would swamp the judgment signal, and orgs already have linter reporting. If a real need emerges, read-only ingestion can return as an annex; nothing in the ledger format precludes it. It is not part of the design.

## Open questions

1. How often does `praxis axioms audit` run — on demand only, or bundled into another surface (e.g. flagged in eval reports when an axiom's critiques look pattern-shaped)?
