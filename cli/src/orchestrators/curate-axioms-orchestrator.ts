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
import assessTraceabilityService from "@/services/assess-traceability-service.js";
import deriveTriageStateService from "@/services/derive-triage-state-service.js";
import organizeTriageService from "@/services/organize-triage-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { TriageStore } from "@/stores/triage-store.js";
import curateClusterView from "@/views/curate-cluster-view.js";
import curateSummaryView from "@/views/curate-summary-view.js";
import { Prompter } from "@framework/views/prompter.js";

/** Unique critiques per curator clustering call. */
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
  activatedThisSession: { id: string; statement: string }[];
  assigned: number;
  activated: number;
  /** Held as evidence with no axiom yet — the curator's call, accepted; nothing written. */
  held: number;
  /** Skipped by the human — nothing decided, nothing written. */
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
}

/**
 * What `praxis axioms curate` does: the human review session.
 *
 * The division of labor is fixed: the curator organizes — clusters the
 * pending critiques per spec, suggests assignments, drafts proposals —
 * and the human decides, cluster by cluster. Clustering needs the set
 * (a category only emerges from a grouping large enough to show it),
 * but the set is bounded: identical critique texts
 * dedup into one member with its duplicates counted, and each curator
 * call sees at most one cohort of unique critiques, with the session's
 * accepted proposals carried into later cohorts as fold targets so
 * categories consolidate instead of re-emerging per cohort. An accepted
 * draft is written as it was accepted: the guidance on what makes a good
 * axiom lives in the curator's drafting prompt, and the human's
 * acceptance is the decision — nothing second-guesses it afterwards
 * (owner, 2026-09-09). Curate takes every critique's validity for
 * granted — validity is `praxis eval review`'s question — so nothing
 * here dismisses: a cluster with no axiom yet is **held**, writing
 * nothing, and rides into the next session's cohort. Assignments and
 * proposals land in the ledger's triage partition; `--yes` accepts
 * every suggestion and is recorded as such — an unreviewed assignment
 * is exactly as trustworthy as that sounds.
 *
 * @throws PraxisError without a curator, while any critique is still
 *   untriaged (triage first — a clean queue is the precondition), or
 *   interactive without a TTY
 */
export const curateAxiomsOrchestrator: Orchestrator<CurateAxiomsOptions> = async (
  ctx,
  { yes = false },
) => {
  const cfg = ctx.config;
  const curator = cfg.curator;

  if (!curator) throw errors.curatorNotConfigured();

  const state = deriveTriageStateService(cfg, {});

  // Curate works ONLY the unmatched residue, and only when that residue
  // is complete: an untriaged critique may be the one that completes a
  // pattern, so curating past it is curating on partial evidence.
  if (state.pending.length > 0) throw errors.triageIncomplete(state.pending.length);

  if (state.unidentified.length === 0) {
    ctx.render([{ channel: "content", entries: ["Nothing awaiting curation."] }]);

    return "ok";
  }

  const prompter = new Prompter();

  if (!yes && !prompter.interactive) {
    throw errors.notATty("praxis axioms curate", "--yes");
  }

  const session: CurateSession = {
    ctx,
    cfg,
    yes,
    prompter,
    suggestedBy: curator.model,
    records: [],
    activatedThisSession: [],
    assigned: 0,
    activated: 0,
    held: 0,
    skipped: 0,
    costUsd: null,
  };

  await organizeAndDecide(session, state.unidentified);

  prompter.close();

  if (session.records.length > 0) {
    new TriageStore(cfg).writeSession(session.records);
  }

  const pendingLeft = state.unidentified.length - session.assigned;
  const summary = curateSummaryView({
    assigned: session.assigned,
    activated: session.activated,
    held: session.held,
    skipped: session.skipped,
    pendingLeft,
    costUsd: session.costUsd,
  });

  ctx.render(summary);

  return "ok";
};

export default prepareOrchestrator(curateAxiomsOrchestrator);

