import type { CommandRegistrar } from "@framework/types.js";

import auditAxiomsOrchestrator from "@/orchestrators/audit-axioms-orchestrator.js";
import curateAxiomsOrchestrator from "@/orchestrators/curate-axioms-orchestrator.js";
import deprecateAxiomOrchestrator from "@/orchestrators/deprecate-axiom-orchestrator.js";
import listAxiomsOrchestrator from "@/orchestrators/list-axioms-orchestrator.js";
import mergeAxiomsOrchestrator from "@/orchestrators/merge-axioms-orchestrator.js";
import ratifyAxiomOrchestrator from "@/orchestrators/ratify-axiom-orchestrator.js";
import showAxiomOrchestrator from "@/orchestrators/show-axiom-orchestrator.js";
import triageAxiomsOrchestrator from "@/orchestrators/triage-axioms-orchestrator.js";

/**
 * Registers the `praxis axioms` command group.
 *
 * Axioms are the named, stable standards critiques attach to.
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
When to use: whenever untriaged critiques have piled up — an async
pass, run on demand, one curator call per critique. The curator
classifies each against ALL active axioms (an axiom abstracts a
principle — any spec's critique can land in any axiom):
squarely-an-instance gets an assignment record (provenance: matcher,
human-overridable at curate); a no-match moves the critique to
\`praxis axioms curate\`'s queue. No curator configured → warns and
does nothing.

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
When to use: a curate session drafted a proposal. Ratification demands
spec traceability — an axiom activates only when its principle traces
to a spec sentence. Activation has no cache effect; the next triage
labels against it.

Example:
  $ praxis axioms ratify AX-3f9a1c`,
    )
    .action(ratifyAxiomOrchestrator);

  axiomsCmd
    .command("deprecate <id>")
    .description("Retire an active axiom: status flips, records stay readable forever")
    .requiredOption("--reason <reason>", "why the standard is retired (recorded)")
    .addHelpText(
      "after",
      `
When to use: a standard stopped mattering, moved into static tooling,
or was merged away. Deprecation never deletes: the id and every record
under it stay readable; it simply stops labeling and accruing.

Example:
  $ praxis axioms deprecate AX-3f9a1c --reason "now a lint rule"`,
    )
    .action(deprecateAxiomOrchestrator);

  axiomsCmd
    .command("merge <ids...>")
    .description(
      "Collapse over-split axioms into one: re-label their critiques, deprecate the rest",
    )
    .requiredOption("--into <id>", "the surviving axiom")
    .addHelpText(
      "after",
      `
When to use: several axioms say the same thing — one principle split
into near-twins divides its evidence into separate rates. Merging
re-labels every critique of the merged-away axioms to the survivor
(append-only; prior labels stay in the ledger), deprecates them with
the merge named, and moves the survivor's population clock to the
earliest among the merged. Reports recompute instantly.

Example:
  $ praxis axioms merge AX-aaaaaa AX-bbbbbb --into AX-cccccc`,
    )
    .action(mergeAxiomsOrchestrator);

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
