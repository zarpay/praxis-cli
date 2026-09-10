# plugins/ — CompilerPlugin implementations

Output plugins named for their platform (`claude-code.ts`): each takes
a compiled profile plus metadata and writes its own artifact tree. The
Claude Code plugin also emits the agent-facing surface — the
`/praxis-resolve` command and the praxis skill.

Rule: `.claude/rules/extension-points.md`.
