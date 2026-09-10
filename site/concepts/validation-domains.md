# Review Domains

A review domain is a directory (or set of files) governed by a single spec. The spec is the standard; the domain is the scope it applies to.

## The rule

Any directory within your configured `sources` that contains a spec file (default: `README.md`) becomes a review domain. Every sibling `.md` file — excluding the spec itself and `_`-prefixed templates — is reviewed against that spec. With `paths:` frontmatter, the domain instead becomes the matched files, of any extension, anywhere in the project:

```
src/services/
├── README.md            ← the standard (paths: "src/services/*.ts")
├── create-review.ts     ← reviewed
├── rank-parlors.ts      ← reviewed
├── redeem-coupon.ts     ← reviewed
└── legacy-import.ts     ← excluded by the spec's excludes:
```

The same pattern works for any organized body of files — `decisions/`, `api/specs/`, `knowledge/experts/`. Any directory whose README says what correct looks like can be a domain.

## The spec file

The spec defines what the reviewers check — judgment standards, written in clear human language (see [Writing Specs](/validation/writing-specs), especially the judgment boundary: mechanical criteria are refused by design). When `praxis eval run` runs, every configured reviewer reads the spec and each governed file, and answers through a required tool call — pass, warn, or fail — with specific critiques as raw reviewer prose, labeled under active axioms afterwards at triage.

## Configurable spec file name

By default the spec file is `README.md`. Change it globally with the top-level `specFilePattern` key:

```json
{ "specFilePattern": "SPEC.md" }
```

Globs are supported, including alternation — a pattern like this accepts both hand-written READMEs and [compiled expert profiles](/concepts/agent-profiles#profiles-as-spec-files) as specs:

```json
{ "specFilePattern": "{README.md,*.expert.md}" }
```

(Scoop Society's own pattern is `"{README.md,*.sme.md}"` — the `*.sme.md` half matches its hand-authored `experts.sme.md` spec, not compiled output.)

## Cross-directory domains

A spec's `paths:` globs are resolved against the project root, so one standard can govern files far from where the spec lives — a technical-writing spec covering both `docs/` and `runbooks/`, an events spec in `docs/` governing `src/events/`. See [Cross-Directory Review](/validation/cross-directory).

## Cohorts

`cohort: by_directory` makes each matched directory one review unit — every member file reviewed together, one verdict, for relational standards ("no orphaned files", "one entry point per feature") that no single file can answer.

## How multiple specs interact

A file can be governed by more than one spec — a local README plus a cross-directory spec whose `paths:` matches it. Each (file, spec) pair is reviewed and cached independently, and both verdicts appear in the run.

## What is never a target

Spec files themselves, `_`-prefixed templates, files matched by the config's `ignore` patterns, and anything in a spec's `excludes:`.

## See also

- [Writing Specs](/validation/writing-specs)
- [Cross-Directory Review](/validation/cross-directory)
- [Caching](/validation/caching)
- [praxis eval](/commands/eval)
