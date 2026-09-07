import type { PraxisConfig } from "@/models/praxis-config.js";
import type {
  ActiveAxiom,
  LabelProgressEvent,
  PendingCritique,
  ProviderUsage,
  Service,
  TriageRecord,
} from "@/types.js";

import { joinPath } from "@/helpers/paths-helper.js";
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
  /** Critiques the matcher considered and could not label — curate's queue now. */
  sentToCurate: number;
  /** Critiques whose spec has no active axioms — nothing to label against. */
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
 * The labeling pass (04, review→label): classifies each **untriaged**
 * critique against its spec's active axioms — one curator call per
 * critique, temperature 0, so no critique's verdict can be biased by
 * its neighbors or its position in a list (owner, 2026-09-07). Calls
 * run a few at a time; order-independence is what makes the
 * parallelism safe.
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
 * unratified id must never enter the ledger, as an assignment or as an
 * unmatched verdict.
 */
const labelCritiquesService: Service<LabelCritiquesInput, Promise<LabelCritiquesResult>> = async (
  cfg,
  { pending, dryRun = false, onProgress },
) => {
  const axiomStore = new AxiomStore(cfg);
  const bySpec = groupBySpec(pending);

  const labels: CritiqueLabel[] = [];
  const records: TriageRecord[] = [];
  const usages: (ProviderUsage | null)[] = [];
  const suggestedBy = cfg.curator?.model ?? "curator";
  let skippedNoAxioms = 0;
  let sentToCurate = 0;
  let failed = 0;
  let done = 0;

  const batches: { specPath: string; axioms: ActiveAxiom[]; critiques: PendingCritique[] }[] = [];

  for (const [specPath, critiques] of bySpec) {
    const axioms = axiomStore.activeFor(joinPath(cfg.root, specPath));

    if (axioms.length === 0) {
      skippedNoAxioms += critiques.length;

      continue;
    }

    batches.push({ specPath, axioms, critiques });
  }

  const total = batches.reduce((sum, batch) => sum + batch.critiques.length, 0);

  for (const { specPath, axioms, critiques } of batches) {
    const consideredSet = axioms.map((axiom) => `${axiom.id}@${axiom.version}`).sort();

    const outcomes = await labelSpecBatch(cfg, {
      specPath,
      axioms,
      critiques,
      onOutcome: (outcome) => {
        done++;
        onProgress?.({
          done,
          total,
          critiqueId: outcome.critique.id,
          filePath: outcome.critique.filePath,
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
  }

  const sessionPath =
    dryRun || records.length === 0 ? null : new TriageStore(cfg).writeSession(records).path;

  return {
    labels,
    sentToCurate,
    skippedNoAxioms,
    failed,
    usage: sumUsage(usages),
    sessionPath,
  };
};

export default labelCritiquesService;

/** The event kind of one outcome. */
function outcomeKind(outcome: LabelOutcome): LabelProgressEvent["outcome"] {
  if (outcome.failed) return "failed";

  return outcome.label === null ? "unmatched" : "labeled";
}

/** The pending queue keyed by governing spec. */
function groupBySpec(pending: PendingCritique[]): Map<string, PendingCritique[]> {
  const groups = new Map<string, PendingCritique[]>();

  for (const critique of pending) {
    const group = groups.get(critique.specPath) ?? [];
    group.push(critique);
    groups.set(critique.specPath, group);
  }

  return groups;
}

/** One spec's critiques labeled, a few calls in flight at a time. */
async function labelSpecBatch(
  cfg: PraxisConfig,
  input: {
    specPath: string;
    axioms: ActiveAxiom[];
    critiques: PendingCritique[];
    onOutcome: (outcome: LabelOutcome) => void;
  },
): Promise<LabelOutcome[]> {
  const { specPath, axioms, critiques, onOutcome } = input;
  const axiomBlocks = axioms
    .map((axiom) =>
      labelingAxiomBlock({ id: axiom.id, severity: axiom.severity, body: axiom.body.trim() }),
    )
    .join("\n\n");
  const versions = new Map(axioms.map((axiom) => [axiom.id, axiom.version]));

  const outcomes: LabelOutcome[] = new Array<LabelOutcome>(critiques.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < critiques.length) {
      const index = next;
      next++;
      const critique = critiques[index];

      if (critique === undefined) continue;

      const outcome = await labelOne(cfg, { specPath, axiomBlocks, versions, critique });
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
    specPath: string;
    axiomBlocks: string;
    versions: Map<string, number>;
    critique: PendingCritique;
  },
): Promise<LabelOutcome> {
  const { specPath, axiomBlocks, versions, critique } = input;
  const critiqueLine = labelingCritiqueLine({
    id: critique.id,
    filePath: critique.filePath,
    text: critique.text,
  });

  let completion;

  try {
    completion = await requestCuratorCompletionService(cfg, {
      systemPrompt: curatorSystemPrompt(),
      userPrompt: labelingQuestion({ specPath, axiomBlocks, critiqueLine }),
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
