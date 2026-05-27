# Praxis

Every codebase has patterns that can't be caught by a syntax checker — service objects with architectural conventions, decision records with agreed-upon formats, agent role definitions with structural requirements. Nobody enforces them. They drift. Praxis fixes that.

Praxis is a **conceptual linter and knowledge compiler**. Write a README spec for any directory that defines what valid documents look like, then run `praxis validate` to enforce it — for any type of file, in CI, with AI. When those documents are knowledge files, `praxis compile` assembles them into agent profiles: self-contained subject matter experts of their source material, deployable to any LLM platform.

**→ Full documentation at [zarpay.github.io/praxis-cli](https://zarpay.github.io/praxis-cli/)**

## Install

```bash
npm install -g @zarpay/praxis-cli
```

Requires Node.js 18+.

## Quick start

```bash
praxis init my-org
cd my-org
praxis add role code-reviewer
# edit roles/code-reviewer.md
praxis compile
# → agent-profiles/code-reviewer.md
```

## License

MIT
