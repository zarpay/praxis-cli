# Praxis

Every codebase has patterns that can't be caught by a syntax checker — service objects with architectural conventions, decision records with agreed-upon formats, agent definitions with structural requirements. Nobody enforces them. They drift. Praxis fixes that.

Praxis is a **conceptual linter and knowledge compiler**. Write a README spec for any directory that defines what valid documents look like, then run `praxis eval run` to enforce it — for any type of file, in CI, with AI. When those documents are knowledge files, `praxis compile` assembles them into agent profiles: self-contained subject matter experts of their source material, deployable to any LLM platform.

**→ Full documentation at [zarpay.github.io/praxis-cli](https://zarpay.github.io/praxis-cli/)**

## Install

```bash
npm install -g @zarpay/praxis-cli
```

Requires Node.js 18+.

## Quick start

```bash
# In any repo: claim it, point sources at your specs, add a reviewer
praxis init
# edit .praxis/config.json — sources + reviewers

# The eval loop: review everything a spec governs, cached by content
praxis eval run
praxis eval run src/services/checkout.ts   # the fast loop
praxis eval run --diff                     # what did this branch introduce?

# The spec layer (optional): author experts, compile SME agents
praxis init --spec-layer
praxis add expert code-reviewer
praxis compile
# → agent-profiles/code-reviewer.md
```

## License

MIT
