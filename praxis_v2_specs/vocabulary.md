# Vocabulary

Definitions the other documents depend on. Where a term has an everyday sense, the definition here is narrower and wins. Disagreements about the system are very often disagreements about these definitions — argue here first.

---

## Terminology decisions

Settled in review (Aug 2026); these bind every document and the v2 implementation. Where v1 code uses an old term, the new term wins at implementation time; v1 CLI verbs remain as deprecated aliases during migration.

- **Judge is canonical** for the evaluating instrument. *Validator* (v1 code naming), *evaluator*, and *reviewer* are banned as synonyms. And the sharpest sentence in this document: **the SME is not the judge — the judge reads the SME as its spec.**
- **Target** replaces *document* wherever the word means "a file a spec covers." Targets are files of any type; "document" survives only where something really is a markdown document.
- **Expert / Practice** replace v1's *Role / Responsibility* in the spec layer, named for what the files actually contain: identity + scope + authorities (an expert's definition), and objective + process + criteria (a practice — a recurring piece of work and the standard for doing it well).
- **One CLI family: `eval`.** v1's `praxis validate ...` unifies under `praxis eval run ...`; report surfaces are `praxis eval report ...`. The rule: `eval run` writes (invokes judges); everything else under `eval` reads what the ledger already knows.
- **Finding is the deduplicated unit.** The chain: `issues[]` (wire format) → critique (evidence, per judge) → finding (one per target + axiom, any number of witnesses) → violation (a finding, when counted).
- **Agent is always qualified** — the *coding agent* (whose work is evaluated) or an *SME agent* (a compiled expert invoked for review); bare "agent" does not appear.

---

## The knowledge side

**Eval layer** — The core of Praxis v2: spec, scope, judge, cache, ledger, triage, axioms, calibration, metrics, briefs. Its input contract is a spec, a scope, and hashable content; it never knows how a spec was authored (11).

**Spec layer** — Everything about producing and maintaining specs, including the compiler tools carried from v1 (experts, practices, constitution, conventions, `praxis compile`, SME profiles). An optional authoring discipline: existing context files are already valid specs without it. The SME's `validates:` double duty is the one bridge between the layers (11).

**Spec** — A document defining what valid looks like for a set of files. Not a new artifact: specs are the developer's *existing* context files — READMEs, CLAUDE.md, AGENTS.md, whatever carries context and direction — which the coding agent has in context while developing AND which optionally bundle into the SME at `praxis compile`. That double duty is the eval's foundation: the judge measures adherence to the exact direction the agent was given, so violations are harness signals, not knowledge gaps. Mechanically: a file matching `specFilePattern` (default `README.md`), optionally targeting files anywhere via `paths:` frontmatter. A spec is *self-authored* — the organization writes its own standard. This is the source of both the system's value (company-specific signal) and its central integrity risk (the metric's author controls the metric).

**Target** — A file a spec covers, of any type (`.rb`, `.ts`, `.md`, ...), reached via `paths:` frontmatter or directory siblinghood. The unit `eval run` judges. v1 called this a *document*, which stopped being true the moment specs targeted code.

**SME (subject matter expert)** — A compiled agent profile that is *also* a spec, via the `validates:` frontmatter key on an expert definition. One artifact, two uses: an SME agent you can invoke for review or advice, and the specification targets are validated against. The identity of these two is a Praxis design commitment, not an accident. **The SME is not the judge** — the judge reads the SME as its spec.

**Expert** — Spec-layer: the source definition — identity, scope, authorities, and a manifest of knowledge to bundle — that `praxis compile` turns into an SME profile. v1: *role*.

**Practice** — Spec-layer: a recurring piece of work with an objective, a process, and success criteria, owned by an expert and inlined into its compiled profile. Practices are the enumerable "what good work looks like" content that judges ultimately check targets against. v1: *responsibility*.

