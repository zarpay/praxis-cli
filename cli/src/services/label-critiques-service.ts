import type { PraxisConfig } from "@/models/praxis-config.js";
import type {
  ActiveAxiom,
  LabelProgressEvent,
  PendingCritique,
  ProviderUsage,
  Service,
  TriageRecord,
} from "@/types.js";

import curatorSystemPrompt from "@/prompts/curator-system-prompt.js";
import labelingAxiomBlock from "@/prompts/labeling-axiom-block.js";
import labelingCritiqueLine from "@/prompts/labeling-critique-line.js";
import labelingQuestion from "@/prompts/labeling-question.js";
import labelingTools from "@/prompts/labeling-tools.js";
import requestCuratorCompletionService from "@/services/request-curator-completion-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { TriageStore } from "@/stores/triage-store.js";

/** Concurrent labeling calls in flight; order-independence makes this safe. */
const CONCURRENCY = 4;

/** The pending backlog to label, and whether to write the outcome. */
interface LabelCritiquesInput {
  pending: PendingCritique[];
  /** Propose without writing anything. */
  dryRun?: boolean;
  /** Called after each critique's verdict lands. */
  onProgress?: (event: LabelProgressEvent) => void;
}

/** One proposed or written label. */
interface CritiqueLabel {
  critiqueId: string;
  axiomId: string;
  axiomVersion: number;
}

/** What the labeling pass did (or would do, under dryRun). */
interface LabelCritiquesResult {
  labels: CritiqueLabel[];
  /** Labels per axiom, sorted by id — the summary's tally block. */
  labeledByAxiom: { axiomId: string; count: number }[];
  /** Critiques the matcher considered and could not label — curate's queue now. */
  sentToCurate: number;
  /** Critiques whose spec has no active axioms — trivially unmatched, sent to curate without a call. */
  skippedNoAxioms: number;
  /** Critiques whose labeling call failed — they stay untriaged; rerun retries. */
  failed: number;
  usage: ProviderUsage | null;
  /** Where the session records landed; null under dryRun or when nothing was decided. */
  sessionPath: string | null;
}

/** One critique's labeling outcome, before aggregation. */
interface LabelOutcome {
  critique: PendingCritique;
  label: CritiqueLabel | null;
  usage: ProviderUsage | null;
  failed: boolean;
}

/**
 * The labeling pass: classifies each **untriaged**
 * critique against ALL active axioms — an axiom is an abstraction over
 * evidence, never a child of one spec, so a critique from any spec can
 * land in any axiom. One curator call per critique,
 * temperature 0, so no critique's verdict can be biased by its
 * neighbors or its position in a list. Calls run a few at a time;
 * order-independence is what makes the parallelism safe.
 *
 * Every considered critique leaves categorized: a squarely-an-instance
 * match appends a matcher assignment record; a no-match appends an
 * **unmatched** record pinning the axiom set it was judged against —
 * that is what moves the critique to curate's queue, and what re-queues
 * it for triage if the set later changes. Only a failed call leaves no
 * record: pending is derived, so rerunning triage retries exactly the
 * unsettled remainder.
 *
 * The hallucination guard lives here: a returned axiom id that is not
 * among the spec's active axioms is treated as a failed call — an
 * invented id must never enter the ledger, as an assignment or as an
 * unmatched verdict.
 */
const labelCritiquesService: Service<LabelCritiquesInput, Promise<LabelCritiquesResult>> = async (
  cfg,
  { pending, dryRun = false, onProgress },
) => {
  const active = new AxiomStore(cfg).active();

  const labels: CritiqueLabel[] = [];
  const records: TriageRecord[] = [];
  const usages: (ProviderUsage | null)[] = [];
  const suggestedBy = cfg.curator?.model ?? "curator";
  let skippedNoAxioms = 0;
  let sentToCurate = 0;
  let failed = 0;
  let done = 0;

  if (active.length === 0) {
    // Nothing to match against anywhere: every verdict is trivially
    // "unmatched against the empty set" — recorded without a curator
    // call, so the critiques reach curate instead of stalling untriaged.
    skippedNoAxioms = pending.length;

    for (const critique of pending) {
      records.push({
        kind: "unmatched",
        critique_id: critique.id,
        considered: [],
        suggested_by: suggestedBy,
        timestamp: new Date().toISOString(),
      });
    }
  }

  const consideredSet = active.map((axiom) => `${axiom.id}@${axiom.version}`).sort();
  const queue = active.length === 0 ? [] : pending;

  const outcomes = await labelBatch(cfg, {
    axioms: active,
    critiques: queue,
    onOutcome: (outcome) => {
      done++;
      onProgress?.({
        done,
        total: queue.length,
        critiqueId: outcome.critique.id,
        filePath: outcome.critique.filePath,
        text: outcome.critique.text,
        outcome: outcomeKind(outcome),
        axiomId: outcome.label?.axiomId ?? null,
      });
    },
  });

  for (const outcome of outcomes) {
    usages.push(outcome.usage);

    if (outcome.failed) {
      failed++;

      continue;
    }

    if (outcome.label !== null) {
      labels.push(outcome.label);
      records.push({
        kind: "assignment",
        critique_id: outcome.label.critiqueId,
        axiom_id: outcome.label.axiomId,
        axiom_version: outcome.label.axiomVersion,
        assigned_by: { decision: "matcher", suggested_by: suggestedBy },
        timestamp: new Date().toISOString(),
      });

      continue;
    }

    sentToCurate++;
    records.push({
      kind: "unmatched",
      critique_id: outcome.critique.id,
      considered: consideredSet,
      suggested_by: suggestedBy,
      timestamp: new Date().toISOString(),
    });
  }

  const sessionPath =
    dryRun || records.length === 0 ? null : new TriageStore(cfg).writeSession(records).path;

  return {
    labels,
    labeledByAxiom: tallyByAxiom(labels),
    sentToCurate,
    skippedNoAxioms,
    failed,
    usage: sumUsage(usages),
    sessionPath,
  };
};

