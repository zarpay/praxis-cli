/** What `praxis add expert` supplies to the expert document template. */
interface ExpertTemplateVars {
  /** Display title, e.g. "Code Reviewer". */
  title: string;
  /** The alias the compiler keys the expert on — the name as typed. */
  alias: string;
}

/**
 * The document `praxis add expert <name>` writes.
 *
 * Two values come from the command — the display title and the alias the
 * compiler keys the expert on. The alias is the name as typed, because it
 * is an identifier rather than prose.
 *
 * Every other `{token}` below is guidance the author replaces by hand, so
 * it is literal text here rather than a parameter. The shape is the one
 * the scaffold's recruiter reviews for: a description that says when to
 * use the expert, `validates:` naming the files it reviews, and a body
 * that gives a point of view rather than a list of checks.
 */
export default function expertFileTemplate({ title, alias }: ExpertTemplateVars): string {
  return `---
title: "${title}"
type: expert
alias: "${alias}"

description: "Use this agent to {WHAT IT REVIEWS OR ANSWERS}. Use it when {A FILE UNDER some/path/ IS ADDED OR CHANGED, OR THE QUESTION SOMEONE ASKS}."

constitution:
  - context/constitution/*.md
context:
  - context/{relevant-context-file}.md

practices:
  - practices/{verb}-{noun}.md

refs:
  - reference/{relevant-reference}.md

validates:
  - "{glob of the files this expert reviews — delete this key for an expert people only consult}"
---

# ${title}

{Who this expert reads as, and what that reader cares about. Say what problem it solves and what it leaves to other experts. Keep it to one or two short paragraphs. Do not list checks here; they belong in the practices.}

{Why each context file above is loaded: what it changes about how this expert reads a file.}
`;
}
