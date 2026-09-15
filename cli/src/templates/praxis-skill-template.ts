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

**Conceptual linting** — spec files state what correct looks like for the files they govern. \`praxis eval run\` has an LLM reviewer read each file against its spec and caches the verdict. The cache is content-hash keyed: editing a file (or its spec) auto-invalidates its entry. Never delete the cache manually.

**Knowledge compilation** — expert files in the configured \`expertsDir\` compile into self-contained SME agent profiles, and each enabled plugin writes its own output (this document was written by the claude-code plugin).

Every run also appends evidence to the ledger: one run record per reviewer plus one critique per issue, at \`.praxis/ledger/\`. Recurring critiques are labeled into **axioms** — named, ratified standards; the reviewer itself sees only the spec (\`axioms triage\` labels, \`axioms curate\` clusters).

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
praxis eval run <path>              # one file against its spec (the fast loop)
praxis eval run                     # the whole corpus
praxis eval run --type <type>       # one spec's targets (the "By type:" label from a full run)
praxis feedback <path>              # same reviewers, as advice: never queued, never cached
praxis eval ci                      # the full run CI makes, writing no ledger record

# Flags above: --verbose (full reasoning) · --json (stable machine contract)
# --reviewer <name> · --fail-fast (full run only) · --no-cache (skips reads AND writes)

# Read what was already said — never a reviewer call
praxis eval verdict <path> --verbose         # PASS | WARN | FAIL | STALE | NOT VALIDATED
praxis eval critiques <path> --state untriaged   # critique ids and their lifecycle state
praxis axioms show <id>                      # the drill-down behind a cited [AX-xxxxxx]
praxis eval report                           # per-axiom rates, epochs, costs
praxis debt report                           # pre-spec debt and where it concentrates

# Judge a critique invalid — the one place that happens, and it takes a reason
praxis eval review --dismiss <id> <id> --reason "why it is wrong"

# Knowledge side
praxis add expert <name>            # or: praxis add practice <name>
praxis compile                      # recompile expert files into SME agent profiles
praxis config show                  # or: praxis config edit
\`\`\`

Exit codes: \`0\` clean · \`1\` violations, or a target no reviewer could read · \`2\` usage or configuration error.

## How specs work

Spec files match \`specFilePattern\` (default \`README.md\`; check \`.praxis/config.json\`).

A spec with \`paths:\` frontmatter governs those glob patterns — files of any extension. Without \`paths:\`, it governs its own directory's sibling \`.md\` files. \`excludes:\` shields files from review, and \`context:\` is assist-only material inlined into the prompt. Under \`cohort: by_directory\` the review unit is the whole directory, so naming one file in it reviews the cohort. Positive examples belong in the spec's own prose — a live file held up as exemplary drifts with its next edit.

When a finding cites an axiom id like \`[AX-3f9c2d]\`, that names a stable category of recurring critique: \`praxis axioms show <id>\` gives its statement, the spec passage the rule lives in, and real labeled critiques as examples.

## Cache behaviour

- Content-hash keyed: edit a file → its entry auto-invalidates on the next run
- The hash covers everything the reviewer saw — target, spec, assist files — so changing any of them invalidates the verdicts they produced
- A reviewer's own settings are part of the key: swapping its model or prompt opens a new epoch, and old entries stop being readable
- \`--no-cache\` skips the read *and* the write, so its verdict is not kept (use sparingly, mainly to check reviewer non-determinism on borderline results)
- Never delete \`.praxis/cache/\` — it accumulates valid verdicts and saves API calls

Every configured reviewer evaluates every target and results are reported per reviewer, never pooled.
`;
}
