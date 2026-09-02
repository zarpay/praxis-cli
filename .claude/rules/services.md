---
description: What belongs in a domain's services/ directory
paths:
  - cli/src/domains/*/services/**
---

# Services

**A service is a service object.** One action, named
`{verb}-{noun}-service.ts` after what it does to what it acts on:
`expand-globs-service.ts`, `audit-experts-service.ts`,
`request-verdict-service.ts`. The noun is usually a model or a domain concept.

- **One file, one `export default function`.** A second export means a second
  service and a second file. Where a service does have a named export, it is the
  filename in camelCase — the same rule commands and orchestrators follow.
- One input payload in, one result out. Both are named types declared in the
  domain's `types.ts` — never an inline object literal in the signature, which is
  what lets a payload drift from the type it was supposed to match.
- It returns its work, **including problems**: warnings come back in the result.
  A service never logs, never prints, and takes no logger.
- No workflow. A service that calls two other services in sequence to produce an
  outcome is an orchestrator — a controller's job, not a service object's.

The only classes under `services/` are the sanctioned exceptions: the
extension-point contracts in `providers/` and `plugins/`. **Those keep their bare
names** — `openrouter.ts`, `claude-code.ts` — because they are not services: they
are implementations of a documented interface, and their directory already says
so. Everything else here takes the suffix.
