# models/ — the data and its helpers

Validate on construction — a model that exists is a valid document.
Construction from loaded input is `from<Source>` (`fromContent`,
`fromConfig`, `fromJson`); the stored byte form is `serialize()`. No
filesystem beyond `ReviewSubject.resolve`, the one sanctioned reader;
a model's file IO lives in its store. Models never import stores or
services.

Rule: `.claude/rules/models.md`. Exemplars: `axiom-file.ts`,
`praxis-config.ts` (the `cfg` every service takes).
