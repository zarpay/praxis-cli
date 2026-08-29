# 01 — Populations and the Eval Unit

**Status:** Draft
**Depends on:** [vocabulary.md](./vocabulary.md)

## The problem this solves

The naive design — run `praxis validate all`, chart the pass rate over time, call it "agent quality" — produces a number that means nothing, because it aggregates over code with completely different relationships to the spec.

The observation that surfaced this: in zarpay/core, the event files were bulk-committed ~2026-05-07 and the SME spec was introduced 2026-06-05. The corpus scan shows 41 FAIL / 7 WARN / 1 PASS. That is not 41 findings about agents, or about the judge — it is a spec applied retroactively to code written before the standard existed. **This is the universal starting condition**: every codebase that adopts Praxis begins with its entire history in this state.

## The three populations

Every unit of code, relative to a given spec version, belongs to exactly one population:

| # | Population | Definition | What its conformance measures |
|---|---|---|---|
| P1 | **Pre-spec** | Written before the spec (version) existed | **Debt.** A backlog. Says nothing about agents or the harness. |
| P2 | **Post-spec, human-authored** | Written by a human after the spec existed | **Followability.** Is the standard achievable and internalized? |
| P3 | **Post-spec, agent-authored** | Written by an agent after the spec existed | **The eval.** The population whose conformance speaks to the harness. |

**Honesty constraint (02):** the P2/P3 split is *conceptually* real but *operationally* mostly unavailable — humans let agents code against their own name, so post-spec authorship is unknown by default and the split exists only where an org deliberately adopts attribution conventions. The load-bearing partition is therefore the two-way one — **pre-spec vs post-spec** — which needs only dates, and dates git gives reliably. In an agent-first org, post-spec flow *is* the harness signal without any partition.

Rules that follow:

1. **Never aggregate across populations in a headline metric.** A "conformance rate" that mixes P1 debt with post-spec generation is uninterpretable by construction.
2. **P1 gets its own product surface** — the debt baseline and paydown report (02): burn-down over time, debt per axiom, debt concentration. Useful, chartable, and honestly named.
3. **Post-spec introduction rate is the agentic development eval** — per axiom, within an epoch (02). Everything else in the system exists to make this one number trustworthy.
4. **The P2/P3 contrast is an optional sharpening** where attribution conventions exist — evidence for diagnosis (02), never the mechanism.

### Population assignment mechanics

Population membership is derivable from data Praxis already has or can cheaply get:

- **Spec birthdate / version dates** — `git log` on the spec file. A spec's *content hash* changes on every edit; the axiom-relevant question is when the *requirement* appeared, which spec versioning (04, follow-on) will track. First approximation: file-level first-commit date.
- **Code birthdate** — `git log --follow` on the file; for diff-level units, the commit date itself.
- **Authorship** — see [02](./02-baselines-and-debt-paydown.md); this is the hard part.

Edge case to resolve: a file created pre-spec but modified post-spec is P1 *as a file* but its post-spec **diffs** are P2/P3. This is one of the reasons the file cannot be the eval unit.

## The eval unit is the diff

For agentic development eval, the unit of measurement is **the diff**: the changes a commit (or PR) makes to spec-covered files. Not the corpus, not the file.

Why the corpus fails: dominated by P1; changes slowly; one refactor swings it more than a quarter of agent work.

Why the file fails: a file conflates every author and era that ever touched it. An agent that adds one clean method to a debt-ridden file "fails" that file; an agent that dumps a violation into a pristine file "passes" more of the corpus than it broke. Both are attribution errors.

Why the diff works:

- It has a **single author** (or close enough to resolve — see 02).
- It has a **timestamp**, hence an unambiguous population.
- It is what a review actually looks at, so critiques anchored to a diff are actionable.
- It bounds judge context: evaluating a diff-plus-surrounding-context is cheaper and more focused than evaluating whole files.
- It matches the SME-review workflow zarpay/core already runs: SMEs review work as it lands, not the corpus on a schedule.

### Judgment scope vs attribution scope

The central design move: the judge's *input* and the eval's *unit* are different things, and conflating them produces either myopia or attribution error.

- **Judgment scope** — what the judge reads. Holistic: the full file, plus whatever cross-file context the axiom declares it needs (03). A diff is too thin to judge; a method added to a file cannot be evaluated without the file (did it add a *second* `schema` block? did it push logic into a class that must stay declarative?).
- **Attribution scope** — what the verdict lands on. The diff. But attribution is **computed, never judged**.

**Never ask the judge to do attribution.** "Here is the file and the diff — which violations did the diff introduce?" invites exactly the class of error the judgment boundary (03) exists to prevent: the judge is good at reading and bad at bookkeeping. Instead:

1. Judge the file at the parent commit → holistic verdict.
2. Judge the file at the new commit → holistic verdict.
3. **Diff the verdicts.** Present-after but not-before = *introduced* by this diff. Present-before, absent-after = *resolved*. Present in both = *inherited* — attributed to P1 debt, not to the diff's author.

Step 3 is mechanical set-difference: an algorithm does it exactly, an LLM approximately. Same principle as the judgment boundary (03) — never route through judgment what can be computed.

**Cost structure falls out of existing infrastructure:** the parent version's verdict is usually already in the content-hash cache (it was validated on the previous run or in CI), so diff evaluation costs roughly *one* judge call, not two.

**What verdict diffing demands:**

