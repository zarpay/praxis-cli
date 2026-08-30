# 02 — Baselines, Debt Paydown, and Epochs

**Status:** Draft — rewritten after the authorship premise failed contact with reality
**Depends on:** [vocabulary.md](./vocabulary.md), [01-populations-and-eval-unit.md](./01-populations-and-eval-unit.md)

## The correction this rewrite encodes

The original draft built this document around a human-vs-agent control group: partition post-spec code by author, contrast violation rates per axiom, and let the contrast separate spec problems from harness problems.

The premise fails in practice: **humans let agents code against their own name.** Commit metadata records who merged, not what generated. Old code is unattributable, and — decisively — so is most new code. In an agent-first org the partition is also degenerate: approximately everything is agent-involved, so the "human control arm" is empty even when attribution is honest.

Design rule that follows: **the system must be fully functional with 100% of authorship unknown.** Attribution is an optional sharpening where an org deliberately adopts conventions (see final section) — never a dependency, and never the mechanism the headline metrics rest on.

## What we actually have

Four things, all reliable, none requiring authorship:

1. **A debt baseline.** The first full `eval run` under a spec quantifies nonconformance against your own standard at a point in time.
2. **Forward flow.** Every subsequent diff introduces violations, resolves them, or inherits them — computed by verdict diffing (01), authorship-free.
3. **Observable judge events.** Model and validation-config changes are global Praxis settings updates: visible, datable, recorded in provenance.
4. **Observable spec events.** Spec content is hashed on every verdict; edits are datable to the commit.

## The operative loop

> **Quantify debt against your own standards. Pay it down measurably. Watch whether new work keeps re-introducing violations — that recurring struggle is the harness signal. When you change the standard, accept a hard break in the data.**

- **Baseline** — the epoch-opening full `eval run`. Debt stock per axiom, with coverage alongside (README, principle 1).
- **Paydown** — resolved-violation flow against the baseline. Measurable, chartable, honestly named: this is cleanup, not agent performance.
- **Struggle** — the *introduction rate* per axiom in new work within an epoch. "The harness consistently struggles with payload richness" is a precise sentence: AX-0011's introduction rate stays flat across N diffs while other axioms' rates decline. Consistency of struggle across many diffs is what licenses the word "harness" — a single bad diff licenses nothing.
- **Hard break** — a spec change or judge change ends the epoch. Numbers do not cross the boundary.

## Epochs

An **epoch** is a maximal interval over which the measurement system was stable: the spec content hashes and the judge configuration (model, validation settings) did not change.

- Epochs are **derivable from provenance** already mandated on every verdict and run record — this is what the provenance rule was for. An explicit epoch table is a reporting convenience, not a new source of truth.
- Within an epoch: baselines, paydown, and introduction rates are comparable. Across epochs: **no line is drawn through the boundary** (07, rule 6). Cross-epoch comparison is qualitative — "debt was 340 under spec v2; re-baselined at 410 under spec v3" — never a trend.
- Epoch boundaries are first-class, *named* events in every report: "model → sonnet-4.6", "events spec v3".
- The correct move after a break is a **prompt re-baseline** (a full `eval run`), not interpolation. An epoch without an opening baseline has no denominator.

**The cost of changing a standard, stated plainly for spec authors:** editing a spec spends the trend line of every axiom it touches. This is not a reason to freeze specs — standards should improve — it is a reason to (a) batch spec edits rather than dribbling them, (b) version axioms individually (04) so *untouched* axioms keep their history across a spec edit, and (c) re-baseline immediately. Axiom-level versioning is what makes spec evolution affordable: the hard break is per-axiom, not per-spec.

Per-axiom epochs also resolve cleanly with 01's per-axiom population clocks: a new axiom added to an old spec opens its own epoch with its own baseline, and all existing code is debt *with respect to that axiom* — nobody's introduction rate is retroactively poisoned.

## Diagnosis without a control arm

The control group promised automatic differential diagnosis (spec problem vs harness problem). Without it, the honest substitutes, in decreasing confidence:

