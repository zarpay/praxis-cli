# The Compiler Pipeline

`praxis compile` reads role files, resolves every reference declared in their frontmatter, and assembles standalone agent profiles. This page explains exactly what happens.

## Input: a role file

The compiler starts with any `.md` file in the configured `rolesDir` that has a `type: role` frontmatter field (or that lives in the roles directory by convention).

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
  - responsibilities/enforce-standards.md
refs:
  - reference/architecture-decisions.md
---

# Code Reviewer

Reviews pull requests with an eye for correctness and alignment with team conventions.
```

Each frontmatter array is a list of paths or glob patterns, all relative to the project root.

## Resolution

The compiler resolves each list against the filesystem:

1. **Glob expansion** — patterns like `context/constitution/*.md` are expanded to all matching files.
2. **Alphabetical ordering** — expanded results are sorted so compilation is deterministic.
3. **Exclusions** — files named `README.md` or prefixed with `_` (templates) are skipped automatically.
4. **Missing file errors** — if a declared path matches nothing, the compiler exits with an error.

## Assembly

Resolved files are assembled in a fixed section order:

```
1. Role body          (the role file's own markdown body)
2. Responsibilities   (inlined from the responsibilities array)
3. Constitution       (inlined from the constitution array)
4. Context            (inlined from the context array)
5. Reference          (inlined from the refs array)
```

Each referenced file's frontmatter is stripped; only its markdown body is inlined under a section heading.

## Output: the agent profile

The assembled content is written to `{agentProfilesOutputDir}/{alias}.md`. With the example above:

```
agent-profiles/reviewer.md
```

The output file is plain markdown — no special syntax, no runtime dependency. It can be:
- Dropped into Claude Code as a project instruction
- Loaded as a system prompt via any LLM API
- Read by a human who wants to understand what the agent does

## Plugin output

After writing the pure profile, the compiler passes the same content to each enabled plugin. Plugins wrap or transform the profile for specific platforms.

The Claude Code plugin, for example, prepends YAML frontmatter with the agent's name, description, tools, and model — and writes a separate file to the plugin output directory.

See [Plugins](/plugins/overview) for details.

## Watch mode

```bash
praxis compile --watch
```

In watch mode, the compiler sets up a file watcher on every directory listed in `sources`. Any change to a `.md` file triggers a debounced recompile of all affected roles. Changes to shared context files (like constitution docs) recompile every role that includes them.

## Single role compilation

```bash
praxis compile --alias reviewer
```

Compiles only the role with `alias: reviewer`. Useful during authoring when you don't need to recompile every role on every save.

## See also

- [Knowledge Primitives](/concepts/knowledge-primitives)
- [Agent Profiles](/concepts/agent-profiles)
- [praxis compile](/commands/compile)
