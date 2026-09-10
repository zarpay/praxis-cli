# Expert Document Conventions

Documents in this directory define Scoop Society's SME experts. This
spec is named `experts.sme.md` (not `README.md`) to exercise the glob
`specFilePattern`; it validates its sibling documents.

## Required frontmatter

- `title` (string) — display name of the expert
- `type` (string) — must be `"expert"`
- `alias` (string) — the short name the expert compiles under
- `description` (string) — when to invoke the expert, one sentence or two

## Required content

- The body opens with a level-1 heading naming the expert and its alias
- The body states, in prose, what the expert is the subject-matter
  expert on

## Not allowed

- Placeholder text (TODO, TBD, lorem ipsum)
