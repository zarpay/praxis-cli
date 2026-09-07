import type { CommandRegistrar } from "@framework/types.js";

import auditAxiomsOrchestrator from "@/orchestrators/audit-axioms-orchestrator.js";
import curateAxiomsOrchestrator from "@/orchestrators/curate-axioms-orchestrator.js";
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
    .option("--json", "machine-readable output (stable contract)")
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
    .description("Show one axiom in full: statement, examples, derivation, lifecycle")
    .option("--json", "machine-readable output (stable contract)")
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
    .description("Label the pending critique backlog against active axioms (batch, curator)")
    .option("--dry-run", "print the proposed labels without writing anything", false)
    .addHelpText(
      "after",
      `
When to use: whenever pending critiques have piled up — an async batch
pass, run on demand. The curator classifies each pending critique
against the active axioms derived from its spec: squarely-an-instance
gets an assignment record (provenance: matcher, human-overridable at
curate); everything else stays pending for \`praxis axioms curate\`.
No curator configured → warns and does nothing.

Example:
  $ praxis axioms triage --dry-run`,
    )
    .action(triageAxiomsOrchestrator);

  axiomsCmd
    .command("curate")
    .description(
      "Work the still-pending residue with the curator: cluster into proposals, dismiss, or assign",
    )
    .option("--yes", "accept every curator suggestion without prompting (recorded as such)", false)
    .option("--reject <reason>", "dismiss everything pending, with this reason")
    .addHelpText(
      "after",
      `
When to use: after triage has labeled what it confidently can — this is
the interactive session for the residue: cluster recurring critiques
into proposed axioms, dismiss noise with reasons, assign stragglers.
Every decision is recorded in the ledger.

Example:
  $ praxis axioms curate`,
    )
    .action(curateAxiomsOrchestrator);

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
spec traceability — an axiom activates only when its principle traces to a spec
sentence — and activation re-reviews exactly what that spec governs.

Example:
  $ praxis axioms ratify AX-3f9a1c`,
    )
    .action(ratifyAxiomOrchestrator);

  axiomsCmd
    .command("audit")
    .description("Re-run the authoring gate over active axioms; flags removal candidates")
    .option("--json", "machine-readable output (stable contract)")
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
