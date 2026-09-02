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

**Help is the API documentation.** Every command's `--help` must be self-sufficient: what it does, *when to use it*, and concrete examples with the expected output shape. The top-level `praxis --help` names the workflows, not just the commands — an agent reading it should be able to infer the loop:

```
Typical flows:
  Evaluate work you just changed:   praxis eval run <target> --json
  Understand a violated standard:   praxis axioms show <id>
  Check project health:             praxis status
  See what a spec covers:           praxis eval run --type <type>
```

**Machine-readable everywhere it matters.** Every read surface takes `--json` (07 already requires the build*/display* split that makes this free). JSON output is a **stable contract**: agents parse it, so schema changes are breaking changes and versioned as such.

**Exit codes carry meaning.** `0` = pass/success, `1` = violations found, `2` = usage or configuration error. An agent branches on exit codes before it parses anything; they must be reliable and documented in help.

**stdout is data, stderr is commentary.** v1's convention (the Logger writes stderr, stdout stays clean for piping) is preserved and load-bearing: an agent capturing stdout gets parseable output, never progress noise.

**Errors instruct.** v1's config error already prints the exact JSON block to add. That is the standard everywhere: an error message states what is wrong *and the command or edit that fixes it*. An instructive error costs one string; an opaque one costs an agent a wasted exploration loop.

**No interactive prompts on agent-reachable paths.** Anything that would prompt must accept its answer as a flag and fail informatively without one (`config edit` opening `$EDITOR` is human-only and says so).

## The fast loop runs through the CLI

The fast loop (08) needs no delivery mechanism beyond this: the coding agent (or a harness hook) runs `praxis eval run <target> --json` after editing; the output *is* the feedback — matched violations carry their axiom (ID, statement, examples, grounding), unmatched ones carry the raw critique. Whether the harness triggers that run via a hook, a rule, or the agent's own habit is the harness's business, which is exactly the point.

## Display and interaction

One CLI, two reading styles. The split is by **command default plus `--json`**, never by separate commands — the human view and the agent view of the same state must never disagree.

### For humans

- **Summary last.** In a terminal, the bottom of the output is what's on screen when the command finishes. Detail scrolls; the verdict stays. (v1's `validate all` — v2's `eval run` — already ends with the summary block; keep.)
- **Every number wears its denominator** (07's rules surface here): `12 violations / 84 opportunities`, `coverage 62% (52/84 files)`. A bare count is a display bug.
- **Fixed color semantics**: green pass · yellow warn · red fail · gray meta/unvalidated. `NO_COLOR` and non-TTY degrade gracefully (v1's Logger already does both).
- **Inline progress for long runs** (`[n/total]` with per-file verdicts — v1 1.3.5) so a validation run reads as a live stream, not a silence followed by a wall.
- **Epoch boundaries are visible furniture**: reports print the named boundary line ("── epoch: model → sonnet-4.6, 2026-08-12 ──") wherever a trend crosses one.
- **Drill-down, not dumps.** Broad surfaces stay terse and name the next command: `status` → `validate report <path>` → `axioms show <id>`. Consistent noun-verb grammar means the next step is guessable.
- **Bare `praxis` is the orientation screen**: counts and staleness at a glance — last run, epoch status, pending triage, calibration freshness, debt/paydown one-liner — each with the command that acts on it. The entry point for a human returning after a week *and* an agent's cheapest situational poll.

### Interaction

- **Triage and ratification are the deliberately interactive moments.** `praxis axioms triage` is a review session: the LLM groups critiques and suggests assignments; the human folds, dismisses, or accepts drafts (04) — the primary human touchpoint in the loop. `praxis axioms ratify <id>` shows the proposed axiom, its supporting critiques, its gate verdict and spec traceability, then confirms. Both are human verbs by design (LLM proposes, human decides) — they may prompt, but every prompt has a flag equivalent (`--yes`, `--reject "reason"`) so they script; scripting past them is a choice the reports will reflect.
- **Agent-reachable commands never prompt** (rule above, restated because it is the boundary of interactivity).
- **No TUI.** Richness comes from good text and drill-down, not modes. If a surface ever genuinely needs more than text (trend charts), that is an export (`--json` piped to the user's tooling), not an interactive screen.

### For agents

- **Terse by default, deterministic always.** Stable sort orders on every list; no decorative framing that parsers must skip; the same state prints the same bytes.
- **One situational poll**: `praxis status --json` carries the pending-work facts (`pending_triage`, `calibration_stale`, `epoch_boundary_detected`, counts) so an agent learns what needs doing from a single cheap call instead of a discovery crawl.
- **Feedback is compact by reference.** Fast-loop output (08) carries axiom IDs with statements; the agent that wants depth runs `axioms show <id>`. Don't inline every example into every violation — the drill-down grammar is token economy.

## Surface inventory (v2 additions, gathered from the other docs)

- `praxis eval run [targets...] [--type] [--json]` — no targets = full run; one target = the fast loop; extended output carries axioms on matched critiques (04, 08) and epoch-boundary warnings (02)
- `praxis eval report [--since] [--branch] [--axiom] [--json]` (07)
- `praxis axioms triage | ratify <id> | show <id> | list | audit` (03, 04)
- `praxis calibrate run | status` (06)
- `praxis debt report [--json]` (07)
- `praxis harness suggest` (08)

The family rule (vocabulary, Terminology decisions): **`eval run` writes — it invokes reviewers; every other `eval` subcommand reads the ledger.** v1's `praxis validate document|all` remain as deprecated aliases through the migration.

Each lands with agent-grade help per the rules above; the inventory stays subordinate to the documents that define the semantics.

## Open questions

1. Does `--json` become the default when stdout is not a TTY (agents get JSON without asking; humans keep pretty output)? Tempting, but implicit mode-switching can surprise both audiences — leaning toward explicit `--json` only.
2. Is there a `praxis explain <command>` or extended-help tier for workflow-level documentation, or does `--help` carry it all? (Agents read long help fine; humans may want it terse.)
3. Output-schema versioning: a `schema_version` field in every `--json` payload, or semver discipline on the CLI as a whole?
