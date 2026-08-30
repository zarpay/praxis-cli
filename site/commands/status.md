# praxis status

Shows a project health dashboard without requiring any API keys.

## Usage

```bash
praxis status
```

## What it reports

`praxis status` scans all configured `sources` directories and produces a summary of:

- **Document counts** — how many documents exist per type
- **Validation coverage** — pass / warn / fail / not-validated counts per type, read from the local cache
- **Issues** — structural problems detected without any LLM calls:
  - Dangling references (expert frontmatter points to a file that doesn't exist)
  - Orphaned practices (practice not claimed by any expert)
  - Missing `description` fields on experts
  - Missing `alias` fields on experts

## Example output

```
Praxis Project Status
=====================

Context
  constitution:   3 documents
  conventions:    4 documents
  lenses:         2 documents

Experts             5 documents
  [PASS]          3
  [WARN]          1
  [FAIL]          0
  [NOT VALIDATED] 1

Practices  8 documents
  [PASS]          6
  [WARN]          0
  [FAIL]          1
  [NOT VALIDATED] 1

Reference         3 documents
  [PASS]          3

Issues
------
  ⚠  experts/code-reviewer.md — missing description field
  ⚠  practices/handle-escalations.md — not claimed by any expert
  ✗  experts/support-agent.md — refs reference/pricing.md not found
```

## Exit code

`praxis status` exits with code 1 if any issues are found. This makes it suitable for CI:

```bash
praxis status || exit 1
```

## Validation coverage

Validation counts are read from the local cache (`.praxis/cache/validation/`) and do not require an API key or network access. A document shows as NOT VALIDATED if it has never been validated or if the cache entry for it is stale.

Run `praxis eval run` to populate or refresh the cache before running `praxis status` in CI if you want accurate validation counts.

## See also

- [praxis eval run](/commands/eval)
- [Caching](/validation/caching)
- [Configuration](/reference/config)
