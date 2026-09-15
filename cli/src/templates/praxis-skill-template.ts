/**
 * The praxis skill document written into user projects: agent-facing
 * reference for the CLI — what it does, how the cache and specs work,
 * and where the evidence lands.
 */
export default function praxisSkillTemplate(): string {
  return `---
description: Reference for the Praxis CLI — what it does, how to use it, and how specs, the cache, and the ledger work.
---

# Praxis

Praxis is a CLI with two complementary functions:

**Conceptual linting** — spec files state what correct looks like for the files they govern. \`praxis eval run\` has an LLM reviewer read each file or directory against its spec and caches the verdict. The cache is content-hash keyed: editing a file (or its spec) auto-invalidates its entry.

**Knowledge compilation** — expert files in the configured \`expertsDir\` compile into self-contained specification framed as agent profiles, and each enabled plugin writes its own output (this document was written by the claude-code plugin).

Every run also appends evidence to the ledger: one run record per reviewer plus one critique per issue, at \`.praxis/ledger/\`. Recurring critiques are labeled into **axioms** — named critique categories; the reviewer itself sees only the spec (\`axioms triage\` labels, \`axioms curate\` clusters).

## The loop

**Arriving.** Bare \`praxis\` says where the project stands — last run, what is waiting, what it owes. \`praxis status\` adds coverage: what is governed by a spec and what nothing has ever read.

**While writing.** \`praxis feedback <path>\` is the real reviewers against the real spec, as advice: it writes no cache entry and its critiques never enter triage, because a file in flight is not evidence. It always exits 0. Run it as often as it helps.

**When the change is done.** \`praxis eval run <path>\` is the run that counts — it writes the verdict to the cache and the critique to the ledger, and it is the verdict CI will read. Findings name the standard behind them: \`praxis axioms show <id>\` for a cited \`[AX-3f9c2d]\`, and \`praxis eval verdict <path> --verbose\` to re-read the reasoning later without paying again.

**Before pushing.** \`praxis eval run\` over the corpus, or name what you touched — \`eval run\` takes files, so a directory goes in as a glob: \`praxis eval run "src/services/*"\`. Unchanged files come back from the cache, so the bill is only what you changed.

**Resolving a backlog.** When a run comes back with findings across many files, take the whole list first — the corpus, or the glob covering what one spec governs — and work it one file at a time, each fix the minimum the finding asks for and verified before the next. Fixing opportunistically as you read leaves no way to tell what is left. Close with a full run, which catches what the fixes moved.

**When the reviewer is wrong.** Dismiss it; do not skip it. \`praxis eval critiques <path> --state untriaged\` for the id, then \`praxis eval review --dismiss <id> --reason "…"\`. A skipped critique waits in the queue forever, and dismissals are the reviewer-trust signal — a run of them means the spec is what needs the edit.

**When the standard itself changes.** Editing a spec invalidates every verdict it produced; re-run the files it governs to see them against the new bar. Experts and practices start from \`praxis add\`, and \`praxis compile\` rebuilds the profiles from them.

The read side — \`eval report\`, \`debt report\`, \`eval critiques\`, \`axioms show\` — never calls a reviewer, so it costs nothing to consult at any point.

## Hard rules

**Triage and curate never happen during development.** \`axioms triage\` and \`axioms curate\` re-label the accumulated backlog and change what every later report says. They are a human-led session on their own commit and review cycle, never a step inside someone's feature work. While developing, the only review commands are \`eval\` and \`feedback\`.

**Never edit \`.praxis/cache/\` or \`.praxis/ledger/\` by hand.** Not a line, not a file, not a deletion. The cache holds verdicts already paid for, the ledger is append-only evidence, and a hand-altered record is worth nothing — there is no way to tell what a reviewer actually said from one, and nothing to rebuild it from.

**Always commit what a run writes.** The cache entries and ledger records a run produces belong in the same commit as the code that produced them. That is what stops the team re-paying for verdicts someone already bought, and what keeps the evidence attached to the change it describes.

## Project structure

\`\`\`
.praxis/config.json   — sources, reviewers, ignore patterns, specFilePattern
.praxis/cache/        — committed verdicts, keyed by content hash
.praxis/ledger/       — append-only run and critique records (committed)
.praxis/axioms/       — ratified standards; proposals under axioms/proposed/
\`\`\`

Config is loaded from the nearest \`.praxis/\` directory walking up from cwd.

## Key CLI commands

\`\`\`bash
# Orientation
praxis                              # last run, pending triage, proposals, debt
praxis status                       # document counts, review coverage, structural issues

# Review — reviewer calls happen only on cache misses; unchanged content is free
praxis eval run                     # the whole corpus
praxis eval run <path>              # one file against its spec (the fast loop)
praxis eval run "<glob>"            # the subset you name — files, never a bare directory
praxis feedback <path>              # same reviewers, as advice: never queued, never cached
praxis eval ci                      # the full run CI makes, writing no ledger record

# Flags above: --verbose (full reasoning) · --json (stable machine contract)
# --reviewer <name> · --fail-fast (full run only) · --no-cache (skips reads AND writes)

# Read what was already said — never a reviewer call
praxis eval verdict <path> --verbose             # PASS | WARN | FAIL | STALE | NOT VALIDATED
praxis eval critiques <path> --state untriaged   # critique ids and their lifecycle state
praxis axioms show <id>                          # the drill-down behind a cited [AX-xxxxxx]
praxis eval report                               # per-axiom rates, epochs, costs
praxis debt report                               # pre-spec debt and where it concentrates

# Judge a critique invalid — the one place that happens, and it takes a reason
praxis eval review --dismiss <id> <id> --reason "why it is wrong"

# Knowledge side
praxis add expert <name>            # or: praxis add practice <name>
praxis compile                      # recompile expert files into SME agent profiles
praxis config show                  # or: praxis config edit
\`\`\`

Exit codes: \`0\` clean · \`1\` violations, or a target no reviewer could read · \`2\` usage or configuration error.

## How specs work

Spec files match \`specFilePattern\` (check \`.praxis/config.json\`).

A spec with \`paths:\` frontmatter governs those glob patterns — files of any extension. \`excludes:\` shields files from review, and \`context:\` is assist-only material inlined into the prompt. Under \`cohort: by_directory\` the review unit is the whole directory, so naming one file in it reviews the cohort. Positive examples belong in the spec's own prose.

When a finding cites an axiom id like \`[AX-3f9c2d]\`, that names a stable category of recurring critique: \`praxis axioms show <id>\` gives its statement, the spec passage the rule lives in, and real labeled critiques as examples.

## Cache behaviour

- Content-hash keyed: edit a file → its entry auto-invalidates on the next run
- The hash covers everything the reviewer saw — target, spec, assist files — so changing any of them invalidates the verdicts they produced
- A reviewer's own settings are part of the key: swapping its model or prompt opens a new epoch, and old entries stop being readable
- \`--no-cache\` skips the read *and* the write, so its verdict is not kept (use sparingly, mainly to check reviewer non-determinism on borderline results)

Every configured reviewer evaluates every target and results are reported per reviewer, never pooled.
`;
}
