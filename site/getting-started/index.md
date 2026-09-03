# Quick Start

This walkthrough builds the setup these docs use everywhere: **Scoop Society**, a small TypeScript API for rating ice-cream parlors. Its `src/services/` directory has conventions every service is supposed to follow. We'll make those conventions enforceable, review the code against them, fix a finding, and see the evidence land.

## The situation this solves

`src/services/README.md` says every service validates its input before doing any work, returns domain failures as values (never exceptions), and writes error messages for the API consumer — "rating must be a whole number from 1 to 5", not "invalid input".

Six months pass. Three developers and two coding agents contribute. The README still says the same thing; half the services quietly stopped doing it. Nothing caught it, because nothing *could*: these are judgment standards, and no linter reads for meaning.

## Install

```bash
npm install -g @zarpay/praxis-cli
```

Requires Node.js 18+.

## Initialize

From the repo root:

```bash
praxis init
```

This writes exactly one thing — `.praxis/config.json` — and claims the directory as a Praxis project. Your specs are your existing READMEs; nothing else is scaffolded. Point `sources` at the directories your code and specs live in, and configure at least one reviewer:

```json
{
  "sources": ["src"],
  "reviewers": [
    {
      "name": "flash",
      "model": "deepseek/deepseek-v4-flash-0731",
      "apiKeyEnvVar": "OPENROUTER_API_KEY"
    }
  ]
}
```

A **reviewer** is a named model configuration. Teams often run two — different models disagree in useful ways — and every configured reviewer reviews every target. Add a second one whenever you're ready; its verdicts are kept separate, never averaged.

## Write the spec

The spec is the README in the directory it governs — documentation and enforcement in one file, so they can't drift from each other. Scoop Society's `src/services/README.md`:

```markdown
---
paths:
  - "src/services/*.ts"
exemplars:
  - "src/services/create-review.ts"
excludes:
  - "src/services/legacy-import.ts"
---

# Service Conventions

Services are where Scoop Society's behavior lives. Every service
follows the same shape so the next reader — human or agent — already
knows how to read it.

- **Domain failures are values, never exceptions.** A service returns
  `{ ok: false, error }` for anything a caller could plausibly cause;
  `throw` is reserved for programmer error.
- **Error messages are written for the API consumer**: they name what
  was wrong and what would be accepted instead. "rating must be a
  whole number from 1 to 5" is acceptable; "invalid input" is not.
- **Input is validated before any work happens**, and validation reads
  top-to-bottom before the happy path begins.
- **Services do one thing.** If a service grows a second
  responsibility, it becomes a second service.
```

Two things to notice:

- **The frontmatter is scoping, not prose.** `paths:` targets the TypeScript files; `exemplars:` blesses `create-review.ts` as a positive example the reviewer sees (and never critiques); `excludes:` shields the legacy file entirely. Structural decisions live in frontmatter, where they are executed — never in the body, where a reviewer could fail to notice them.
- **Every standard requires reading comprehension.** There is no "the file must contain a function named `run`" here — a reviewer told the [judgment boundary](/validation/writing-specs#the-judgment-boundary) would refuse to check it anyway. Mechanical rules belong in your linter.

## Run the review

```bash
export OPENROUTER_API_KEY=your-key-here
praxis eval run
```

```
[1/4] create-review.ts
	✓ PASS
[2/4] rank-parlors.ts
	✓ PASS
[3/4] redeem-coupon.ts
	✗ FAIL
	· Error message 'bad input' tells the consumer nothing about what
	  was wrong or what would be accepted.
	· Work begins before the coupon code is validated.

==================================================
Summary — corpus conformance (includes pre-spec debt)
==================================================
Total documents: 4
[Compliant] 3
[Errors] 1
```

Each verdict is cached by a content hash covering everything the reviewer saw — the target, the spec, the exemplar. Run it again and it's four cache hits, zero API calls. Fix `redeem-coupon.ts` and only that file re-reviews:

```bash
praxis eval run src/services/redeem-coupon.ts
```

That single-target form is the **fast loop**: the command you (or your agent) run between edits.

## What just became permanent

Every run appended evidence to `.praxis/ledger/` — a run record (commit, branch, cost, verdict counts) and one critique record per finding, committed to git alongside the cache. You never manage these files; you spend them:

```bash
praxis              # orientation: last run, pending triage, debt at a glance
praxis eval report  # rates, costs, and epochs computed over the ledger
```

## Where it goes from here

Run reviews for a week and the same critiques start repeating — "error message tells the consumer nothing" shows up across five services. That's when you run:

```bash
praxis axioms triage
```

A **curator** model clusters the pending critiques and drafts a proposal; you accept; `praxis axioms ratify` traces it to the spec and activates it. From then on the standard has a name — `AX-b951db` — every reviewer checks it explicitly, findings cite it, and `praxis axioms show AX-b951db` teaches it with a violating and a compliant example. Standards stop being folklore. See [the evidence loop](/concepts/evidence-loop).

## Optional: the spec layer

Scoop Society also authors its knowledge — experts like a *service steward* and *test steward* — under `knowledge/`. Scaffold that taxonomy with `praxis init --spec-layer`, then:

```bash
praxis compile
```

Each expert compiles into a self-contained SME agent profile, and a compiled profile can itself be the spec its subject matter is reviewed against — the agent you dispatch and the standard you enforce, one file. See [Knowledge Primitives](/concepts/knowledge-primitives) and [Agent Profiles](/concepts/agent-profiles).

## Next steps

- [Writing Specs](/validation/writing-specs) — standards that survive the judgment boundary
- [The Evidence Loop](/concepts/evidence-loop) — critiques, axioms, the ledger, and reports
- [CI Integration](/validation/ci) — block merges that violate the standard
- [praxis eval](/commands/eval) — the full command reference
