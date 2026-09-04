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
    .addHelpText(
      "after",
      `
When to use: to survey the ratified standards and pending proposals.

Example:
  $ praxis axioms list
      AX-b951db  active  error  Error messages must be specific…`,
    )
    .action(listAxiomsOrchestrator);

  axiomsCmd
    .command("show <id>")
    .description("Show one axiom in full: statement, examples, grounding, lifecycle")
    .option("--json", "machine-readable output (stable contract)", false)
    .addHelpText(
      "after",
      `
When to use: a finding cited an [AX-…] id and you want the standard's
statement, both examples, and the spec sentence that grounds it.

Example:
  $ praxis axioms show AX-b951db`,
    )
    .action(showAxiomOrchestrator);

  axiomsCmd
    .command("triage")
    .description(
      "Review unassigned critiques with the curator: fold into axioms, dismiss, or accept drafted proposals",
    )
    .option("--yes", "accept every curator suggestion without prompting (recorded as such)", false)
    .option("--reject <reason>", "dismiss everything pending, with this reason")
    .addHelpText(
      "after",
      `
When to use: when the orientation screen shows pending triage. The
curator groups recurring open-channel critiques into proposals; every
decision is recorded in the ledger. Consumes the pending queue.

Example:
  $ praxis axioms triage`,
    )
    .action(triageAxiomsOrchestrator);

  axiomsCmd
    .command("ratify <id>")
    .description("Ratify a proposed axiom: gate verdict, spec traceability, then the human call")
    .option("--yes", "ratify without prompting when traceable", false)
    .option("--reject <reason>", "reject the proposal as reviewer noise (recorded)")
    .option("--spec <path>", "spec to trace against (when no supporting critique names one)")
    .addHelpText(
      "after",
      `
When to use: a triage session drafted a proposal. Ratification demands
spec traceability — an axiom activates only when grounded in a spec
sentence — and activation re-reviews exactly what that spec governs.

Example:
  $ praxis axioms ratify AX-3f9a1c`,
    )
    .action(ratifyAxiomOrchestrator);

  axiomsCmd
    .command("audit")
    .description("Re-run the authoring gate over active axioms; flags removal candidates")
    .option("--json", "machine-readable output (stable contract)", false)
    .addHelpText(
      "after",
      `
When to use: periodically, or after spec edits — checks each active
axiom still passes the authoring gate and flags removal candidates.
Spends curator calls (one per active axiom).

Example:
  $ praxis axioms audit`,
    )
    .action(auditAxiomsOrchestrator);
};

export default axiomsCommand;
