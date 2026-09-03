import type { Orchestrator, RatifyAxiomOptions } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { exists, readText, removeFile } from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import assessAxiomGateService from "@/services/assess-axiom-gate-service.js";
import assessTraceabilityService from "@/services/assess-traceability-service.js";
import deriveTriageStateService from "@/services/derive-triage-state-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { RunStore } from "@/stores/run-store.js";
import { TriageStore } from "@/stores/triage-store.js";
import ratifyView from "@/views/ratify-view.js";
import { Prompter } from "@framework/views/prompter.js";

/**
 * What `praxis axioms ratify <id>` does: the human gate a proposal
 * passes to become active (04).
 *
 * Renders the proposal with its supporting critiques, the authoring
 * gate's verdict, and the curator's traceability assessment; then the
 * three outcomes: traceable → ratify with grounding; real but
 * untraceable → instruct fixing the spec (nothing written, exit 1);
 * not intended → `--reject` removes the proposal and records the
 * rejection, feeding the reviewer-noise signal.
 *
 * @throws PraxisError without a curator, an unknown id, or no TTY
 *   without the scripting flags
 */
export const ratifyAxiomOrchestrator: Orchestrator<RatifyAxiomOptions> = async (
  ctx,
  { id, yes = false, reject, spec },
) => {
  const { root, config } = ctx;

  if (!config.curator) throw errors.curatorNotConfigured();

  const store = new AxiomStore(config);
  const { axioms } = store.all();
  const proposal = axioms.find((axiom) => axiom.id === id && axiom.status === "proposed");

  if (!proposal) throw errors.axiomNotFound(id);

  if (reject !== undefined) {
    removeFile(proposal.path);
    new TriageStore(config).appendSession([
      { kind: "rejection", axiom_id: id, reason: reject, timestamp: new Date().toISOString() },
    ]);
    ctx.render([
      {
        channel: "success",
        text: `Rejected ${id}: ${reject} (recorded — reviewer-noise signal, 04).`,
      },
    ]);

    return "ok";
  }

  const prompter = new Prompter();

  if (!yes && !prompter.interactive) {
    throw errors.notATty("praxis axioms ratify", '--yes or --reject "<reason>"');
  }

  const { assignments } = deriveTriageStateService(config, {});
  const supporting = assignments.filter((assignment) => assignment.axiom_id === id);
  const specPath =
    spec ??
    specFromSupport(
      new RunStore(config),
      supporting.map((record) => record.critique_id),
    );

  if (!specPath) {
    ctx.render([
      {
        channel: "warning",
        text: "No supporting critique names a spec. Pass --spec <path> so traceability has something to trace against.",
      },
    ]);
    prompter.close();

    return "failed";
  }

  const specFile = joinPath(root, specPath);

  if (!exists(specFile)) {
    prompter.close();
    throw errors.documentNotFound(specPath);
  }

  const gate = await assessAxiomGateService(config, {
    statement: proposal.statement(),
    violatingExample: proposal.violatingExample(),
    compliantExample: proposal.compliantExample(),
  });

  const traceability = await assessTraceabilityService(config, {
    specPath,
    specContent: readText(specFile),
    statement: proposal.statement(),
  });

  const view = ratifyView({
    axiom: proposal,
    supportingCritiques: supporting.length,
    gate,
    traceability,
  });

  ctx.render(view);

  if (!traceability.traceable || traceability.grounding === null) {
    ctx.render([
      {
        channel: "warning",
        text: "Not ratified. If the standard is real, extend the spec and rerun; if the reviewer invented it, rerun with --reject.",
      },
    ]);
    prompter.close();

    return "failed";
  }

  const confirmed =
    yes || (await prompter.confirm(`Ratify ${id}, grounded in ${traceability.grounding}?`));

  prompter.close();

  if (!confirmed) return "failed";

  store.ratify(id, traceability.grounding);
  ctx.render([
    {
      channel: "success",
      text: `${id} is active, grounded in ${traceability.grounding}. Its spec's targets re-review under the new checklist.`,
    },
  ]);

  return "ok";
};

export default prepareOrchestrator(ratifyAxiomOrchestrator);

/** The spec the proposal's supporting critiques were reviewed against. */
function specFromSupport(runStore: RunStore, critiqueIds: string[]): string | null {
  if (critiqueIds.length === 0) return null;

  const ids = new Set(critiqueIds);
  const critique = runStore.critiques().find((record) => ids.has(record.id));

  return critique?.spec_path ?? null;
}
