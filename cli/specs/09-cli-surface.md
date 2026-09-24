# 09 — The CLI Surface

**Status:** Draft
**Depends on:** [vocabulary.md](./vocabulary.md); shapes the command surfaces named in 02, 04, 06, 07, 08

## The position

**Praxis is fully CLI-driven, and agents are first-class users of the CLI.** The coding agent that just produced a diff evaluates it by running `praxis eval run`; the one that violated AX-0011 reads the standard by running `praxis axioms show AX-0011`. There is no second interface.

This is what makes Praxis **harness-agnostic**. Every harness — Claude Code, Codex, Cursor, aider, a CI runner, a cron job — can execute a shell command; only some can load an MCP tool or a skill, and each does it differently. Packaging Praxis as tools or skills would mean:

- a second surface to build, document, version, and keep in sync with the CLI;
- per-harness integration work that couples releases to harness ecosystems;
- capability drift — the tool wrapper inevitably lags the CLI.

One surface, both audiences. Where a harness package exists at all (the Claude Code plugin already generates a command and a skill), it is **documentation of CLI usage, never an alternative interface** — v1 already follows this pattern, and it stays a rule.

## Designing for the agent as a user

Agents discover CLIs the same way careful humans do: run `--help`, read it, try a command, read the output. The design consequences:

**Help is the API documentation.** Every command's `--help` must be self-sufficient: what it does, _when to use it_, and concrete examples with the expected output shape. The top-level `praxis --help` names the workflows, not just the commands — an agent reading it should be able to infer the loop:

```
Typical flows:
  Evaluate work you just changed:   praxis eval run <target> --json
  Understand a violated standard:   praxis axioms show <id>
  Check project health:             praxis status
  See what a spec covers:           praxis eval run --type <type>
```

The agent-grade help standard (decided 2026-09-22, resolving open question 2 — no extended-help tier, `--help` carries it all): every leaf command's long-form help states **When to use**, **Behavior** an agent must know (writes vs reads, cache and ledger effects), worked **Examples** with expected output shape, the **JSON (`--json`) contract's** fields where the flag exists, **Next** commands, and ends with a **Docs:** link into the site — the deep-dive an agent follows when compact help isn't enough. Group-level `--help` carries the cross-command workflow (the eval loop, the axiom lifecycle). The text lives in `src/help/*.md`, one document per help moment, bundled as strings — content in markdown, wiring in `commands/` — and mirrored tests enforce the Docs link and When-to-use on every leaf.

**Machine-readable everywhere it matters.** Every read surface takes `--json` (07 already requires the build*/display* split that makes this free). JSON output is a **stable contract**: agents parse it, so schema changes are breaking changes and versioned as such.

**Exit codes carry meaning.** `0` = pass/success, `1` = violations found, `2` = usage or configuration error. An agent branches on exit codes before it parses anything; they must be reliable and documented in help.

**stdout is data, stderr is commentary.** v1's convention (the Logger writes stderr, stdout stays clean for piping) is preserved and load-bearing: an agent capturing stdout gets parseable output, never progress noise.

**Errors instruct.** v1's config error already prints the exact JSON block to add. That is the standard everywhere: an error message states what is wrong _and the command or edit that fixes it_. An instructive error costs one string; an opaque one costs an agent a wasted exploration loop.

**No interactive prompts on agent-reachable paths.** Anything that would prompt must accept its answer as a flag and fail informatively without one (`config edit` opening `$EDITOR` is human-only and says so).

## The fast loop runs through the CLI

The fast loop (08) needs no delivery mechanism beyond this: the coding agent (or a harness hook) runs `praxis eval run <target> --json` after editing; the output _is_ the feedback — raw critiques; labels arrive at triage, never at review (04, 2026-09-07).

## Display and interaction

One CLI, two reading styles. The split is by **command default plus `--json`**, never by separate commands — the human view and the agent view of the same state must never disagree.

### For humans

