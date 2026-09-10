---
id: AX-a108ea
version: 1
status: active
mode: judgment
scope: file
severity: warning
derived_from: src/services/README.md#behavior
introduced: 2026-09-02
---

Configuration data and domain constants that could vary or be maintained separately must be isolated in a single obvious place or injected via the Store, not hardcoded throughout the service. This prevents silent coupling and drift between code and data.
