# prompts/ — the reviewer identity surface

Every string sent to a model, one file each. **Rewording anything here
changes reviewer behavior and therefore reviewer identity**:
`prompt-surface.ts` renders the complete reviewer-facing surface into
the behavioral hash, so a prompt edit rolls an epoch by design — never
casually. Curator prompts live here too (their own shapes, not hashed
into reviewer identity).

Rule: `.claude/rules/prompts.md`.
