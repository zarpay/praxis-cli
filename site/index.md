---
layout: home
hero:
  name: Praxis
  text: The standards your linter can't hold
  tagline: Write what correct looks like next to the code it governs. Praxis has LLM reviewers enforce it, keeps the evidence, and turns recurring findings into named, human-accepted standards.
  actions:
    - theme: brand
      text: Quick Start
      link: /getting-started/
    - theme: alt
      text: The Evidence Loop
      link: /concepts/evidence-loop
---

## The problem

Every codebase has standards no static tool can check.

Take Scoop Society, a small API for rating ice-cream parlors — the example these docs build on throughout. Its `src/services/README.md` says every service validates its input before any work happens, returns domain failures as values rather than exceptions, and writes error messages *for the API consumer*: "rating must be a whole number from 1 to 5", never "invalid input".

A linter can verify none of that. It can check that a function named `run` exists; it cannot check that an error message would actually help the person who hit it. So the README stays aspirational, three contributors and two agents drift from it in different directions, and nothing says so. That is **conceptual drift** — and it compounds silently, in exactly the code your AI agents are now writing at volume.

The agents drift for a structural reason, not a careless one. A coding model is trained against checks that answer fast: the test passes, the types check, the benchmark counts the problem solved. Code quality has no fast check — the cost of a bad pattern shows up weeks later, long after anything a training run can score. So models get very good at solving the problem, and learn almost nothing about solving it well. The standards you hold beyond what a linter can check are invisible to the thing now writing much of your code.

## What Praxis does

Praxis asks the question nothing else in your pipeline asks: not *does it work*, but *does it match what you said correct looks like*.

**It enforces judgment standards.** A spec is a README that states what correct looks like for the files around it. `praxis eval run` has one or more LLM reviewers read each file against its spec and return a verdict — pass, warn, or fail — with specific critiques. Verdicts are cached by content hash: unchanged files are free, and editing a file (or its spec) re-reviews exactly what changed.

**It refuses the mechanical.** Reviewers are told the *judgment boundary*: anything a linter, regex, or type check could decide is out of scope, even when the spec states it. If you can write the check, write the check. Praxis holds the standards you can only describe.

**It keeps the evidence.** Every run appends to a committed ledger — what ran, against which commit, what it cost, and one critique record per finding with full provenance. The cache answers "is this compliant now"; the ledger answers "what has ever happened".

**It grows a taxonomy.** Recurring critiques triage into **axioms** — named, human-accepted categories of recurring critique with stable ids. Once active, an axiom names the issue: triage labels every recurring critique under it, so the same issue carries the same id and the same words everywhere, `praxis axioms show AX-b951db` shows it with its labeled critiques as live examples, and `praxis eval report` can finally chart it — as a rate with a denominator, per reviewer, never pooled.

**And, for teams authoring agent knowledge, it compiles.** Expert documents assemble into self-contained SME agent profiles, and a compiled profile can itself be the spec its subject matter is reviewed against. The spec layer is optional; the eval loop stands on its own.

## Who it's for

You, first — the developer who wrote the README and watched it stop being true. Point `sources` at the directories your specs live in and run `praxis eval run` before you push.

Your team, second: the cache and the ledger are committed, so a verdict paid for on one machine is a cache hit on every other, and the evidence of who found what, when, accumulates in git like everything else.

Your agents, third: an agent given a target it can check does far better work than one told to "follow the conventions," and `praxis eval run <file>` is that target for the standards a linter can't hold. Findings arrive as the reviewer's own words against the spec, and once triage labels them, reports and `praxis axioms show` cite stable axiom ids an agent can look up; `--json` surfaces are stable contracts, and `praxis status --json` is a one-call situational poll. The compiled skill and slash command (via the Claude Code plugin) teach an agent the whole workflow.

## How to read the docs

- **[Quick Start](/getting-started/)** stands up Scoop Society's service standards end to end: spec → review → findings → fix → evidence.
- **[Concepts](/concepts/evidence-loop)** explains the evidence loop, review scoping, the knowledge model, and agent profiles.
- **[Commands](/commands/init)** is the full CLI reference.
- **[Evaluation](/validation/writing-specs)** covers writing specs that survive the judgment boundary, caching, and CI.
- **[Plugins](/plugins/overview)** covers platform output (Claude Code today).
- **[Design](/design/decisions)** explains the reasoning behind the key choices.
- **[CHANGELOG](https://github.com/zarpay/praxis-cli/blob/main/CHANGELOG.md)** lists what changed in each release.
