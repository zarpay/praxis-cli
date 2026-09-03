import type {
  AxiomDraft,
  Orchestrator,
  PendingCritique,
  ProviderUsage,
  TriageAxiomsOptions,
  TriageCluster,
  TriageSession,
} from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { exists, readText } from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import assessAxiomGateService from "@/services/assess-axiom-gate-service.js";
import deriveTriageStateService from "@/services/derive-triage-state-service.js";
import organizeTriageService from "@/services/organize-triage-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { TriageStore } from "@/stores/triage-store.js";
import triageClusterView from "@/views/triage-cluster-view.js";
import triageSummaryView from "@/views/triage-summary-view.js";
import { Prompter } from "@framework/views/prompter.js";

/**
 * What `praxis axioms triage` does: the human review session (04).
 *
 * The division of labor is fixed: the curator organizes — clusters the
 * pending open-channel critiques per spec, suggests assignments, drafts
 * proposals — and the human decides, cluster by cluster. Accepted
 * drafts pass the authoring gate before anything is written (03).
 * Every decision lands in the ledger's triage partition; `--yes`
 * accepts every suggestion and is recorded as such — an unreviewed
 * assignment is exactly as trustworthy as that sounds (04).
 *
 * @throws PraxisError without a curator, or interactive without a TTY
 */
export const triageAxiomsOrchestrator: Orchestrator<TriageAxiomsOptions> = async (
  ctx,
  { yes = false, reject },
) => {
  const cfg = ctx.config;
  const curator = cfg.curator;

  if (!curator) throw errors.curatorNotConfigured();

  const state = deriveTriageStateService(cfg, {});

  if (state.pending.length === 0) {
    ctx.render([{ channel: "content", entries: ["Nothing pending triage."] }]);

    return "ok";
  }

  const prompter = new Prompter();

  if (!yes && reject === undefined && !prompter.interactive) {
    throw errors.notATty("praxis axioms triage", '--yes or --reject "<reason>"');
  }

  const session: TriageSession = {
    ctx,
    cfg,
    yes,
    prompter,
    suggestedBy: curator.model,
    records: [],
    assigned: 0,
    proposed: 0,
    dismissed: 0,
    skipped: 0,
    costUsd: null,
  };

  if (reject === undefined) {
    await organizeAndDecide(session, state.pending);
  } else {
    dismissAll(session, state.pending, reject);
  }

  prompter.close();

  if (session.records.length > 0) {
    new TriageStore(cfg).appendSession(session.records);
  }

  const pendingLeft = state.pending.length - session.assigned - session.dismissed;
  const summary = triageSummaryView({
    assigned: session.assigned,
    proposed: session.proposed,
    dismissed: session.dismissed,
    skipped: session.skipped,
    pendingLeft,
    costUsd: session.costUsd,
  });

  ctx.render(summary);

  return "ok";
};

export default prepareOrchestrator(triageAxiomsOrchestrator);

/** The whole queue dismissed with one reason — the `--reject` path. */
function dismissAll(session: TriageSession, pending: PendingCritique[], reason: string): void {
  for (const critique of pending) {
    session.records.push({
      kind: "dismissal",
      critique_id: critique.id,
      reason,
      timestamp: new Date().toISOString(),
    });
    session.dismissed++;
  }
}

/** The session proper: per spec, organize with the curator, then decide. */
async function organizeAndDecide(
  session: TriageSession,
  pending: PendingCritique[],
): Promise<void> {
  const { axioms } = new AxiomStore(session.cfg).all();
  const established = axioms
    .filter((axiom) => axiom.status === "active")
    .map((axiom) => ({ id: axiom.id, statement: axiom.statement() }));
  const versions = new Map(axioms.map((axiom) => [axiom.id, axiom.version]));

  for (const [specPath, critiques] of groupBySpec(pending)) {
    const specFile = joinPath(session.cfg.root, specPath);

    if (!exists(specFile)) {
      session.ctx.render([
        {
          channel: "warning",
          text: `Spec ${specPath} no longer exists; its critiques stay pending.`,
        },
      ]);
      session.skipped += critiques.length;
      continue;
    }

    let organization;

    try {
      organization = await organizeTriageService(session.cfg, {
        specPath,
        specContent: readText(specFile),
        critiques,
        axioms: established,
      });
    } catch (err) {
      // A curator failure loses one spec's session, never the decisions
      // already made: pending is derived, so rerunning triage resumes.
      const message = err instanceof Error ? err.message : String(err);
      session.ctx.render([
        {
          channel: "warning",
          text: `Curator failed organizing ${specPath}: ${message} — its critiques stay pending; rerun triage to retry.`,
        },
      ]);
      session.skipped += critiques.length;
      continue;
    }

    addUsage(session, organization.usage);

    const byId = new Map(critiques.map((critique) => [critique.id, critique]));

    for (const [index, cluster] of organization.clusters.entries()) {
      const clusterCritiques = cluster.critiqueIds
        .map((id) => byId.get(id))
        .filter((critique): critique is PendingCritique => critique !== undefined);

      const clusterView = triageClusterView({
        index: index + 1,
        total: organization.clusters.length,
        cluster,
        critiques: clusterCritiques,
      });

      session.ctx.render(clusterView);

      await decideCluster(session, cluster, clusterCritiques, versions);
    }
  }
}