**Axiom** — A single, discrete, named standard, distilled from critiques through triage and traceable to a spec at ratification. "Payloads capture a complete snapshot at emission time." "Documentation comments say when the event fires, not just what it is." A spec is prose for humans and the judge; axioms are the enumerable units that critiques attach to and metrics aggregate over — describing *observed* violation categories, never theoretical document structure. Axioms have durable identity (a stable ID), a version, and a lifecycle (proposed → active → deprecated). Renaming or silently editing an axiom destroys longitudinal comparability; superseding it preserves it.

**Harness** — Everything that shapes an agent's generation *before* it generates: skills, rules, CLAUDE.md content, tool definitions, slash commands, MCP servers, the model choice itself. The eval's purpose is to produce evidence that specific harness elements should change.

---

## The judgment side

**Judge** — The canonical term (see Terminology decisions) for the LLM invocation that evaluates a target against a spec. Currently: one OpenRouter call, `tool_choice: required`, returning exactly one of pass/warn/fail with issues. Judges are **named and plural in config** (06): a team can run several models over the same work simultaneously, each contributing critiques into the shared axiom taxonomy, each with its own cache namespace, epochs, and calibration. The judge is an *instrument*, and instruments have error. Judge error is a first-class concept in this system, not an embarrassment to be hidden: it is measured (calibration), bounded (the judgment boundary — mechanical criteria never reach the judge), structurally prevented where possible (structured exclusions), and — with multiple judges — continuously watched via inter-judge agreement.

**Verdict** — The judge's overall result for one (file, spec) pair: pass, warn, or fail. Verdicts are what the current cache stores.

**Critique** — A single item in a verdict's `issues[]` array. The atomic unit of evidence in this system. A verdict aggregates; a critique locates. Today critiques are prose strings with no identity, no provenance, and no durability — they are overwritten when the file changes. Most of what v2 builds requires critiques to become durable records.

**Finding** — The deduplicated, axiom-anchored unit every consumed surface shows: one per (target, axiom), regardless of how many judges witnessed it (each witness is corroboration, recorded). Critiques are evidence; findings are what developers and coding agents work through; violations are findings, when counted (07).

**Open code** — A critique treated as raw qualitative data, before categorization. The term is from grounded theory, and the borrowing is deliberate: triage (04) is open coding → axial coding — critiques either fall under established axioms or propose new ones — and that methodology's warnings (don't let categories drift mid-study, don't code with a taxonomy you haven't ratified) apply directly.

**Calibration** — Measuring the judge against frozen, human-adjudicated cases. Produces agreement, precision, recall, and false-positive rate *for the judge itself*. A conformance number from an uncalibrated judge is not interpretable, and the system should say so rather than print it.

**Judge drift** — Change in the judge's behavior with no change in the code under evaluation: a model swap, a spec edit, provider-side model updates, or sampling variance. Indistinguishable from real conformance change unless verdicts carry provenance and calibration is re-run on judge changes.

---

## The measurement side

**Provenance** — The recorded facts that make a verdict interpretable later: judge model, spec content hash, target content hash, timestamp, config. A verdict without provenance is a number without units. Mandatory on every stored verdict and critique.

**Coverage** — The fraction of the codebase (or of a diff) that falls under any spec's scope. Coverage is the denominator-of-denominators: every conformance number is conditioned on it, and every conformance report must display it. A conformance improvement alongside a coverage decline is a red flag, not a win.

**Conformance** — The fraction of *evaluated* units that satisfy their specs. Always qualified by population (see below) and always paired with coverage. Unqualified "conformance" is banned from reports.

**Applicable opportunity** — For an axiom, the set of units where the axiom could have been violated. The denominator for violation rates. "45 naming violations" is noise; "45 naming violations across 26 files where naming applies" is a rate. Counting opportunities is harder than counting violations and is still mandatory.

**Debt** — Nonconformance in code that predates its spec. A backlog to burn down, possibly informative about spec realism, and *categorically not* evidence about agent performance. See [01](./01-populations-and-eval-unit.md).