- **Critiques with identity.** Prose paragraphs cannot be set-differenced. "Is this the same violation as before?" is answerable only when critiques anchor to `(axiom_id, location/symbol)` — the strongest single argument for the axiom layer (04) and for critiques becoming durable records (05).
- **Shared provenance across the comparison.** If before/after verdicts come from different judge states (model swap, spec edit), sampling variance masquerades as introduced/resolved flow. Both sides must share model + spec content hash, or the comparison is refused. Judge nondeterminism itself sets a noise floor, measured by calibration variance (06): flow signal below that floor reports as "insufficient data," not as a finding.

### Axiom scope: hunk | file | file+context | cohort | changeset

Myopia has three distinct shapes, and axioms declare which context they need (03 owns the schema):

- **`file`** — the default. Judged from the whole file; most structural axioms live here.
- **`hunk`** — a cost optimization for axioms genuinely decidable from a change in isolation, and for very large files. Opt-in, never the default.
- **`file+context`** — axioms that cannot be judged from the file alone. From the events SME: *payload richness* ("captures a complete snapshot of what the emitter had in memory") requires seeing the emitting service; *invoke targets* require the invoked service; *bus collisions* are relative to every other event. The spec declares what extra context is inlined (03). **Hard consequence for the cache:** context files must join the content hash — a verdict computed over `(document, spec, context)` that only hashes `(document, spec)` is non-reproducible and breaks provenance (05).
- **`cohort`** — relational properties of a *set* of files that do not exist at file granularity: "every public service method has a spec," "the namespace has a README and a single `Service` entry point," "no orphaned files," "these controllers share the same auth pattern." You cannot ask "is this file compliant?" about "no orphans." Judgment input is the whole cohort; the verdict keys on a **cohort hash** (member list + member content hashes), so a file being *added or deleted* is itself a judgeable event — exactly what completeness and orphan axioms need. Cohort boundaries are declared by the spec author (`by_directory` or explicit glob), never inferred. Homogeneous type-collections (events, Rails controllers) tend to carry file axioms; feature namespaces tend to carry cohort axioms — but the delineation lives on the axiom, not the SME: one SME routinely carries both.
- **`changeset`** — properties of the *change itself*, judgeable from no single file: "a schema change updates the docs," "an event rename updates every subscriber." The judgment input is the whole diff across touched files — a diff-shaped cohort. Disproportionately valuable for P3: agents are characteristically good at local edits and bad at propagating consequences, so changeset axioms are where agent failure modes concentrate.

**Aggregation is never a cost optimization — it is only for cohort-shaped standards.** The cold-run saving of judging a directory in one call (the spec prefix paid once instead of N times) inverts in steady state: an aggregate verdict hashes the concatenation, so touching one file re-judges the whole set — and re-judging N-1 untouched files gives the judge N-1 opportunities to nondeterministically flip verdicts on code nobody changed, each flip a false entry in the flow metric. Per-file judgment structurally caps flow noise to touched files. The legitimate route to the cold-run saving is provider-side prompt caching of the shared spec prefix.

Note the epistemic asymmetry this surfaces: the SME *as an interactive agent* has tools and can go read the emitter; the SME *as a pipeline judge* is a one-shot call that sees only its prompt. `file+context` closes that gap statically and cheaply. An agentic judge with read tools (`mode: agentic`, sketched in 03) closes it dynamically at real cost — an axiom must opt in explicitly.

### Derived metric: violation flow

Once verdicts are diffable across runs, the interesting number is not the stock (how many violations exist) but the **flow**: violations *introduced* vs violations *resolved* per diff. Post-spec introduction flow is the sharpest available signal of harness quality: "diffs this month introduced 0.3 violations per applicable opportunity, down from 0.5" is a real sentence — and within an epoch (02) it needs no authorship data to be meaningful. Debt paydown is resolution flow against the P1 baseline. Same machinery, different populations. Flow is always reported against the judge-variance noise floor (06) and never crosses an epoch boundary.

## Corpus conformance survives — renamed and demoted

`praxis validate all` remains: it is the debt report, the coverage report, and the cache warmer. Its output is labelled **corpus conformance (includes pre-spec debt)** and is never charted as agent performance. The eval reports draw from the ledger of diff-level results instead.

## Consequences for the rest of the system

- The **ledger** (05) must record, per critique: the commit SHA, the population, the authorship classification, and whether the violation was introduced or inherited. Population is assigned at write time but must be *recomputable* (provenance rule) — spec birthdates can be revised.
- **Metrics** (07) get a mandatory population qualifier. Unqualified conformance is banned from report output.
- **Coverage** applies per population too: "82% of post-spec diff lines fell under some spec" is the honest denominator for eval claims. Work in uncovered directories is invisible to the eval, and the report must say how much work was invisible.
- The **judge interface** needs before/after evaluation and verdict diffing — today `DocumentValidator` knows single whole files and nothing about commits. The cache is reused as the before-side verdict source.

## Open questions

1. ~~When a spec is edited, does the population clock reset per axiom?~~ **Resolved in 02:** yes — population clocks and epochs are per-axiom. A new axiom opens its own epoch with its own baseline; untouched axioms keep their history across a spec edit. This is what makes spec evolution affordable.
2. Mixed diffs: one commit touching both covered and uncovered files. Proposal: evaluate the covered portion, record the uncovered fraction as a coverage statistic on the run.
3. Rebases and squashes rewrite the unit. Probably resolved by evaluating at PR level rather than commit level where a PR exists — the PR is the durable unit of intent.
