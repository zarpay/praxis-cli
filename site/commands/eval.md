# praxis eval

AI-powered evaluation: judges targets against their specs.

::: info Deprecated aliases
`praxis validate document|all|ci|report` still work as deprecated aliases for `eval run`, `eval ci`, and `eval verdict`. New usage belongs on `eval`.
:::

## Prerequisites

Validation uses the OpenRouter API. Set the environment variable named in your config:

```bash
export OPENROUTER_API_KEY=your-key-here
```

The variable name is configurable via `validation.apiKeyEnvVar` in `.praxis/config.json`.

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
| `--verbose` | Show full AI reasoning for each document |
| `--no-cache` | Skip the cache for all documents |
| `--fail-fast` | Stop at the first error instead of continuing |

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

1. The spec file (default: `README.md`) in the document's directory defines the validation criteria.
2. Praxis sends the spec content and the document content to an LLM via OpenRouter.
3. The LLM returns Yes / Maybe / No with specific issues.
4. The result is written to the cache at `.praxis/cache/validation/`.

On subsequent runs, cached results are used for any document whose content (and spec content) has not changed.

## See also

- [Writing Specs](/validation/writing-specs)
- [Caching](/validation/caching)
- [CI Integration](/validation/ci)
- [Validation Domains](/concepts/validation-domains)
