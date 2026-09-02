---
description: What belongs in a domain's services/ directory
paths:
  - cli/src/*/services/**
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
- **No coercion of a single model.** A function whose whole job is deriving a
  value from one model's own fields is a method on that model, not a service
  here. `Reviewer.cacheIdentity()` and `ReviewSubject.assistProvenance()` were
  services until the model was the only thing that could sensibly call them. The
  test: if the body reads nothing but the model's fields, it belongs to the
  model.
- The line is the _input_, not the size. An algorithm a model happens to use —
  `hash-reviewer-service.ts` canonicalizes a config and folds in the prompt
  surface — is still a service, and the model delegates to it.
- **A second caller is not a reason to keep it.** `assistHashInput` and
  `contentHash` looked shared, but the second caller was rebuilding by hand what
  the model already did; once it went through `ReviewSubject`, both had one
  caller and belonged to it. Ask what the caller _should_ be doing before
  concluding a coercion is shared.
- **A predicate over a filename is not a service either.** `isTarget` was three
  lines of name math with no payload and no result type; it is `isContentFile`
  in `framework/files.ts` now.
- **A helper with one caller stays inside it.** `selectDomains`, `summarize` and
  `worstVerdict` are module-private functions in the service that uses them, not
  files of their own. If you cannot name it `{verb}-{noun}-service.ts` without
  inventing a verb, that is the signal it is a helper rather than a service.

Everything under `services/` is a service and takes the suffix — there are no
exemptions, because the things that were not services have moved out.
Extension-point implementations live in the domain's `providers/` and `plugins/`
directories instead; a service that _selects_ one (`resolve-provider-service.ts`,
`resolve-plugins-service.ts`) is still a service and stays here.
