---
description: What belongs in a domain's services/ directory
paths:
  - cli/src/domains/*/services/**
---

# Services

A service is **one action**, named `{verb}-{noun}` after what it does to what it
acts on: `expand-globs.ts`, `audit-experts.ts`, `judge-target.ts`,
`count-documents-by-type.ts`. The noun is usually a model or a domain concept.

- **One file, one `export default function`.** A second export means a second
  service and a second file.
- One input payload in, one result out. Both are named types declared in the
  domain's `types.ts` — never an inline object literal in the signature, which is
  what lets a payload drift from the type it was supposed to match.
- It returns its work, **including problems**: warnings come back in the result.
  A service never logs, never prints, and takes no logger.
- No workflow. A service that calls two other services in sequence to produce an
  outcome is an orchestrator.

The only classes under `services/` are the sanctioned exceptions:
`verdict-cache.ts` (a repository over the verdict store) and the extension-point
contracts in `providers/` and `plugins/`.
