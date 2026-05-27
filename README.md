# Praxis

Praxis is a CLI tool that organizes team knowledge — roles, responsibilities, context, and reference — into compiled agent profiles that any LLM platform can consume. Write structured markdown, declare dependencies in frontmatter, run `praxis compile`, get a single self-contained file ready to load into any agent.

It also includes AI-powered validation: every directory's `README.md` doubles as a spec, and `praxis validate` checks your documents against it using an LLM — with content-hash caching so unchanged documents are never re-validated.

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
