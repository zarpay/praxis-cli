# helpers/ — plain modules below every layer

Reusable by anything, importing no working layer. `files-helper` and
`paths-helper` are the only modules allowed to touch `node:fs` /
`node:path`; `errors-helper` owns every error praxis raises;
`git-helper` is the complete read-only git surface (spec 12-a);
`metrics-helper` is 07's rate discipline.

Rule: `.claude/rules/helpers.md`.
