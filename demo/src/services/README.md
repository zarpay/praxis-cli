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

## Structure

- A service module exports exactly one entry point: a function named
  `run`, taking its dependencies (always the `Store` first) and a
  single input object, returning a `Result<T>` from the domain types.
- The module name is verb-first kebab-case and says what the service
  does: `create-review.ts`, `rank-parlors.ts`.

## Behavior

- **Domain failures are values, never exceptions.** A service returns
  `{ ok: false, error }` for anything a caller could plausibly cause;
  `throw` is reserved for programmer error.
- **Error messages are written for the API consumer**: they must name
  what was wrong and what would be accepted instead. "rating must be a
  whole number from 1 to 5" is acceptable; "invalid input" is not.
- **Input is validated before any work happens**, and validation reads
  top-to-bottom before the happy path begins.
- **Services do one thing.** If a service grows a second
  responsibility, it becomes a second service.
- **No I/O except through the injected Store.** No timers, no fetch,
  no console. Time and randomness enter as inputs or are isolated in a
  single obvious place.

## Documentation

- Every service has a doc comment stating its purpose in one sentence
  and enumerating its domain failure modes, so a caller can handle
  every `error` without reading the body.