- **Summary last.** In a terminal, the bottom of the output is what's on screen when the command finishes. Detail scrolls; the verdict stays. (v1's `validate all` — v2's `eval run` — already ends with the summary block; keep.)
- **Every number wears its denominator** (07's rules surface here): `12 violations / 84 opportunities`, `coverage 62% (52/84 files)`. A bare count is a display bug.
- **Fixed color semantics**: green pass · yellow warn · red fail · gray meta/unvalidated. `NO_COLOR` and non-TTY degrade gracefully (v1's Logger already does both).
- **Inline progress for long runs** (`[n/total]` with per-file verdicts — v1 1.3.5) so a validation run reads as a live stream, not a silence followed by a wall. Each heading names the target by its **root-relative path**, directory in meta gray and filename in structure bold (decided 2026-09-14): a basename alone cannot say which of two same-named files a critique landed on, and cannot be pasted back into `eval run <target>`. `eval run <target>` badges the path the same way, as the caller typed it.
- **A single long call gets the same guarantee** (decided 2026-09-14). While one model call is in flight — curate's clustering and traceability calls, triage's labeling batch, a reviewer call on a cache miss — one line on stderr carries a spinner and a climbing clock, repainting in place and erased when the call settles. A model call can take 90 seconds, and a terminal silent for 90 seconds reads as a hang: people kill sessions that are working. This satisfies **No TUI** below — one line, no modes, no alternate screen — and animation needs a TTY, so off one the channel is silent and the command's own Logger lines are the narration. stdout is never touched, so `--json` and piped output are unaffected.
- **Epoch boundaries are visible furniture**: reports print the named boundary line ("── epoch: model → sonnet-4.6, 2026-08-12 ──") wherever a trend crosses one.
- **Drill-down, not dumps.** Broad surfaces stay terse and name the next command: `status` → `validate report <path>` → `axioms show <id>`. Consistent noun-verb grammar means the next step is guessable.
- **Bare `praxis` is the orientation screen**: counts and staleness at a glance — last run, the calibration banner, the two queues (untriaged / awaiting curation), per-reviewer failing counts **for the configured reviewers only** (decided 2026-09-15: the ledger remembers every reviewer that ever ran and `eval report` is right to show them, but this screen is read by someone returning after a week, and a retired reviewer's failing count is an action they cannot take — the reviewer is gone and its cache is pruned; `status` already filtered this way, so the two surfaces now agree) — each with the command that acts on it. The entry point for a human returning after a week _and_ an agent's cheapest situational poll.

### Interaction

- **Curation is the deliberately interactive moment** (updated 2026-09-09: ratify retired — acceptance was already the human decision, so a second yes was ceremony). `praxis axioms triage` is the async labeling pass — one curator call per untriaged critique, no prompts. `praxis axioms curate` is the review session: the LLM clusters the unmatched residue and suggests; the human folds, accepts, or holds — and **acceptance activates**, after the one machine check (spec traceability; untraceable drafts hold with "extend the spec"). The interactive verbs may prompt, but every prompt has a flag equivalent (`--yes`) so they script; scripting past them is a choice the reports will reflect. `deprecate <id> --reason` and `merge <ids...> --into <id>` are the taxonomy's lifecycle verbs: retirement and collapse, both append-only.
- **Agent-reachable commands never prompt** (rule above, restated because it is the boundary of interactivity).
- **No TUI.** Richness comes from good text and drill-down, not modes. If a surface ever genuinely needs more than text (trend charts), that is an export (`--json` piped to the user's tooling), not an interactive screen.

### For agents

- **Terse by default, deterministic always.** Stable sort orders on every list; no decorative framing that parsers must skip; the same state prints the same bytes.
- **One situational poll**: `praxis status --json` carries the pending-work facts (`pending_triage`, `calibration_stale`, `epoch_boundary_detected`, counts) so an agent learns what needs doing from a single cheap call instead of a discovery crawl.
- **Feedback is compact by reference.** Fast-loop output is raw critiques; per-axiom depth lives behind `axioms show <id>` and the reports, after triage labels.

## Surface inventory (v2 additions, gathered from the other docs)

- `praxis eval run [targets...] [--type] [--json]` — no targets = full run; one target = the fast loop; critiques print raw (review→label, 2026-09-07 — labels appear in reports after triage) alongside epoch-boundary warnings (02)
- `praxis eval report [<path|glob>] [--since] [--branch] [--commit <sha>] [--commits <sha...>] [--axiom] [--json]` (07; three scope levels — files/glob, commit, PR)
- `praxis eval review [target] [--dismiss <critique-id> --reason] [--reinstate <critique-id> --reason]` — the validity session: a human judges critiques one at a time and dismisses the invalid ones; the one place a critique is dismissed (04, 2026-09-09)
- `praxis axioms triage | curate | reassign <id> | deprecate <id> | merge <ids...> | show <id> | list` (03, 04)
- `praxis eval critiques [target] [--state] [--axiom] [--json]` — the id-browsing surface reassign and review take their ids from (04)
- `praxis eval prune` — drops cache entries no configured reviewer can hit
- `praxis debt report [--json]` (07)
- `praxis harness suggest` — roadmap (withdrawn 2026-09-07 with the harness surfaces, roadmap/08)

- `praxis feedback <target> [--reviewer] [--verbose] [--json] [--no-cache]` — review for the person writing the code (decided 2026-09-14). Recorded in full, cost included, under `scope: "advisory"`; its critiques never enter triage or curate and never reach a report, and it never writes the verdict cache — a cache hit writes no critique record, so a cached advisory verdict would suppress the evidence the next measurement run owes. A **top-level verb, not an `eval` subcommand**, precisely so the family rule below stays true: a second reviewer-invoking `eval` subcommand would blur it. Targets resolve to the units their specs define, so a directory works and a named cohort member reviews its cohort; an ungoverned or excluded path is refused. Always exits 0 — advice, not a gate.

The family rule (vocabulary, Terminology decisions): **`eval run` writes — it invokes reviewers; `eval review` appends human validity decisions; every other `eval` subcommand reads.** v1's `praxis validate` aliases were stripped 2026-08-31 — v2 accepts only v2 spellings.

Each lands with agent-grade help per the rules above; the inventory stays subordinate to the documents that define the semantics.

## Open questions

1. Does `--json` become the default when stdout is not a TTY (agents get JSON without asking; humans keep pretty output)? Tempting, but implicit mode-switching can surprise both audiences — leaning toward explicit `--json` only.
2. ~~Is there a `praxis explain <command>` or extended-help tier for workflow-level documentation, or does `--help` carry it all? (Agents read long help fine; humans may want it terse.)~~ Resolved 2026-09-22: `--help` carries it all — one surface, no parallel system to drift. Workflow-level documentation lives in the group's own `--help`; depth beyond that is the site docs, which every help document links. The agent-grade help standard above is the contract.
3. Output-schema versioning: a `schema_version` field in every `--json` payload, or semver discipline on the CLI as a whole?