/** One cluster's human decision, applied. */
async function decideCluster(
  session: TriageSession,
  cluster: TriageCluster,
  critiques: PendingCritique[],
  versions: Map<string, number>,
): Promise<void> {
  const decision = session.yes
    ? "accept"
    : await session.prompter.choose("[a]ccept / [d]ismiss / [s]kip", ["accept", "dismiss", "skip"]);

  if (decision === "skip") {
    session.skipped += critiques.length;

    return;
  }

  if (decision === "dismiss") {
    const reason = await session.prompter.ask("Reason for dismissal:");

    for (const critique of critiques) {
      session.records.push({
        kind: "dismissal",
        critique_id: critique.id,
        reason: reason === "" ? "dismissed at triage" : reason,
        timestamp: new Date().toISOString(),
      });
      session.dismissed++;
    }

    return;
  }

  await acceptSuggestion(session, cluster, critiques, versions);
}

/** The curator's suggestion, accepted: assign, propose (gated), or dismiss. */
async function acceptSuggestion(
  session: TriageSession,
  cluster: TriageCluster,
  critiques: PendingCritique[],
  versions: Map<string, number>,
): Promise<void> {
  const { suggestion } = cluster;

  if (suggestion.kind === "assign") {
    assign(session, critiques, suggestion.axiomId, versions.get(suggestion.axiomId) ?? 1);

    return;
  }

  if (suggestion.kind === "unassignable") {
    for (const critique of critiques) {
      session.records.push({
        kind: "dismissal",
        critique_id: critique.id,
        reason: `unassignable: ${suggestion.why}`,
        timestamp: new Date().toISOString(),
      });
      session.dismissed++;
    }

    return;
  }

  await propose(session, critiques, suggestion.draft);
}

/** Folds critiques into an established (or newly proposed) axiom. */
function assign(
  session: TriageSession,
  critiques: PendingCritique[],
  axiomId: string,
  axiomVersion: number,
): void {
  for (const critique of critiques) {
    session.records.push({
      kind: "assignment",
      critique_id: critique.id,
      axiom_id: axiomId,
      axiom_version: axiomVersion,
      assigned_by: {
        decision: session.yes ? "flag:--yes" : "human",
        suggested_by: session.suggestedBy,
      },
      timestamp: new Date().toISOString(),
    });
    session.assigned++;
  }
}

/** An accepted draft: gate first (03), then the proposal file plus parentage. */
async function propose(
  session: TriageSession,
  critiques: PendingCritique[],
  draft: AxiomDraft,
): Promise<void> {
  let gate;

  try {
    gate = await assessAxiomGateService(session.cfg, {
      statement: draft.statement,
      violatingExample: draft.violatingExample,
      compliantExample: draft.compliantExample,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    session.ctx.render([
      {
        channel: "warning",
        text: `Gate call failed: ${message} — the cluster stays pending; rerun triage to retry.`,
      },
    ]);
    session.skipped += critiques.length;

    return;
  }

  addUsage(session, gate.usage);

  if (gate.assessment === "not_appropriate") {
    session.ctx.render([
      {
        channel: "warning",
        text: `Gate: not appropriate — ${gate.reasoning} The cluster stays pending; mechanical standards belong in static tooling (03).`,
      },
    ]);
    session.skipped += critiques.length;

    return;
  }

  const statement =
    gate.assessment === "split" && gate.judgmentHalf ? gate.judgmentHalf : draft.statement;
  const store = new AxiomStore(session.cfg);
  const { id } = store.propose({
    statement,
    severity: draft.severity,
    scope: draft.scope,
    violatingExample: draft.violatingExample,
    compliantExample: draft.compliantExample,
  });

  session.proposed++;
  assign(session, critiques, id, 1);
  session.ctx.render([
    {
      channel: "success",
      text: `Proposed ${id} (${gate.assessment}); ratify with \`praxis axioms ratify ${id}\`.`,
    },
  ]);
}

/** Groups the queue per governing spec — grounding is per-spec (04). */
function groupBySpec(pending: PendingCritique[]): Map<string, PendingCritique[]> {
  const groups = new Map<string, PendingCritique[]>();

  for (const critique of pending) {
    const group = groups.get(critique.specPath) ?? [];
    group.push(critique);
    groups.set(critique.specPath, group);
  }

  return groups;
}

/** Accumulates curator spend across the session's calls. */
function addUsage(session: TriageSession, usage: ProviderUsage | null): void {
  const cost = usage?.costUsd;

  if (cost === null || cost === undefined) return;

  session.costUsd = (session.costUsd ?? 0) + cost;
}
