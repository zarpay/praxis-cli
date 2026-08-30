---
title: Result Handling
type: convention
---

# Result Handling

Scoop Society treats domain failure as data. Every service returns
`Result<T>` — `{ ok: true, value }` or `{ ok: false, error }` — and
`throw` is reserved for programmer error (broken invariants, impossible
states). The HTTP layer maps `ok: false` to 422 without inspecting the
message, which is exactly why the message must stand on its own: it is
the only thing the API consumer sees.

Error messages name what was wrong **and what would be accepted
instead**. They are written for the person holding the malformed
request, not for the developer reading the source.
