# Quick Start

## The situation this solves

Your team codifies its service object conventions in `app/services/README.md`. It says every service must have a single public `#call` method, return a `Result` type, and include a header comment explaining its purpose.

Six months pass. Three developers contribute. The README still says the same thing, but half the service objects have grown extra public methods, dropped the `Result` type, or skipped the comment entirely. Nothing caught it.

That's conceptual drift — and Praxis is the tool for it.

Praxis does two things: it **lints concepts** (checks that documents in any directory meet the standards defined in that directory's README spec) and it **compiles knowledge** (assembles knowledge documents into agent profiles — SMEs of their source material). This quick start covers both.

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

This creates a full directory structure with two built-in roles and starter content. The `.praxis/` directory is the project root marker.

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

This creates `roles/code-reviewer.md` from a template. Open it and fill in the frontmatter — the manifest that tells the compiler what to include:

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

Reviews pull requests with an eye for correctness and alignment with team conventions.

## Scope

### Responsible For
- Reviewing all pull requests before merge
- Flagging violations of the agreed coding standards

### Not Responsible For
- Making final merge decisions on security-sensitive changes
```

## Compile

```bash
praxis compile
```

The compiled file at `agent-profiles/reviewer.md` contains the role body, every referenced file inlined, and the full constitution — one self-contained document. That's the SME. Change the conventions file, recompile, and this agent picks up the update automatically.

## Add a README spec and lint it

Open `roles/README.md`. It already exists from `praxis init`. Tighten the spec to be explicit about what every role document must contain:

```markdown
# Roles

## Required frontmatter

- `title` — display name of the role
- `type` — must be "role"
- `alias` — short identifier used for the compiled filename
- `description` — one-sentence summary

## Required sections

Every role must have `## Scope` with both:
- `### Responsible For`
- `### Not Responsible For`
```

Now validate:

```bash
export OPENROUTER_API_KEY=your-key-here
praxis validate all
```

```
[PASS] roles/code-reviewer.md
[PASS] roles/praxis-steward.md

Summary: 2 compliant, 0 warnings, 0 errors
```

That README spec is your lint rule. Any future role that skips the required structure will get a WARN or FAIL — in local runs and in CI. The same mechanism works for any directory: `app/services/`, `decisions/`, `api/specs/` — anything with a README that says what valid looks like.

## Check project health

```bash
praxis status
```

Shows document counts, validation coverage, missing descriptions, dangling references — without requiring an API key.

## Next steps

- Read [Conceptual Linting as a Practice](/design/decisions#conceptual-linting-as-a-practice) to understand why this exists
- Read [Writing Specs](/validation/writing-specs) to write effective lint rules
- Read [The Compiler Pipeline](/concepts/compiler-pipeline) to understand what `praxis compile` does
- Read [Claude Code Plugin](/plugins/claude-code) to generate Claude Code agent files