/** Labels counted per axiom, sorted by id. */
function tallyByAxiom(labels: CritiqueLabel[]): { axiomId: string; count: number }[] {
  const byAxiom = new Map<string, number>();

  for (const label of labels) {
    byAxiom.set(label.axiomId, (byAxiom.get(label.axiomId) ?? 0) + 1);
  }

  return [...byAxiom.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([axiomId, count]) => ({ axiomId, count }));
}

export default labelCritiquesService;

/** The event kind of one outcome. */
function outcomeKind(outcome: LabelOutcome): LabelProgressEvent["outcome"] {
  if (outcome.failed) return "failed";

  return outcome.label === null ? "unmatched" : "labeled";
}

/** The critiques labeled, a few calls in flight at a time. */
async function labelBatch(
  cfg: PraxisConfig,
  input: {
    axioms: ActiveAxiom[];
    critiques: PendingCritique[];
    onOutcome: (outcome: LabelOutcome) => void;
  },
): Promise<LabelOutcome[]> {
  const { axioms, critiques, onOutcome } = input;
  const axiomBlocks = axioms
    .map((axiom) => labelingAxiomBlock({ id: axiom.id, statement: axiom.statement }))
    .join("\n");
  const versions = new Map(axioms.map((axiom) => [axiom.id, axiom.version]));

  const outcomes: LabelOutcome[] = new Array<LabelOutcome>(critiques.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < critiques.length) {
      const index = next;
      next++;
      const critique = critiques[index];

      if (critique === undefined) continue;

      const outcome = await labelOne(cfg, { axiomBlocks, versions, critique });
      outcomes[index] = outcome;
      onOutcome(outcome);
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, critiques.length) }, () => worker());
  await Promise.all(workers);

  return outcomes;
}

/** One critique, one call, one guarded verdict. */
async function labelOne(
  cfg: PraxisConfig,
  input: {
    axiomBlocks: string;
    versions: Map<string, number>;
    critique: PendingCritique;
  },
): Promise<LabelOutcome> {
  const { axiomBlocks, versions, critique } = input;
  const critiqueLine = labelingCritiqueLine({
    id: critique.id,
    filePath: critique.filePath,
    text: critique.text,
  });

  let completion;

  try {
    completion = await requestCuratorCompletionService(cfg, {
      systemPrompt: curatorSystemPrompt(),
      userPrompt: labelingQuestion({ axiomBlocks, critiqueLine }),
      tools: labelingTools(),
    });
  } catch {
    return { critique, label: null, usage: null, failed: true };
  }

  const wire = completion.args as { axiom_id?: string | null };
  const axiomId = wire.axiom_id ?? null;

  if (axiomId === null) return { critique, label: null, usage: completion.usage, failed: false };

  const version = versions.get(axiomId);

  // The hallucination guard: an id outside the spec's active set is a
  // failed call — never an assignment, and never an unmatched verdict.
  if (version === undefined)
    return { critique, label: null, usage: completion.usage, failed: true };

  return {
    critique,
    label: { critiqueId: critique.id, axiomId, axiomVersion: version },
    usage: completion.usage,
    failed: false,
  };
}

/** Usage summed across calls; null when nothing was reported. */
function sumUsage(usages: (ProviderUsage | null)[]): ProviderUsage | null {
  const reported = usages.filter((usage): usage is ProviderUsage => usage !== null);

  if (reported.length === 0) return null;

  return {
    promptTokens: total(reported.map((usage) => usage.promptTokens)),
    completionTokens: total(reported.map((usage) => usage.completionTokens)),
    costUsd: total(reported.map((usage) => usage.costUsd)),
  };
}

/** Sum of the reported values; null when none were reported. */
function total(values: (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);

  if (known.length === 0) return null;

  return known.reduce((sum, value) => sum + value, 0);
}