/** The session proper: per spec, dedup, cohort, organize, then decide. */
async function organizeAndDecide(
  session: CurateSession,
  pending: PendingCritique[],
): Promise<void> {
  const store = new AxiomStore(session.cfg);
  const versions = new Map(store.all().axioms.map((axiom) => [axiom.id, axiom.version]));

  // Fold targets are ALL active axioms — an axiom is
  // an abstraction over evidence, never a child of one spec, and a
  // proposal awaiting ratification already carries its remediation — plus
  // whatever this session proposes as it goes.
  const established = store
    .all()
    .axioms.filter((axiom) => axiom.status === "active")
    .map((axiom) => ({ id: axiom.id, statement: axiom.statement() }));

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
      axioms: [...established, ...session.activatedThisSession],
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

    await decideCluster(session, cluster, clusterCritiques, versions, {
      path: specPath,
      content: specContent,
    });
  }

  const clustered = new Set(organization.clusters.flatMap((cluster) => cluster.critiqueIds));
  const unclustered = cohort.filter((entry) => !clustered.has(entry.representative.id));

  if (unclustered.length > 0) holdUnclustered(session, unclustered);
}

/**
 * Critiques the curator left out of every cluster: nothing falls
 * through silently — they are named, counted as held, and stay in the
 * queue for the next session.
 */
function holdUnclustered(session: CurateSession, unclustered: DedupedCritique[]): void {
  const members = unclustered.flatMap((entry) => entry.members);
  const ids = unclustered.map((entry) => entry.representative.id).join(", ");

  session.held += members.length;
  session.ctx.render([
    {
      channel: "warning",
      text: `The curator left ${members.length} critique(s) out of every cluster (${ids}) — held; they stay in the queue for the next session.`,
    },
  ]);
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
  spec: { path: string; content: string },
): Promise<void> {
  const decision = session.yes
    ? "accept"
    : await session.prompter.choose("[a]ccept / [s]kip", ["accept", "skip"]);

  if (decision === "skip") {
    session.skipped += critiques.length;

    return;
  }

  await acceptSuggestion(session, cluster, critiques, versions, spec);
}

/** The curator's suggestion, accepted: assign, activate, or hold. */
async function acceptSuggestion(
  session: CurateSession,
  cluster: TriageCluster,
  critiques: PendingCritique[],
  versions: Map<string, number>,
  spec: { path: string; content: string },
): Promise<void> {
  const { suggestion } = cluster;

  if (suggestion.kind === "assign") {
    assign(session, critiques, suggestion.axiomId, versions.get(suggestion.axiomId) ?? 1);

    return;
  }

  if (suggestion.kind === "hold") {
    // Valid evidence, no axiom yet: nothing written, so the critiques
    // stay unmatched and join the next session's cohort.
    session.held += critiques.length;

    return;
  }

  await activate(session, critiques, suggestion.draft, spec);
}

/** Folds critiques into an established (or session-activated) axiom. */
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

/**
 * An accepted draft activates — acceptance IS the human decision, so
 * there is no separate ratification step. The one machine check first:
 * spec traceability. A principle no spec states must not start
 * counting; the honest move is extending the spec, so an untraceable
 * draft is held (nothing written) with the curator's basis shown.
 */
async function activate(
  session: CurateSession,
  critiques: PendingCritique[],
  draft: AxiomDraft,
  spec: { path: string; content: string },
): Promise<void> {
  let traceability;

  try {
    traceability = await assessTraceabilityService(session.cfg, {
      specPath: spec.path,
      specContent: spec.content,
      statement: draft.statement,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    session.ctx.render([
      {
        channel: "warning",
        text: `Traceability call failed: ${message} — the cluster is held; rerun curate to retry.`,
      },
    ]);
    session.held += critiques.length;

    return;
  }

  addUsage(session, traceability.usage);

  if (!traceability.traceable || traceability.grounding === null) {
    session.ctx.render([
      {
        channel: "warning",
        text: `Not traceable — the cluster is held. If the standard is real, extend the spec and re-curate.${traceability.quotedBasis === "" ? "" : ` Basis: ${traceability.quotedBasis}`}`,
      },
    ]);
    session.held += critiques.length;

    return;
  }

  const store = new AxiomStore(session.cfg);
  const { id } = store.createActive({
    statement: draft.statement,
    derivedFrom: traceability.grounding,
  });

  session.activated++;
  assign(session, critiques, id, 1);
  session.activatedThisSession.push({ id, statement: draft.statement });
  session.ctx.render([
    {
      channel: "success",
      text: `${id} is active, derived from ${traceability.grounding}. The next \`praxis axioms triage\` labels against it.`,
    },
  ]);
}

/** Groups the queue per governing spec — grounding is per-spec. */
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
