# scaffold/ — what `praxis init` copies

`eval/` is the default: the minimal `.praxis/config.json` and nothing
else — your specs are your existing READMEs. `core/` is the opt-in
spec-layer authoring taxonomy (`--spec-layer`): experts, practices,
constitution, conventions, each directory carrying its own spec and
`_template.md`. Init never overwrites an existing file.

Ships in the npm package (resolved via `SCAFFOLD_DIR` one level above
`dist/`).
