---
id: AX-be1f03
version: 1
status: active
mode: judgment
scope: file
severity: warning
grounded_in: knowledge/experts/experts.sme.md#required-frontmatter
introduced: 2026-09-03
---

An expert's description tells an operator when to invoke it — the situations
and triggers that call for this expert — rather than restating what the expert
is. Two experts whose descriptions could be swapped without anyone noticing
are indistinguishable at selection time.

## Violating example

description: "The subject-matter expert for Scoop Society services."

## Compliant example

description: "Use this agent to review Scoop Society services for convention
adherence, or for advice on shaping a new one. Invoke it whenever files under
src/services/ are added or changed."
