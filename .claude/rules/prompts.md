---
description: What belongs in a domain's prompts/ directory
paths:
  - cli/src/*/prompts/**
---

# Prompts

**A prompt is text sent to a model**, not text written to disk. A document Praxis
installs into a user's project is a template (`src/templates/`), however
agent-facing its prose — that is the distinction `praxis-skill.ts` sitting in
`spec/prompts/` used to blur.

One LLM- or agent-facing prompt per file, as that file's default-export
function, with typed parameters when it templates. No prompt text lives anywhere
else. Reviewer prompts belong to `eval`; Claude Code plugin templates belong to
`spec`.

**Rewording any reviewer-facing prompt changes the reviewer's identity.**
`prompt-surface.ts` renders the complete surface — system prompt, tool
definitions, every question variant — into the reviewer hash, so an edit here
invalidates every cached verdict under the old hash and writes new ones. That is
by design (05: no version constant to forget bumping), but it means prompt edits
are epoch changes, not copy tweaks. Moving these files is safe; the hash covers
rendered text, not paths.
