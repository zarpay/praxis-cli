# 04 — Axioms: Identity, Extraction, Lifecycle

**Status:** Draft — extraction pipeline settled on grounded triage
**Depends on:** [vocabulary.md](./vocabulary.md), [03-judgment-boundary.md](./03-judgment-boundary.md)

## Why axioms exist

Specs are prose; metrics need enumerable units. A critique that cannot be attached to a named, stable standard cannot be aggregated, trended, or contrasted across populations. Axioms are that unit.

The non-negotiable property is **identity stability**. If the taxonomy reshuffles — an LLM re-clustering critiques from scratch each run — every longitudinal chart dies. Hence the lifecycle rules below are the actual spec; the extraction method is just how axioms get born.

## Format

Markdown + frontmatter in `.praxis/axioms/`, versioned in git — consistent with Praxis's plain-markdown, human-reviewable stance.

```yaml
---
id: AX-3f9c2d # stable; never reused, never renumbered; random-minted (see note)
version: 2
status: proposed | active | deprecated
mode: judgment | agentic # see 03; agentic is explicit opt-in
scope: hunk | file | file+context | cohort | changeset # see 01; declarations in 03
context: [...] # file+context only; joins the content hash (05)
cohort: by_file | by_directory # cohort only; membership boundary, never inferred
severity: error | warning
grounded_in: backend/app/events/README.md#payload-schema # spec traceability, established at ratification
introduced: 2026-08-29
supersedes: AX-0003 # optional
---
Statement of what the axiom asserts.
A violating example. A compliant example.
```

**Implementation notes (2026-09-03, flagged):** ids are `AX-` + 6 random hex, never sequential — two contributors triaging on separate branches must not be able to mint one id for two standards; a merge would fuse their meanings, the exact corruption this document forbids. Chronology lives in `introduced`, not the id. Triage decisions are append-only ledger records in `.praxis/ledger/triage/<session_id>.jsonl` (`assignment` / `dismissal` / `rejection` kinds); _pending triage_ is derived — a null-axiom critique no record covers — never stored. `assigned_by` records both halves: `{decision: "human" | "flag:--yes", suggested_by: <curator model>}`; checklist-born critiques carry `assigned_by: "checklist"`. The organizing/gating/tracing model is the config's `curator` role — required, never defaulted to a reviewer.

## Lifecycle rules

- **LLM proposes, human ratifies — and humans may propose directly.** Nothing enters `active` automatically. Proposed axioms live in `.praxis/axioms/proposed/` and have no effect on metrics. A human may author a proposal without critique parentage (the honest path for standards known to be relational before any run — e.g. a `scope: cohort` completeness axiom); it passes the same gate and ratification as any triage-born proposal.
- **Active axioms are immutable in meaning.** Clarifying wording without changing extension: version bump. Changing what counts as a violation: new ID with `supersedes`, old one deprecated. When in doubt, supersede — a version bump that quietly moves the boundary corrupts every historical rate.
- **Every candidate passes the authoring gate** (03): `appropriate | not_appropriate | split`. An axiom that no longer earns its place is simply removed — deprecated, history frozen; where the standard went is not Praxis's concern.
- **Deprecated axioms keep their ledger history.** Deprecation stops future evaluation; it never deletes evidence.
- **Population clocks are per-axiom** (01, open question 1, resolved here): a unit is pre- or post-spec _relative to each axiom's `introduced` date_. Adding an axiom to an old spec does not retroactively make old code "agent failure."

## Extraction: axioms are grounded in critiques, validated against the spec

Axioms are not derived from the spec's text. The workflow is: someone writes the spec; validation runs; critiques come back — the **open codes**. The taxonomy grows out of them through triage:

1. **`praxis axioms triage` — a human review session, LLM-assisted.** Triage is deliberately interactive: it is the primary touchpoint where the team actually reads what the reviewers are saying, and one of the several points from which they go back and adjust harness, specs, and context. The division of labor is fixed: the **LLM organizes** — groups unassigned critiques, suggests which established axiom each falls under, drafts proposals that encompass clusters — and the **human decides**: fold a critique into an axiom, dismiss it, or accept a draft into `.praxis/axioms/proposed/`. Every assignment written to the ledger (`axiom_id` + version) is a human decision, LLM-suggested; `assigned_by` records both. Nothing activates without ratification. Future critiques repeat the same motion: fall under established axioms, or propose new ones.

   The structural reason triage is human: **assignment error corrupts per-axiom rates exactly as reviewer error does.** The reviewer's error is bounded by calibration (06); the assignment step is bounded by putting a human on it — which keeps the ledger's axiom column trustworthy without building a second calibration apparatus for a second LLM instrument. Like every interactive verb, triage scripts (`--yes`, 09) — but a team that scripts past the review is adopting the framework while keeping the habits it exists to replace, and their unreviewed assignments are exactly as trustworthy as that sounds.

