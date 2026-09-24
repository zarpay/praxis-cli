import type { CommandRegistrar } from "@framework/types.js";

import evalCiHelp from "@/help/eval-ci-help.md";
import evalCritiquesHelp from "@/help/eval-critiques-help.md";
import evalHelp from "@/help/eval-help.md";
import evalPruneHelp from "@/help/eval-prune-help.md";
import evalReportHelp from "@/help/eval-report-help.md";
import evalReviewHelp from "@/help/eval-review-help.md";
import evalRunHelp from "@/help/eval-run-help.md";
import evalVerdictHelp from "@/help/eval-verdict-help.md";
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
  const evalCmd = program
    .command("eval")
    .description("Review targets against their specs")
    .addHelpText("after", `\n${evalHelp}`);

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
    .addHelpText("after", `\n${evalRunHelp}`)
    .action(runEvalOrchestrator);

  evalCmd
    .command("ci")
    .description("Run a full review in CI mode (verifies without writing)")
    .option("--strict", "fail on warnings too", false)
    .addHelpText("after", `\n${evalCiHelp}`)
    .action(ciRunOrchestrator);

  evalCmd
    .command("critiques [target]")
    .description("List the ledger's critiques with their ids and lifecycle states")
    .option("--axiom <id>", "only critiques whose effective label is this axiom")
    .option("--state <state>", "only untriaged | unmatched | labeled | dismissed | advisory")
    .option("--json", "machine-readable output (stable contract)")
    .addHelpText("after", `\n${evalCritiquesHelp}`)
    .action(listCritiquesOrchestrator);

  evalCmd
    .command("review [target]")
    .description(
      "Judge the validity of unlabeled critiques one at a time; dismiss the invalid (recorded)",
    )
    .option(
      "--dismiss <critique-ids...>",
      "scripted: dismiss these critiques, one reason for all (with --reason)",
    )
    .option(
      "--reinstate <critique-ids...>",
      "scripted: lift these critiques' dismissals, one reason for all (with --reason)",
    )
    .option("--reason <why>", "why — recorded with the decision")
    .addHelpText("after", `\n${evalReviewHelp}`)
    .action(reviewCritiquesOrchestrator);

  evalCmd
    .command("prune")
    .description("Drop cached verdicts that no configured reviewer can hit")
    .addHelpText("after", `\n${evalPruneHelp}`)
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
    .addHelpText("after", `\n${evalReportHelp}`)
    .action(reportEvalOrchestrator);

  evalCmd
    .command("verdict <target>")
    .description("Show the cached verdict for a target, without an API call")
    .option("--verbose", "show full AI reasoning", false)
    .option("--json", "machine-readable output (stable contract)")
    .addHelpText("after", `\n${evalVerdictHelp}`)
    .action(reportVerdictsOrchestrator);
};

export default evalCommand;
