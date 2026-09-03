---
description: What belongs in src/services — one action, one input, one output
paths:
  - cli/src/services/**
---

# Services

**A service is a service object.** One action, named
`{verb}-{noun}-service.ts` after what it does to what it acts on:
`expand-globs-service.ts`, `audit-experts-service.ts`,
`request-verdict-service.ts`. The noun is usually a model or a product concept.

- **One file, one `export default function`.** A second export means a second
  service and a second file. Where a service does have a named export, it is the
  filename in camelCase — the same rule commands and orchestrators follow.
- **Importers bind the default to the filename in camelCase, suffix included** —
  `import reviewProjectService from "@/services/review-project-service.js"`,
  never `reviewProject`. The suffix is what lets a reader of an orchestrator or
  another service tell a service call from an in-file helper at the call site,
  the same way `…Orchestrator` and `…View` bindings already do.
- One input payload in, one result out. Both are named types declared in the
  `src/types.ts` — never an inline object literal in the signature, which is
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
- **Services act on models, never the reverse.** A model may not import a
  service (ESLint-enforced), so an algorithm only a model needs is not a
  service — it lives module-private beside the class. `hash-reviewer-service.ts`
  and `resolve-assist-inputs-service.ts` sat here until the rule; they are
  private functions in `reviewer.ts` and `review-subject.ts` now.
- **A store's lifecycle event is not a service.** Listing, minting for,
  appending to, or moving files within one store belongs to that store's
  handle model (`VerdictCache`, `Ledger`, `AxiomStore`) — nine such services
  were folded into `Ledger` and `AxiomStore` on 2026-09-03. The service test:
  does it coordinate more than one store, call something external (a model
  provider, git), assemble records from caller inputs, or carry caller-context
  policy? Then it is a service. Is its whole body one verb against one store's
  own contents? Then it is a method wearing a service's filename.
- **A second caller is not a reason to keep it.** `assistHashInput` and
  `contentHash` looked shared, but the second caller was rebuilding by hand what
  the model already did; once it went through `ReviewSubject`, both had one
  caller and belonged to it. Ask what the caller _should_ be doing before
  concluding a coercion is shared.
- **A predicate over a filename is not a service either.** `isTarget` was three
  lines of name math with no payload and no result type; it is `isContentFile`
  in `helpers/files-helper.ts` now.
- **A helper with one caller stays inside it.** `selectDomains`, `summarize` and
  `worstVerdict` are module-private functions in the service that uses them, not
  files of their own. If you cannot name it `{verb}-{noun}-service.ts` without
  inventing a verb, that is the signal it is a helper rather than a service.

Everything under `services/` is a service and takes the suffix — there are no
exemptions, because the things that were not services have moved out.
Extension-point implementations live in `src/providers/` and `src/plugins/`
directories instead; a service that _selects_ one (`resolve-provider-service.ts`,
`resolve-plugins-service.ts`) is still a service and stays here.
