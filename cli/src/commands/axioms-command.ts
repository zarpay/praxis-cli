import type { CommandRegistrar } from "@framework/types.js";

import auditAxiomsOrchestrator from "@/orchestrators/audit-axioms-orchestrator.js";
import listAxiomsOrchestrator from "@/orchestrators/list-axioms-orchestrator.js";
import ratifyAxiomOrchestrator from "@/orchestrators/ratify-axiom-orchestrator.js";
import showAxiomOrchestrator from "@/orchestrators/show-axiom-orchestrator.js";
import triageAxiomsOrchestrator from "@/orchestrators/triage-axioms-orchestrator.js";

/**
 * Registers the `praxis axioms` command group.
 *
 * Axioms are the named, stable standards critiques attach to (04).
 * `list` and `show` read the store; `triage` and `ratify` are the
 * deliberately interactive lifecycle verbs (LLM proposes, human
 * decides); `audit` re-runs the authoring gate over what is active.
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

  axiomsCmd
    .command("triage")
    .description(
      "Review unassigned critiques with the curator: fold into axioms, dismiss, or accept drafted proposals",
    )
    .option("--yes", "accept every curator suggestion without prompting (recorded as such)", false)
    .option("--reject <reason>", "dismiss everything pending, with this reason")
    .action(triageAxiomsOrchestrator);

  axiomsCmd
    .command("ratify <id>")
    .description("Ratify a proposed axiom: gate verdict, spec traceability, then the human call")
    .option("--yes", "ratify without prompting when traceable", false)
    .option("--reject <reason>", "reject the proposal as reviewer noise (recorded)")
    .option("--spec <path>", "spec to trace against (when no supporting critique names one)")
    .action(ratifyAxiomOrchestrator);

  axiomsCmd
    .command("audit")
    .description("Re-run the authoring gate over active axioms; flags removal candidates")
    .option("--json", "machine-readable output (stable contract)", false)
    .action(auditAxiomsOrchestrator);
};

export default axiomsCommand;
