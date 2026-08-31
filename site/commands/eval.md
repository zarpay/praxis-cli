# praxis eval

AI-powered evaluation: judges targets against their specs.

## Prerequisites

Each judge runs through its configured provider — OpenRouter by default, or a custom provider module (see [Configuration — providers](/reference/config#providers)). Configure one or more judges in `.praxis/config.json` and set each judge's key variable:

```bash
export OPENROUTER_API_KEY=your-key-here
```

Each judge names its own variable via `apiKeyEnvVar` — see [Configuration — judges](/reference/config#judges). When multiple judges are configured, **every judge evaluates every target** and results are always reported per judge; `--judge <name>` runs just one.

## Subcommands

### `praxis eval run <targets...>`

Judges one or more targets against their specs.

```bash
praxis eval run experts/code-reviewer.md
praxis eval run experts/code-reviewer.md --spec custom-spec.md
praxis eval run experts/code-reviewer.md --verbose
praxis eval run experts/code-reviewer.md --no-cache
```

**Options:**

| Flag | Description |
| --- | --- |
| `--spec <path>` | Override the spec file used for validation |
| `--judge <name>` | Run only the named judge (default: all configured judges) |
| `--verbose` | Print the full AI reasoning after the result |
| `--no-cache` | Skip the cache and always call the API |

**Exit code:** 0 unless a target has errors (warnings pass).

---

### `praxis eval run` (no targets — full run)

Judges every spec-covered target across all configured sources.

```bash
praxis eval run
praxis eval run --type experts
praxis eval run --verbose
praxis eval run --no-cache
praxis eval run --fail-fast
```

**Options:**

| Flag | Description |
| --- | --- |
| `--type <type>` | Validate only documents matching this type |
| `--judge <name>` | Run only the named judge (default: all configured judges) |
| `--verbose` | Show full AI reasoning for each document |
| `--no-cache` | Skip the cache for all documents |
| `--fail-fast` | Stop at the first error instead of continuing |

With multiple judges configured, progress lines carry a `[judge: <name>]` tag and the summary adds a `By judge:` breakdown — one row per judge, never pooled.

**Output:**

```
[PASS] experts/code-reviewer.md
[WARN] practices/review-pull-requests.md
    - Missing "Inputs" section (recommended by spec)
[FAIL] reference/pricing.md
    - Frontmatter field "type" is missing (required)

==================================================
Summary
==================================================
Total documents: 12
[Compliant]     9
[Warnings]      2
[Errors]        1
```

**Exit code:** 0 if no errors, 1 if any errors (warnings do not fail).

---

### `praxis eval ci`

A full run with a structured summary, for pull request pipelines.

```bash
praxis eval ci
praxis eval ci --strict
```

**Options:**

| Flag | Description |
| --- | --- |
| `--strict` | Fail on warnings as well as errors |

**Exit code:** 0 if all pass (or no errors with `--strict` off), 1 otherwise.

---

### `praxis eval verdict <path>`

Displays a formatted report of a document's cached validation status. Does not call any API.

```bash
praxis eval verdict experts/code-reviewer.md
praxis eval verdict experts/code-reviewer.md --verbose
```

Shows one of five states:

| Status | Meaning |
| --- | --- |
| **PASS** | Document is compliant |
| **WARN** | Document has warnings but no hard errors |
| **FAIL** | Document has errors |
| **STALE** | Document changed since last validation (cached result may no longer apply) |
| **NOT VALIDATED** | No cached result exists yet |

Use `--verbose` to include the full AI reasoning from the cached result.

**Exit code:** Always 0 — this command is for inspection only.

---

## How validation works

1. The spec file (default: `README.md`) in the document's directory defines the validation criteria — plus any scoping frontmatter (`paths`, `cohort`, `excludes`, `exemplars`, `context`).
2. Praxis sends the spec, the target, and any exemplar/context files to each configured judge via its provider (OpenRouter by default).
3. The judge answers through a required tool call — pass, warn, or fail — with specific issues.
4. The verdict is written to the cache at `.praxis/cache/validation/`, keyed by spec and judge.

On subsequent runs, cached verdicts are used for any target whose judgment input (target, spec, exemplars, context) has not changed. See [Caching](/validation/caching).

## See also

- [Writing Specs](/validation/writing-specs)
- [Caching](/validation/caching)
- [CI Integration](/validation/ci)
- [Validation Domains](/concepts/validation-domains)