**Followability** — Whether a spec is satisfiable in practice. Ideally evidenced by post-spec human-written code — but that evidence is mostly unavailable (authorship is unknown by default), so in practice followability is triangulated: resolution flow exists (violations get fixed when pointed out), judge variance is low (the question is answerable), paydown attempts pass re-validation. See [02](./02-baselines-and-debt-paydown.md).

**Baseline** — The epoch-opening `validate all`: the debt stock per axiom, with coverage alongside, at a point in time. Every epoch needs one or it has no denominator. See [02](./02-baselines-and-debt-paydown.md).

**Epoch** — A maximal interval over which the measurement system was stable: spec content hashes and judge configuration unchanged. Comparisons live within epochs; nothing is charted across a boundary. Detected automatically at run start (warn, never block) and enforced structurally: the cache is namespaced by judge hash, so pre-break verdicts cannot leak across a judge change, and config rollback re-hits the old namespace free. Boundaries are named, first-class events in reports. Per-axiom, not per-spec — axiom versioning (04) keeps untouched axioms' history across spec edits. See [02](./02-baselines-and-debt-paydown.md).

**Paydown** — Resolution flow against the debt baseline: violations from P1 fixed over time. Cleanup work, honestly named — never charted as agent performance. See [02](./02-baselines-and-debt-paydown.md).

**Struggle (introduction rate)** — Per-axiom rate at which *new work within an epoch* introduces violations. Flat struggle on one axiom while others decline is the harness signal: the standard isn't being carried into generation. The word "consistently" is load-bearing — one bad diff licenses nothing. See [02](./02-baselines-and-debt-paydown.md).

**Eval unit** — The thing a conformance measurement attaches to. For agentic development eval, the unit is the *diff* (a commit or PR's changes to spec-covered files), not the file and not the corpus. The diff is the **attribution scope**, not the judge's input. See [01](./01-populations-and-eval-unit.md).

**Judgment scope vs attribution scope** — Judgment scope is what the judge reads: holistic, per the axiom's declaration (`hunk | file | file+context | cohort | changeset`). Attribution scope is what the verdict lands on: the diff. Attribution is *computed* by verdict diffing (before/after set-difference on axiom-anchored critiques), never asked of the judge — the judge is good at reading and bad at bookkeeping. See [01](./01-populations-and-eval-unit.md).

**Cohort** — A declared set of files carrying relational standards that do not exist at file granularity (completeness, orphans, cross-file consistency). Judged as a set, keyed on a cohort hash (member list + member hashes), so membership changes are judgeable events. Boundaries are declared by the spec author, never inferred. Aggregating files that carry only file axioms is not a cohort — and is prohibited (see [03](./03-judgment-boundary.md), batching).

**Violation flow** — Per-diff counts of violations *introduced*, *resolved*, and *inherited*, computed by verdict diffing. Flow, not stock, is the primary P3 signal; always reported against the judge-variance noise floor from calibration. See [01](./01-populations-and-eval-unit.md).

**Population** — Which code-relative-to-spec cohort a unit belongs to. The operational partition is two-way — pre-spec vs post-spec — because it needs only dates; the finer human/agent split within post-spec exists only under declared attribution conventions (02). Conflating pre-spec debt with post-spec generation is the easiest way to produce a chart that means nothing.

---

## The feedback side

**Ledger** — The append-only store of critiques, verdicts, run metadata, and provenance. Distinct from the cache: the cache answers "is this file compliant right now" and legitimately overwrites; the ledger answers "what has ever happened" and never does.

**Run** — One invocation of validation across some scope, with an ID, cost accounting (tokens, dollars), cache hit/miss stats, and a commit SHA locating it in history.

**Brief** — The structured output of the feedback loop: top axioms by violation rate, representative critiques, and the populations implicated — handed to a coding agent (via slash command) to draft harness or spec changes as reviewable PRs. Praxis emits briefs; it does not edit the harness itself.
