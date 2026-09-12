# Praxis

Every codebase has standards no syntax checker can catch — service objects with architectural conventions, error messages written for the consumer, decision records with agreed-upon shapes. Nobody enforces them. They drift. And the coding agents writing more and more of the code can't hold them either: they were trained against tests that pass or fail, never against whether the code was good or followed your conventions. Praxis fixes that.

Praxis makes those standards enforceable. Write a README spec for any directory that defines what valid looks like, then run `praxis eval run` to enforce it — LLM reviewers read the spec the way a colleague would, verdicts are cached by content hash, and every run leaves append-only evidence in a committed ledger. Recurring critiques grow into **axioms** — named, stable categories your reports chart honestly: real denominators, per-reviewer series, pre-spec debt never blamed on the present. When your governed documents are knowledge files, `praxis compile` assembles them into agent profiles: self-contained subject matter experts, deployable to any LLM platform.

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
praxis eval run src/services/checkout.ts   # the fast loop, between edits
praxis eval report                         # rates, costs, epochs — from the ledger

# The axiom loop: recurring critiques become named categories
praxis axioms triage                       # the curator labels the backlog
praxis axioms curate                       # you accept what it clusters

# The spec layer (optional): author experts, compile SME agents
praxis init --spec-layer
praxis add expert code-reviewer
praxis compile
# → agent-profiles/code-reviewer.md
```

## License

MIT
