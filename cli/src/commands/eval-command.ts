import type { CommandRegistrar } from "@framework/types.js";

import ciRunOrchestrator from "@/orchestrators/ci-run-orchestrator.js";
import pruneCacheOrchestrator from "@/orchestrators/prune-cache-orchestrator.js";
import reportEvalOrchestrator from "@/orchestrators/report-eval-orchestrator.js";
import reportVerdictsOrchestrator from "@/orchestrators/report-verdicts-orchestrator.js";
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
      "--diff [base]",
      "review the branch against its merge-base (default base: the default branch)",
    )
    .addHelpText(
      "after",
      `
When to use: after changing a file (the fast loop), or on a branch with
--diff to see what it introduced, resolved, and inherited. Reviewer
calls happen only on cache misses; unchanged content is free.

Examples:
  $ praxis eval run src/services/checkout.ts
      [1/1] checkout.ts  ✓ PASS   (or findings citing [AX-…] with witnesses)
  $ praxis eval run --diff main
      findings labeled [introduced]/[inherited], vanished ones [resolved]`,
    )
    .action(runEvalOrchestrator);

  evalCmd
    .command("ci")
    .description("Run a full review in CI mode (verifies without writing)")
    .option("--strict", "fail on warnings too", false)
    .option("--diff [base]", "verify the merge-base diff instead of the corpus (PR gate)")
    .addHelpText(
      "after",
      `
When to use: in a pipeline. Verifies against committed verdicts and
writes nothing — no ledger run, no cache mutation. With --diff it is
the PR gate: only introduced errors or unverified targets fail.

Example:
  $ praxis eval ci --diff main    # exit 0 = mergeable, 1 = introduced errors`,
    )
    .action(ciRunOrchestrator);

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
    .option("--json", "machine-readable output (stable contract)", false)
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
