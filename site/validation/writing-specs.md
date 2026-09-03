# Writing Specs

## The README as the standard

Every directory with organized files has implicit standards. The question is whether anything enforces them.

A Praxis spec makes those standards explicit. The README in any directory is the standard for that directory — it states what correct looks like, and `praxis eval run` has LLM reviewers check every governed file against it. Write it in clear human language: the reviewer reads it as instructions, and your teammates read it as documentation. One file, so the two can never drift apart.

## The judgment boundary

The single most important thing about writing a v2 spec: **reviewers refuse mechanical criteria**. Every reviewer is told that anything a linter, regex, or type check could decide — a required key being present, a naming pattern, file placement — is out of scope and must not be reported, *even where the spec states it*.

This is deliberate. Mechanical checks belong in tools that are fast, free, and deterministic; sending them to an LLM buys you nondeterminism at a price. Praxis holds the standards you can only describe:

| Write a lint rule for              | Write a spec standard for                                    |
| ---------------------------------- | ------------------------------------------------------------ |
| "exports a function named `run`"   | "does one thing; a second responsibility is a second service" |
| "has a `description` field"        | "the description says when to reach for this, not just what it is" |
| "error class extends `AppError`"   | "error messages name what was wrong and what would be accepted instead" |
| "file is under 300 lines"          | "validation reads top-to-bottom before the happy path begins" |

The litmus: *if you can write the check, write the check; if you can only describe the standard, write the spec.*

## The running example

Scoop Society's `src/services/README.md`, in full:

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

Services are where Scoop Society's behavior lives. Every file in this
directory is one service, and every service follows the same shape so
the next reader — human or agent — already knows how to read it.

## Behavior

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
- **No I/O except through the injected Store.** Time and randomness
  enter as inputs or are isolated in a single obvious place.
```

Every bullet requires reading comprehension to decide — which is exactly what makes each one a candidate to become a ratified [axiom](/concepts/evidence-loop) once reviewers start flagging it.

## Severity: must vs. should

Reviewers respect the distinction between binding and advisory language:

- **"must", "never", "always"** — violations come back as **FAIL** (error severity).
- **"should", "prefer", "recommended"** — violations come back as **WARN**.

By default errors fail a run and warnings don't; `eval ci --strict` makes warnings blocking too.

## What makes a good spec

- **State the why alongside the what.** "Error messages are written for the API consumer" gives the reviewer the reading frame; a bare rule invites literalism.
- **Show the boundary case.** "rating must be a whole number from 1 to 5' is acceptable; 'invalid input' is not" is one sentence and does more calibration than a paragraph.
- **State what's explicitly not allowed.** Negative constraints are flagged as reliably as missing qualities.
- **Don't restate what your linter already enforces.** The reviewer will (correctly) ignore it, and it dilutes the spec for human readers.

## Scoping frontmatter

A spec's frontmatter shapes exactly what the reviewer sees. These are structural decisions, executed before any evaluation — never prose instructions the reviewer has to notice and obey:

```yaml
---
paths:
  - "src/services/*.ts"
excludes:
  - "src/services/legacy-import.ts"
exemplars:
  - "src/services/create-review.ts"
context:
  - "src/domain/types.ts"
---
```

**`paths:`** — glob patterns, resolved against the project root, naming the files this spec governs (any extension, any directory — see [Cross-Directory Review](/validation/cross-directory)). Without it, the spec governs its own directory's sibling `.md` files.

**`excludes:`** — files structurally out of scope. An excluded file never becomes a review unit and is never seen by the reviewer. Prefer this over writing "except for X" in the body: an exclusion in prose is an instruction a reviewer can fail to apply; an exclusion in frontmatter is a file it never receives.

**`exemplars:`** — spec-blessed positive examples. Exemplar files are shielded from adverse review (they receive no verdicts) and are inlined into the prompt as labeled references for what compliance looks like. The single highest-leverage line in a spec: one real compliant file calibrates a reviewer better than any amount of description.

**`context:`** — assist-only material. Context files are inlined so the reviewer sees what the standard is *about* (the domain types a service consumes, the store it calls) but are never evaluated themselves.

**`cohort: by_directory`** — reviews whole directories as single units, for relational standards no single file can answer. See [Cross-Directory Review](/validation/cross-directory).

Because exemplars and context are part of what the reviewer sees, they join the cached verdict's content hash: editing one invalidates the affected verdicts exactly like editing the target or the spec does.

`excludes:`, `exemplars:`, and `cohort:` also compile through from an expert's `validates:` targeting, the same way `paths:` does.

## Spec file location

By default the spec file is `README.md` in the directory it governs. The top-level `specFilePattern` config key changes that — a literal filename (`"SPEC.md"`) or a glob (`"*.sme.md"`, or Scoop Society's `"{README.md,*.sme.md}"`, which accepts both hand-authored READMEs and compiled profiles).

## Compiled profiles as specs

A spec doesn't have to be hand-authored. A compiled agent profile — assembled from your source knowledge — can itself be the spec file: add `validates:` globs to an expert's frontmatter and the compiled output carries the `paths:` block that makes it a spec. The agent you dispatch and the standard you enforce are the same document. See [Agent Profiles — Profiles as spec files](/concepts/agent-profiles#profiles-as-spec-files).

## See also

- [The Evidence Loop](/concepts/evidence-loop)
- [Review Domains](/concepts/validation-domains)
- [Cross-Directory Review](/validation/cross-directory)
- [praxis eval](/commands/eval)
