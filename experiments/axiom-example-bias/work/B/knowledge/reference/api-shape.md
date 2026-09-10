---
type: reference
---

# API Shape Reference

The JSON API surface services ultimately serve:

| Route | Returns |
| --- | --- |
| `GET /parlors` | `Parlor[]` |
| `GET /parlors/:id/reviews` | `Review[]` |
| `POST /parlors/:id/reviews` | `Review` (201) or `{ error }` (422) |
| `GET /rankings` | `RankedParlor[]` |

Domain failures surface as `{ error: string }` with a 4xx status; the
`error` string is shown to API consumers verbatim, which is why service
error messages must name what was wrong and what would be accepted.
