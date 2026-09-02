import type { CommandRegistrar } from "@framework/types.js";

import listAxiomsOrchestrator from "@/orchestrators/list-axioms-orchestrator.js";
import showAxiomOrchestrator from "@/orchestrators/show-axiom-orchestrator.js";

/**
 * Registers the `praxis axioms` command group.
 *
 * Axioms are the named, stable standards critiques attach to (04).
 * `list` and `show` read the store; the lifecycle verbs (triage,
 * ratify, audit) join them as the milestone lands.
 */
const axiomsCommand: CommandRegistrar = (program) => {
  const axiomsCmd = program
    .command("axioms")
    .description("The named standards critiques attach to: list, inspect, and grow the taxonomy");

  axiomsCmd
    .command("list")
    .description("List every axiom in .praxis/axioms/ — active, proposed, and deprecated")
    .option("--json", "machine-readable output (stable contract)", false)
    .action(listAxiomsOrchestrator);

  axiomsCmd
    .command("show <id>")
    .description("Show one axiom in full: statement, examples, grounding, lifecycle")
    .option("--json", "machine-readable output (stable contract)", false)
    .action(showAxiomOrchestrator);
};

export default axiomsCommand;
