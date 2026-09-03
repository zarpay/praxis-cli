---
id: AX-b951db
version: 2
status: active
mode: judgment
scope: file
severity: error
grounded_in: src/services/README.md#behavior
introduced: 2026-09-02
---

Error messages must be specific and actionable for the API consumer, clearly communicating what would be accepted instead of vague rejections. A bare label like "invalid" or "error" is never a message.

## Violating example

return { ok: false, error: { message: 'bad subject' } };

## Compliant example

return { ok: false, error: { message: 'subject must be a non-empty string' } };
