import type { CommandRegistrar } from "@framework/types.js";

import axiomsCurateHelp from "@/help/axioms-curate-help.md";
import axiomsDeprecateHelp from "@/help/axioms-deprecate-help.md";
import axiomsHelp from "@/help/axioms-help.md";
import axiomsListHelp from "@/help/axioms-list-help.md";
import axiomsMergeHelp from "@/help/axioms-merge-help.md";
import axiomsReassignHelp from "@/help/axioms-reassign-help.md";
import axiomsShowHelp from "@/help/axioms-show-help.md";
import axiomsTriageHelp from "@/help/axioms-triage-help.md";
import curateAxiomsOrchestrator from "@/orchestrators/curate-axioms-orchestrator.js";
import deprecateAxiomOrchestrator from "@/orchestrators/deprecate-axiom-orchestrator.js";
import listAxiomsOrchestrator from "@/orchestrators/list-axioms-orchestrator.js";
import mergeAxiomsOrchestrator from "@/orchestrators/merge-axioms-orchestrator.js";
import reassignCritiqueOrchestrator from "@/orchestrators/reassign-critique-orchestrator.js";
import showAxiomOrchestrator from "@/orchestrators/show-axiom-orchestrator.js";
import triageAxiomsOrchestrator from "@/orchestrators/triage-axioms-orchestrator.js";

/**
 * Registers the `praxis axioms` command group.
 *
 * Axioms are the named, stable categories recurring critiques attach to.
 * `list` and `show` read the store; `triage` labels in batch; `curate`
 * is the deliberately interactive lifecycle verb — the LLM proposes, a
 * human accepts, and acceptance activates (traceability checked
 * inline); `reassign`, `deprecate` and `merge` are the taxonomy's
 * correction verbs.
 */
const axiomsCommand: CommandRegistrar = (program) => {
  const axiomsCmd = program
    .command("axioms")
    .description(
      "The named categories recurring critiques attach to: list, inspect, and grow the taxonomy",
    )
    .addHelpText("after", `\n${axiomsHelp}`);

  axiomsCmd
    .command("list")
    .description("List every axiom in .praxis/axioms/ — active and deprecated")
    .option("--json", "machine-readable output (stable contract)")
    .addHelpText("after", `\n${axiomsListHelp}`)
    .action(listAxiomsOrchestrator);

  axiomsCmd
    .command("show <id>")
    .description("Show one axiom in full: statement, derivation, and its labeled critiques")
    .option("--json", "machine-readable output (stable contract)")
    .addHelpText("after", `\n${axiomsShowHelp}`)
    .action(showAxiomOrchestrator);

  axiomsCmd
    .command("triage")
    .description("Label the pending critique backlog against active axioms (batch, curator)")
    .option("--dry-run", "print the proposed labels without writing anything", false)
    .addHelpText("after", `\n${axiomsTriageHelp}`)
    .action(triageAxiomsOrchestrator);

  axiomsCmd
    .command("curate")
    .description(
      "Work the unmatched residue with the curator: cluster, activate new axioms, assign, or hold",
    )
    .option("--yes", "accept every curator suggestion without prompting (recorded as such)", false)
    .addHelpText("after", `\n${axiomsCurateHelp}`)
    .action(curateAxiomsOrchestrator);

  axiomsCmd
    .command("reassign <id>")
    .description("Re-decide one critique's label by hand: append an assignment to an active axiom")
    .requiredOption("--to <axiom>", "the active axiom the critique belongs under")
    .addHelpText("after", `\n${axiomsReassignHelp}`)
    .action(reassignCritiqueOrchestrator);

  axiomsCmd
    .command("deprecate <id>")
    .description("Retire an active axiom: status flips, records stay readable forever")
    .requiredOption("--reason <reason>", "why the category is retired (recorded)")
    .addHelpText("after", `\n${axiomsDeprecateHelp}`)
    .action(deprecateAxiomOrchestrator);

  axiomsCmd
    .command("merge <ids...>")
    .description(
      "Collapse over-split axioms into one: re-label their critiques, deprecate the rest",
    )
    .requiredOption("--into <id>", "the surviving axiom")
    .addHelpText("after", `\n${axiomsMergeHelp}`)
    .action(mergeAxiomsOrchestrator);
};

export default axiomsCommand;