2. **Ratification is where the spec enters.** A proposed axiom must be _traceable to the spec_ — the ratifier, aided by the triage output, answers: which spec criterion grounds this? Three outcomes:
   - **Traceable** → ratify; the axiom records its grounding (`grounded_in`).
   - **Not traceable, but the standard is real** → the spec is incomplete; fix the spec, then ratify.
   - **Not traceable and not intended** → the reviewer invented it (observed: seven "recommended async queue" critiques for a recommendation the spec never makes). Reject; route to calibration (06) as reviewer noise.
3. **The authoring gate applies at ratification** (03): a proposed axiom that is mechanical (`not_appropriate`) is not admitted — and is itself a signal that the reviewer is being asked mechanical questions.

Why grounded rather than deductive (an earlier draft seeded axioms from spec section headings): the taxonomy should describe **observed violation categories, not theoretical document structure**. Spec sections nobody violates produce no axioms and no noise, and spec authors write prose for humans and the reviewer without their headings becoming a taxonomy. The zarpay observation — 223 critiques collapsing to ~8 clusters that mirror the spec's headings — is reinterpreted: a well-written spec causes grounded triage to _rediscover_ its structure. Convergence is a health signal; divergence marks where the spec is vague or the reviewer drifts.

### The two-channel reviewer

The judgment prompt carries two channels:

- the **axiom checklist** — established axioms; critiques come back pre-categorized, no triage needed;
- the **open channel** — "other violations of the spec not covered above" — the ongoing supply of open codes for triage.

Bootstrap is the degenerate case: no axioms yet, everything arrives through the open channel — and the open channel's judgment shape follows the spec's pre-axiom scope defaults (`cohort:` / `context:` frontmatter, 03), which is what makes relational violations observable before any axiom exists to declare a scope.

**Axioms are reviewer-independent.** Their authority comes from ratification against the spec, not from the reviewer that surfaced them — so a reviewer change (02) leaves the taxonomy intact. An epoch break resets the _metrics_, never the _axiom set_: established axioms remain the checklist under the new reviewer, and whatever the new reviewer notices that the old one didn't arrives through the open channel as proposals, like any other run. Discovery is continuous.

### Residual

**Residual** = critiques triage cannot ground in the spec: not assignable to an established axiom, and not clusterable into a spec-traceable proposal. Pending-triage critiques are a queue, not residual. The **residual rate** is a health metric with two readings, and the dismissal reasons say which: the reviewer is drifting off-spec (noise — route to calibration), or the reviewer is consistently perceiving a real standard no spec has written down (discovery — the "overcomplicating this" critiques that precede a "keep it simple" convention). The second reading is the taxonomy's intake channel for unstated values: fix the specs, and the same critiques become groundable. Rejected-at-ratification proposals feed the same signal.

## Open questions

1. Assignment provenance: critiques store `axiom_id` + `axiom_version` + the assigner (model, date). Re-assignment after taxonomy changes — full re-run or incremental?
2. ~~Granularity norms~~ **Resolved (2026-09-03): the altitude of one remediation.** An axiom sits at the right level when its violations share a single fix — one harness or spec edit that would move its rate. Split when the fix differs (severity differing is the special case); lump when it does not. This bounds axioms into a band: the authoring gate is the floor (mechanical restatements of individual spec bullets are refused), and one-remediation is the ceiling against bucket gravity — triage's fold-first preference must never merge critiques whose remediations differ, because a merged rate points at two different edits with one number, and a taxonomy with one giant bucket has stopped categorizing. Healthy altitude is empirically section-level (the zarpay 223→~8 convergence), not bullet-level, not document-level.
3. ~~Cross-spec axioms~~ **Resolved (2026-09-03): a standard true across many specs is evidence of a missing universal spec, not a multi-grounded axiom.** "Keep it stupid simple" belongs stated once, in a conventions/constitution-grade spec whose `paths:` cover everything it governs; the axiom grounds there — one statement, one grounding, org-wide rates under one id, no new machinery. Grounding single-spec stays the rule, and traceability stays the ceiling that forces the honest move: no spec states the standard → extend the specs (here: author the universal one), then ratify.
