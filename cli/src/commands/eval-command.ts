import type { CommandRegistrar } from "@framework/types.js";

import ciRunOrchestrator from "@/orchestrators/ci-run-orchestrator.js";
import listCritiquesOrchestrator from "@/orchestrators/list-critiques-orchestrator.js";
import pruneCacheOrchestrator from "@/orchestrators/prune-cache-orchestrator.js";
import reportEvalOrchestrator from "@/orchestrators/report-eval-orchestrator.js";
import reportVerdictsOrchestrator from "@/orchestrators/report-verdicts-orchestrator.js";
import reviewCritiquesOrchestrator from "@/orchestrators/review-critiques-orchestrator.js";
import runEvalOrchestrator from "@/orchestrators/run-eval-orchestrator.js";

/**
 * Registers the `praxis eval` command group.
 *
 * `eval run` writes (invokes reviewers); every other subcommand reads
 * existing results.
 */
const evalCommand: CommandRegistrar = (program) => {
  const evalCmd = program.command("eval").description("Review targets against their specs");

  evalCmd
    .command("run [targets...]")
    .description("Review targets against their specs (no targets = full run)")
    .option("--type <type>", "only review targets of this type (full run only)")
    .option("--reviewer <name>", "run only the named reviewer (default: all configured reviewers)")
    .option("--spec <path>", "path to spec file (single target only)")
    .option("--verbose", "show full AI reasoning", false)
    .option("--fail-fast", "stop on first error (full run only)", false)
    .option("--no-cache", "disable the verdict cache")
    .option(
      "--json",
      "machine-readable outcome on stdout (stable contract; the fast loop's feedback)",
    )
    .addHelpText(
      "after",
      `
When to use: after changing a file (the fast loop), or with no targets
for the full corpus. Reviewer calls happen only on cache misses;
unchanged content is free.

Examples:
  $ praxis eval run src/services/checkout.ts
      [1/1] checkout.ts  ✓ PASS   (or findings citing [AX-…] with witnesses)
`,
    )
    .action(runEvalOrchestrator);

  evalCmd
    .command("ci")
    .description("Run a full review in CI mode (verifies without writing)")
    .option("--strict", "fail on warnings too", false)
    .addHelpText(
      "after",
      `
When to use: in a pipeline. Verifies against committed verdicts and
writes nothing — no ledger run, no cache mutation.

Example:
  $ praxis eval ci    # exit 0 = clean, 1 = errors or unverified`,
    )
    .action(ciRunOrchestrator);

  evalCmd
    .command("critiques [target]")
    .description("List the ledger's critiques with their ids and lifecycle states")
    .option("--axiom <id>", "only critiques whose effective label is this axiom")
    .option("--state <state>", "only untriaged | unmatched | labeled | dismissed")
    .option("--json", "machine-readable output (stable contract)")
    .addHelpText(
      "after",
      `
When to use: to browse critique ids before \`praxis axioms reassign\`,
or to drill into any queue count. Pure read — never a reviewer call.
States: untriaged (triage's queue), unmatched (curate's queue), labeled,
dismissed.

Examples:
  $ praxis eval critiques src/services --state unmatched
  $ praxis eval critiques --axiom AX-b951db`,
    )
    .action(listCritiquesOrchestrator);

  evalCmd
    .command("review [target]")
    .description(
      "Judge the validity of unlabeled critiques one at a time; dismiss the invalid (recorded)",
    )
    .option("--dismiss <critique-id>", "scripted: dismiss this critique (with --reason)")
    .option("--reinstate <critique-id>", "scripted: lift this critique's dismissal (with --reason)")
    .option("--reason <why>", "why — recorded with the decision")
    .addHelpText(
      "after",
      `
When to use: the reviewer said something untrue, ungrounded, or the
humans disagree with the spec it cites. Only untriaged and unmatched
critiques come up — a critique labeled under an axiom is valid by
definition and is refused. This is the one place a critique is judged
invalid: a dismissed critique leaves every queue and is never labeled or
curated until reinstated. The dismissal rate is the reviewer-trust
signal — many dismissals mean the specs disagree with the humans, or
the reviewers are drifting.

Examples:
  $ praxis eval review src/services
  $ praxis eval review --dismiss 20260907T101932101Z-c0f5baa5:6 --reason "the spec permits this"
  $ praxis eval review --reinstate 20260907T101932101Z-c0f5baa5:6 --reason "misread the spec"`,
    )
    .action(reviewCritiquesOrchestrator);

  evalCmd
    .command("prune")
    .description("Drop cached verdicts that no configured reviewer can hit")
    .addHelpText(
      "after",
      `
When to use: after a reviewer's config or prompt surface changed (a new
epoch) — the old identity's cache entries can never hit again.

Example:
  $ praxis eval prune
      Pruned 18 orphaned verdict(s)   (or "Nothing to prune")`,
    )
    .action(pruneCacheOrchestrator);

  evalCmd
    .command("report [target]")
    .description(
      "Compute over the ledger: per-axiom rates, epochs, costs, residual (reads only, never calls a reviewer)",
    )
    .option(
      "--since <dateOrRef>",
      "only runs at or after this ISO date, or a git ref's commit date",
    )
    .option("--branch <name>", "only runs recorded on this branch")
    .option("--commit <sha>", "only runs anchored to this commit")
    .option("--commits <shas...>", "only runs anchored to any of these commits (a PR's set)")
    .option("--axiom <id>", "one axiom across everything in scope")
    .option("--json", "machine-readable output (stable contract)")
    .addHelpText(
      "after",
      `
When to use: to read the evidence — per-axiom rates with denominators,
epochs, violation flow, costs. Pure read: never calls a reviewer.

Examples:
  $ praxis eval report                  # everything in the current epoch
  $ praxis eval report --axiom AX-b951db # one standard, drilled down
  $ praxis eval report --branch feature/x --since v1.4.0`,
    )
    .action(reportEvalOrchestrator);

  evalCmd
    .command("verdict <target>")
    .description("Show the cached verdict for a target, without an API call")
    .option("--verbose", "show full AI reasoning", false)
    .option("--json", "machine-readable output (stable contract)")
    .addHelpText(
      "after",
      `
When to use: to re-read what each reviewer last said about a file
without paying for a fresh review. Marked STALE when the file changed.

Example:
  $ praxis eval verdict src/services/checkout.ts`,
    )
    .action(reportVerdictsOrchestrator);
};

export default evalCommand;
