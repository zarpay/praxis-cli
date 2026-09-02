---
description: What belongs in src/templates — the body of every file Praxis writes
paths:
  - cli/src/templates/**
---

# Templates

**A template is one emitted document's body, as a typed function.** Every file
Praxis writes from text it owns — the expert and practice documents `praxis add`
creates, the skill and command documents the Claude Code plugin installs — has its
body here and nowhere else.

- **Named `{noun}-template.ts`**, default-exporting the filename in camelCase:
  `expert-file-template.ts` exports `expertFileTemplate`. Its parameter type lives
  in `src/types.ts`, because `templates/` is a leaf that imports nothing else.
- **The parameters are exactly what the CLI substitutes, and no more.** The expert
  template has eleven `{token}`s and two parameters: `{expert_name}` and
  `{required_alias}` are filled by `praxis add`, while `{manager_email}`,
  `{LIST USECASES}` and `practices/{verb}-{noun}.md` are guidance the author
  replaces by hand. Guidance stays literal text — a template literal only
  interpolates `${...}`, so it needs no escaping.
- **The body is the whole file**, frontmatter included, starting at `---`. A
  caller writes what it returns; it never post-processes the result.
- **No I/O, no path building, no regex substitution.** These are what the
  directory exists to delete: a template used to be a file located by
  `joinPath(scaffoldDir, "core", type === "expert" ? "experts" : "practices",
"_template.md")`, read at runtime and filled by regex, so a dropped placeholder
  could only be caught by a test. Now it is a function call the compiler checks.
- **One source per emitted file.** If `scaffold/` also ships the file, one of the
  two is wrong — that is how the plugin's `SKILL.md` drifted a major version
  behind while `init` shipped the stale copy and `compile` overwrote it.

`scaffold/` keeps only content Praxis does not generate: the starter taxonomy
`praxis init` copies, byte for byte. There is no runtime substitution left —
the last of it, `plugin.json`'s `{claudeCodePluginName}`, is
`plugin-manifest-template.ts` now, written by the Claude Code plugin on first
compile.
