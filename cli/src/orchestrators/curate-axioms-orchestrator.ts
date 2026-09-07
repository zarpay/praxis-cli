import type { CommandContext } from "@/models/command-context.js";
import type { PraxisConfig } from "@/models/praxis-config.js";
import type {
  AxiomDraft,
  Orchestrator,
  PendingCritique,
  ProviderUsage,
  TriageCluster,
  TriageRecord,
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
import curateClusterView from "@/views/curate-cluster-view.js";
import curateSummaryView from "@/views/curate-summary-view.js";
import { Prompter } from "@framework/views/prompter.js";

/** Unique critiques per curator clustering call (04: cohorting). */
const COHORT_SIZE = 30;

/** What one interactive curate session accumulates as it walks clusters. */
interface CurateSession {
  ctx: CommandContext;
  cfg: PraxisConfig;
  yes: boolean;
  prompter: Prompter;
  /** The curator model, recorded as the suggester in every assignment. */
  suggestedBy: string;
  records: TriageRecord[];
  /** Proposals accepted this session — later cohorts fold into them. */
  proposalsThisSession: { id: string; statement: string }[];
  assigned: number;
  proposed: number;
  dismissed: number;
  skipped: number;
  costUsd: number | null;
}

/** One distinct critique text, with every pending duplicate behind it. */
interface DedupedCritique {
  representative: PendingCritique;
  /** Every pending critique with this exact text, representative included. */
  members: PendingCritique[];
}

/** Options for `praxis axioms curate`. */
interface CurateAxiomsOptions {
  /** Accept every curator suggestion without prompting. */
  yes?: boolean;
  /** Dismiss everything pending, with this reason. */
  reject?: string;
}

/**
 * What `praxis axioms curate` does: the human review session (04).
 *
 * The division of labor is fixed: the curator organizes — clusters the
 * pending critiques per spec, suggests assignments, drafts proposals —
 * and the human decides, cluster by cluster. Clustering needs the set
 * (a category only emerges from a grouping large enough to show it),
 * but the set is bounded (owner, 2026-09-07): identical critique texts
 * dedup into one member with its duplicates counted, and each curator
 * call sees at most one cohort of unique critiques, with the session's
 * accepted proposals carried into later cohorts as fold targets so
 * categories consolidate instead of re-emerging per cohort. Accepted
 * drafts pass the authoring gate before anything is written (03).
 * Every decision lands in the ledger's triage partition; `--yes`
 * accepts every suggestion and is recorded as such — an unreviewed
 * assignment is exactly as trustworthy as that sounds (04).
 *
 * @throws PraxisError without a curator, or interactive without a TTY
 */
export const curateAxiomsOrchestrator: Orchestrator<CurateAxiomsOptions> = async (
  ctx,
  { yes = false, reject },
) => {
  const cfg = ctx.config;
  const curator = cfg.curator;

  if (!curator) throw errors.curatorNotConfigured();

  const state = deriveTriageStateService(cfg, {});

  // Curate works ONLY the unmatched residue (04): "does this need a NEW
  // axiom" is well-posed only after triage has said no existing one fits.
  if (state.pending.length > 0) {
    ctx.logger.warn(
      `${state.pending.length} critique(s) are untriaged and not part of this session — ` +
        "`praxis axioms triage` categorizes them first.",
    );
  }

  if (state.unidentified.length === 0) {
    ctx.render([{ channel: "content", entries: ["Nothing awaiting curation."] }]);

    return "ok";
  }

  const prompter = new Prompter();

  if (!yes && reject === undefined && !prompter.interactive) {
    throw errors.notATty("praxis axioms curate", '--yes or --reject "<reason>"');
  }

  const session: CurateSession = {
    ctx,
    cfg,
    yes,
    prompter,
    suggestedBy: curator.model,
    records: [],
    proposalsThisSession: [],
    assigned: 0,
    proposed: 0,
    dismissed: 0,
    skipped: 0,
    costUsd: null,
  };

  if (reject === undefined) {
    await organizeAndDecide(session, state.unidentified);
  } else {
    dismissAll(session, state.unidentified, reject);
  }

  prompter.close();

  if (session.records.length > 0) {
    new TriageStore(cfg).writeSession(session.records);
  }

  const pendingLeft = state.unidentified.length - session.assigned - session.dismissed;
  const summary = curateSummaryView({
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

export default prepareOrchestrator(curateAxiomsOrchestrator);

/** The whole queue dismissed with one reason — the `--reject` path. */
function dismissAll(session: CurateSession, pending: PendingCritique[], reason: string): void {
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

/** The session proper: per spec, dedup, cohort, organize, then decide. */
async function organizeAndDecide(
  session: CurateSession,
  pending: PendingCritique[],
): Promise<void> {
  const store = new AxiomStore(session.cfg);
  const versions = new Map(store.all().axioms.map((axiom) => [axiom.id, axiom.version]));

  // Fold targets are ALL active axioms — an axiom is an abstraction over
  // evidence, never a child of one spec (owner, 2026-09-07) — plus
  // whatever this session proposes as it goes.
  const established = store.active().map((axiom) => ({ id: axiom.id, statement: axiom.statement }));

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

    const deduped = dedupByText(critiques);
    const cohorts = chunk(deduped, COHORT_SIZE);

    if (cohorts.length > 1 || deduped.length < critiques.length) {
      session.ctx.logger.info(
        `${specPath}: ${deduped.length} distinct critique(s) (${critiques.length} pending) in ${cohorts.length} cohort(s)`,
      );
    }

    for (const cohort of cohorts) {
      await organizeCohort(session, {
        specPath,
        specContent: readText(specFile),
        cohort,
        established,
        versions,
      });
    }
  }
}

/** One cohort organized by the curator, then decided cluster by cluster. */
async function organizeCohort(
  session: CurateSession,
  input: {
    specPath: string;
    specContent: string;
    cohort: DedupedCritique[];
    established: { id: string; statement: string }[];
    versions: Map<string, number>;
  },
): Promise<void> {
  const { specPath, specContent, cohort, established, versions } = input;
  const memberCount = cohort.reduce((sum, entry) => sum + entry.members.length, 0);

  let organization;

  try {
    organization = await organizeTriageService(session.cfg, {
      specPath,
      specContent,
      critiques: cohort.map((entry) => entry.representative),
      axioms: [...established, ...session.proposalsThisSession],
    });
  } catch (err) {
    // A curator failure loses one cohort, never the decisions already
    // made: pending is derived, so rerunning curate resumes.
    const message = err instanceof Error ? err.message : String(err);
    session.ctx.render([
      {
        channel: "warning",
        text: `Curator failed organizing ${specPath}: ${message} — its critiques stay pending; rerun curate to retry.`,
      },
    ]);
    session.skipped += memberCount;

    return;
  }

  addUsage(session, organization.usage);

  const byId = new Map(cohort.map((entry) => [entry.representative.id, entry]));

  for (const [index, cluster] of organization.clusters.entries()) {
    const clusterEntries = cluster.critiqueIds
      .map((id) => byId.get(id))
      .filter((entry): entry is DedupedCritique => entry !== undefined);
    const clusterCritiques = clusterEntries.flatMap((entry) => entry.members);

    const clusterView = curateClusterView({
      index: index + 1,
      total: organization.clusters.length,
      cluster,
      critiques: clusterEntries.map((entry) => ({
        ...entry.representative,
        copies: entry.members.length,
      })),
    });

    session.ctx.render(clusterView);

    await decideCluster(session, cluster, clusterCritiques, versions);
  }
}

/** Identical critique texts folded into one member with its duplicates. */
function dedupByText(critiques: PendingCritique[]): DedupedCritique[] {
  const byText = new Map<string, DedupedCritique>();

  for (const critique of critiques) {
    const entry = byText.get(critique.text);

    if (entry === undefined) {
      byText.set(critique.text, { representative: critique, members: [critique] });
    } else {
      entry.members.push(critique);
    }
  }

  return [...byText.values()];
}

/** The list in slices of at most `size`, order preserved. */
function chunk<Item>(items: Item[], size: number): Item[][] {
  const slices: Item[][] = [];

  for (let start = 0; start < items.length; start += size) {
    slices.push(items.slice(start, start + size));
  }

  return slices;
}

/** One cluster's human decision, applied. */
async function decideCluster(
  session: CurateSession,
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
  session: CurateSession,
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
  session: CurateSession,
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
  session: CurateSession,
  critiques: PendingCritique[],
  draft: AxiomDraft,
): Promise<void> {
  let gate;

  try {
    gate = await assessAxiomGateService(session.cfg, {
      statement: draft.statement,
      violatingExample: draft.violatingExample,
      compliantExample: draft.compliantExample,
      existing: existingTaxonomy(session),
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

  if (gate.duplicateOf !== null) {
    // The taxonomy already carries this remediation: fold, never twin.
    const version = versionOf(session, gate.duplicateOf);
    assign(session, critiques, gate.duplicateOf, version);
    session.ctx.render([
      {
        channel: "success",
        text: `Gate: same remediation as ${gate.duplicateOf} — folded the cluster there instead of drafting a twin.`,
      },
    ]);

    return;
  }

  const statement =
    gate.assessment === "split" && gate.judgmentHalf ? gate.judgmentHalf : draft.statement;
  const store = new AxiomStore(session.cfg);
  const { id } = store.propose({
    statement,
    severity: draft.severity,
    violatingExample: draft.violatingExample,
    compliantExample: draft.compliantExample,
  });

  session.proposed++;
  assign(session, critiques, id, 1);
  session.proposalsThisSession.push({ id, statement });
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
function addUsage(session: CurateSession, usage: ProviderUsage | null): void {
  const cost = usage?.costUsd;

  if (cost === null || cost === undefined) return;

  session.costUsd = (session.costUsd ?? 0) + cost;
}

/** The taxonomy the gate checks duplication against: active + proposed + this session's. */
function existingTaxonomy(session: CurateSession): { id: string; statement: string }[] {
  const store = new AxiomStore(session.cfg);
  const onRecord = store
    .all()
    .axioms.filter((axiom) => axiom.status === "active" || axiom.status === "proposed")
    .map((axiom) => ({ id: axiom.id, statement: axiom.statement() }));

  return [...onRecord, ...session.proposalsThisSession];
}

/** An axiom's current version, defaulting to 1 for fresh proposals. */
function versionOf(session: CurateSession, axiomId: string): number {
  const { axioms } = new AxiomStore(session.cfg).all();

  return axioms.find((axiom) => axiom.id === axiomId)?.version ?? 1;
}
