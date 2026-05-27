# Quick Start

This page gets a Praxis project running and produces your first compiled agent profile.

## Install

```bash
npm install -g @zarpay/praxis-cli
```

Requires Node.js 18+.

## Scaffold a project

```bash
praxis init my-org
cd my-org
```

This creates the full directory structure with two built-in roles (Praxis Steward and Praxis Recruiter) and starter content. The `.praxis/` directory is the project root marker — Praxis walks up from any working directory until it finds one.

```
my-org/
├── .praxis/
│   └── config.json
├── context/
│   ├── constitution/
│   ├── conventions/
│   └── lenses/
├── roles/
├── responsibilities/
├── reference/
├── agent-profiles/     ← compiled output goes here
└── plugins/            ← plugin output goes here
```

## Add a role

```bash
praxis add role code-reviewer
```

This creates `roles/code-reviewer.md` from a template with placeholders pre-filled. Open it and fill in the frontmatter:

```yaml
---
title: Code Reviewer
type: role
alias: reviewer
description: "Reviews pull requests against team conventions and coding standards."

constitution:
  - context/constitution/*.md
context:
  - context/conventions/code-style.md
responsibilities:
  - responsibilities/review-pull-requests.md
refs:
  - reference/architecture-decisions.md
---

# Code Reviewer

Reviews pull requests with an eye for correctness, readability, and alignment with team conventions.

## Scope

### Responsible For
- Reviewing all pull requests before merge
- Flagging violations of the agreed coding standards
- Suggesting improvements without blocking on style preferences

### Not Responsible For
- Making final merge decisions on security-sensitive changes
- Approving infrastructure changes
```

## Add a responsibility

```bash
praxis add responsibility review-pull-requests
```

Edit `responsibilities/review-pull-requests.md`:

```markdown
---
title: Review Pull Requests
type: responsibility
---

# Review Pull Requests

Check each pull request for correctness, test coverage, and adherence to team conventions before approval.

## Inputs

- Pull request diff and description
- Linked issue or ticket

## Outputs

- Approval or request for changes
- Inline comments on specific lines

## Criteria

- All tests pass
- No obvious regressions introduced
- Code follows the conventions in `context/conventions/code-style.md`
```

## Compile

```bash
praxis compile
```

Output:

```
Compiling reviewer...
  ✓ agent-profiles/reviewer.md
Done. 1 role compiled.
```

The compiled file at `agent-profiles/reviewer.md` contains:
- The role body
- The `review-pull-requests` responsibility inlined
- The company constitution inlined
- The code-style convention inlined
- The architecture reference inlined

One self-contained file, ready to load into any agent or paste into a system prompt.

## Watch for changes

```bash
praxis compile --watch
```

Praxis watches all configured source directories and recompiles automatically when any file changes.

## Check project health

```bash
praxis status
```

Shows document counts, missing descriptions, dangling references, and validation coverage without requiring an API key.

## Validate documents

If you have an [OpenRouter](https://openrouter.ai) API key, validation checks every document against its directory's README spec using an LLM:

```bash
export OPENROUTER_API_KEY=your-key-here
praxis validate all
```

Results are cached by content hash — unchanged documents aren't re-validated on subsequent runs.

## Next steps

- Read [Knowledge Primitives](/concepts/knowledge-primitives) to understand the full model
- Read [The Compiler Pipeline](/concepts/compiler-pipeline) to understand what `praxis compile` does
- Read [Claude Code Plugin](/plugins/claude-code) to generate Claude Code agent files
- Read [Validation](/validation/writing-specs) to make your READMEs into enforceable specs