- **`harness_gap`** — an axiom whose introduction rate in new work stays high and flat across many diffs within an epoch, while paydown of *other* axioms proceeds. The standard is followable in principle (violations get fixed when pointed out — resolution flow exists) but the harness doesn't carry it into generation.
- **`spec_problem`** — triangulated, not proven: high debt density *and* high introduction rate *and* paydown attempts that fail re-validation, or high judge variance on the axiom (06 — variance is a property of the question, and an unanswerable question is a spec defect). Final call is human.
- **`judge_noise`** — unchanged: residual/self-refuting critiques (04), calibration disagreement (06).
- **`insufficient_data`** — below the small-n floor; say so, recommend nothing.

The brief (08) presents rates and evidence and *suggests* a diagnosis; the confident automatic spec-vs-harness verdict the control group would have licensed is explicitly downgraded. Where attribution conventions exist (below), the contrast returns as additional evidence, not as the mechanism.

## Attribution, retained as an optional sharpening

An org that wants the human/agent contrast can have it — by *declaring* its conventions, never by inference:

- **Structural markers** — `Co-Authored-By:` trailers, bot committer emails, PRs opened by agent identities. High precision, incomplete recall.
- **Configured conventions** — declared in Praxis config: `eval.authorship: { agent_markers, agent_emails, agent_branch_patterns, pr_labels }`.
- **Inference is prohibited.** No classification by commit-message style, velocity, or diff shape. Wrong classifications are worse than unknowns.

Classification is three-way — `agent | human | unknown` — with evidence recorded per record (05) so classifications are recomputable when conventions change. The unknown rate is reported before any contrast; a contrast over a minority of attributable diffs is labelled as such. All confounds from the original draft still apply where the contrast is used: mixed authorship is the norm, review filters agent code more heavily than human code, task mix differs by author, squash merges destroy commit-level attribution, and per-axiom cells go sparse fast (small-n floors, suppression below threshold).

## Epoch detection (decided)

Praxis detects epoch boundaries itself; no manual declaration. At run start, compute the current **judge hash** (model + validation settings + judge system-prompt version) and the covered spec content hashes; compare against the last run record in the ledger. On mismatch:

- Announce the boundary loudly and *name* it ("model → sonnet-4.6", "events spec v3") — this is the label reports use.
- Recommend a re-baseline; auto-set `baseline: true` when the epoch-opening run is a full `eval run`.
- **Warn, never block.**

Epochs are **per judge** (06): each configured judge has its own hash and its own series, so adding a second judge opens that judge's first epoch — with its own baseline — while the incumbent judge's series continues uninterrupted. Removing one ends only its own series.

The cache enforces the boundary structurally — it is **namespaced by judge hash** (05): a judge change swaps the namespace, so pre-break verdicts cannot leak into the new epoch, and rolling the config back re-hits the old namespace at zero re-validation cost. Spec edits invalidate at entry level (spec content is already in the entry key), giving the per-axiom-grained break; judge changes invalidate at namespace level, giving the global one. The cache's invalidation behavior *is* the epoch structure.

## Paydown attribution (decided)

**Credit is attributable where blame is not.** The authorship problem — humans letting agents work under their own name — poisons *struggle* attribution: "whose generation violated the standard" is unanswerable. It does not poison *paydown* attribution: cleanup is deliberate, directed work, and the git identity on the resolving commit meaningfully answers "who drove this," regardless of whether an agent typed the fix.

So: verdict diffing (01) already yields `resolved` events per diff; each carries its resolving commit's git author. Paydown is reported **per author and per directory** (07). Struggle remains population-level only.

## Open questions

1. ~~Detect epoch boundaries or require explicit acknowledgment?~~ **Resolved above:** detect, name, warn, never block.
2. ~~Is paydown attribution worth it?~~ **Resolved above:** yes — per author (git identity of the resolving commit) and per directory.
3. Sampled re-baseline after judge changes (estimate drift cheaply before a full re-run) — **explicitly deferred as a later optimization.** Couples to 06's sampling question; nothing in the data model blocks it.
